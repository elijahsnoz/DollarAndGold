import type { Metadata } from "next";
import Link from "next/link";

import { SignInForm } from "@/components/auth/sign-in-form";
import { Logo } from "@/components/layout/logo";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to DollarAndGold to sync your watchlist, notes and journal.",
  robots: { index: false, follow: true },
};

export default function SignInPage() {
  return (
    <div className="aurora relative isolate flex min-h-[calc(100dvh-4rem)] items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mx-auto flex w-fit" aria-label="DollarAndGold home">
          <Logo />
        </Link>

        <div className="mt-8">
          <SignInForm />
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          DollarAndGold is a research platform. It is not a broker, not an
          exchange, and nothing here is financial advice.
        </p>
      </div>
    </div>
  );
}
