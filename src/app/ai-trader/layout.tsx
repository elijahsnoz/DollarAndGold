import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentProfile, getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { template: "%s — DollarAndGold AI", default: "DollarAndGold AI" },
  robots: { index: false, follow: false, nocache: true },
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

/**
 * Gated exactly like `/admin`: same `is_admin` flag, same three checks
 * (Supabase configured, signed in, admin). Deliberately reuses that
 * mechanism rather than inventing a second one — this page needs no more
 * access control than the admin dashboard already has.
 */
export default async function AiTraderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <GateCard
        title="DollarAndGold AI isn't configured"
        body="This deployment is running without Supabase credentials, so there are no accounts and nothing to gate this page behind."
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
        body="DollarAndGold AI is a private tool for this deployment's admin account."
        href="/dashboard"
        label="Back to your dashboard"
      />
    );
  }

  return (
    <div className="container py-12 sm:py-16">
      <div className="flex items-center gap-2 rounded-xl border border-gold/25 bg-gold/10 px-4 py-2.5 text-xs text-gold">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
        Private admin tool — not the public product, not financial advice.
        Nothing here executes a real trade without your explicit approval.
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
