"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/misc";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type Mode = "sign-in" | "sign-up";

/**
 * Email + password auth against Supabase.
 *
 * In demo mode there is no auth provider, so rather than showing a form that
 * cannot work, the component explains what is missing and points at the
 * dashboard — which is fully functional without an account.
 */
export function SignInForm() {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>("sign-in");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [checkEmail, setCheckEmail] = React.useState(false);

  if (!isSupabaseConfigured()) {
    return (
      <Card className="p-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Accounts aren&apos;t configured
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          This deployment is running without Supabase credentials, so there is
          nothing to sign in to. Every feature still works — your watchlist,
          notes and journal are saved in this browser.
        </p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">Open the dashboard</Link>
        </Button>
        <p className="mt-6 text-xs text-muted-foreground">
          To enable accounts, set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
        </p>
      </Card>
    );
  }

  if (checkEmail) {
    return (
      <Card className="p-8 text-center">
        <MailCheck className="mx-auto h-8 w-8 text-gold" />
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          Check your inbox
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          We sent a confirmation link to{" "}
          <span className="text-foreground/85">{email}</span>. Open it to finish
          creating your account.
        </p>
      </Card>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const client = getSupabaseBrowserClient();
    if (!client) return;

    if (password.length < 8) {
      toast.error("Use at least 8 characters for your password.");
      return;
    }

    setPending(true);
    try {
      if (mode === "sign-up") {
        const { error } = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo:
              typeof window !== "undefined"
                ? `${window.location.origin}/dashboard`
                : undefined,
          },
        });
        if (error) throw error;
        setCheckEmail(true);
        return;
      }

      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;

      toast.success("Signed in");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="p-8">
      <h1 className="text-xl font-semibold tracking-tight">
        {mode === "sign-in" ? "Sign in" : "Create your account"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {mode === "sign-in"
          ? "Pick up your watchlist, notes and journal on any device."
          : "Free forever. No card, no broker account."}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
          />
        </div>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "sign-in" ? "No account yet?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {mode === "sign-in" ? "Create one" : "Sign in"}
        </button>
      </p>
    </Card>
  );
}
