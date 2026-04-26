import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

let vapidInitialized = false;

function ensureVapid() {
  if (!vapidInitialized) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!.trim(),
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim(),
      process.env.VAPID_PRIVATE_KEY!.trim(),
    );
    vapidInitialized = true;
  }
}

export async function POST(request: NextRequest) {
  ensureVapid();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { recipientUserId, title, body: messageBody, url, tag } = body;

  if (!recipientUserId) {
    return NextResponse.json({ error: "Missing recipientUserId" }, { status: 400 });
  }

  // Don't send push to yourself
  if (recipientUserId === user.id) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const { data: subscriptions, error } = await getSupabaseAdmin()
    .from("push_subscriptions")
    .select("endpoint, keys_p256dh, keys_auth")
    .eq("user_id", recipientUserId);

  if (error || !subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const payload = JSON.stringify({
    title: title || "Simple Social",
    body: messageBody || "",
    url: url || "/",
    tag: tag || undefined,
    icon: "https://res.cloudinary.com/duy32f0q4/image/upload/v1772878441/simpleSocial_Logo_s9xbr8.png",
  });

  let sent = 0;
  const staleEndpoints: string[] = [];

  for (const sub of subscriptions) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.keys_p256dh,
        auth: sub.keys_auth,
      },
    };

    try {
      await webpush.sendNotification(pushSubscription, payload);
      sent++;
    } catch (err: unknown) {
      const pushError = err as { statusCode?: number; message?: string };
      if (pushError.statusCode === 404 || pushError.statusCode === 410) {
        staleEndpoints.push(sub.endpoint);
      }
      console.error("Push send failed:", pushError.message);
    }
  }

  // Clean up stale subscriptions
  if (staleEndpoints.length > 0) {
    await getSupabaseAdmin()
      .from("push_subscriptions")
      .delete()
      .eq("user_id", recipientUserId)
      .in("endpoint", staleEndpoints);
  }

  return NextResponse.json({ ok: true, sent });
}
