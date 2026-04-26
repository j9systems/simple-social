import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { notificationId } = body;

  if (!notificationId) {
    return NextResponse.json({ error: "Missing notificationId" }, { status: 400 });
  }

  const numericId = Number(notificationId);
  if (!Number.isFinite(numericId)) {
    return NextResponse.json({ error: "Invalid notificationId" }, { status: 400 });
  }

  // Use admin client to bypass RLS — we verify ownership ourselves.
  const { data, error } = await getSupabaseAdmin()
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", numericId)
    .eq("recipient_profile_id", user.id)
    .select("id");

  if (error) {
    console.error("mark-read error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    console.warn("mark-read: 0 rows matched", { notificationId: numericId, userId: user.id });
    return NextResponse.json({ ok: false, matched: 0 });
  }

  return NextResponse.json({ ok: true, matched: data.length });
}
