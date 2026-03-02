import { redirect } from "next/navigation";
import AppShell from "./app-shell";
import { createSupabaseServerClient, hasSupabaseEnv } from "@/lib/supabase-server";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!hasSupabaseEnv) {
    return (
      <main className="page-wrap auth-page">
        <section className="card">
          <h1>Supabase not configured</h1>
          <p>
            Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code>.env.local</code>.
          </p>
        </section>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const metadata = user.user_metadata ?? {};
  const viewerMetadata = typeof metadata === "object" && metadata ? metadata : {};

  return (
    <AppShell
      viewer={{
        id: user.id,
        metadata: viewerMetadata as Record<string, unknown>,
      }}
    >
      {children}
    </AppShell>
  );
}
