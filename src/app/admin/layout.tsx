import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentProfile, getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { template: "%s — Admin", default: "Admin" },
  robots: { index: false, follow: false },
};

function GateCard({
  title,
  body,
  href,
  label,
}: {
  title: string;
  body: string;
  href: string;
  label: string;
}) {
  return (
    <div className="container flex min-h-[60dvh] items-center justify-center py-16">
      <Card className="max-w-sm p-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link href={href}>{label}</Link>
        </Button>
      </Card>
    </div>
  );
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <GateCard
        title="Admin isn't configured"
        body="This deployment is running without Supabase credentials, so there are no accounts and nothing to administer."
        href="/"
        label="Back home"
      />
    );
  }

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const profile = await getCurrentProfile();
  if (!profile?.is_admin) {
    return (
      <GateCard
        title="Not authorized"
        body="Your account doesn't have admin access on this deployment."
        href="/dashboard"
        label="Back to your dashboard"
      />
    );
  }

  return (
    <div className="container py-12 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
        Admin
      </p>
      <div className="mt-4">
        <AdminNav />
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
