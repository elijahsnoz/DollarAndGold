"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Bot, LayoutDashboard, LogOut, Menu, Moon, Search, Shield, Sun, X } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { NAV_ITEMS } from "@/components/layout/nav-config";
import { CommandSearch } from "@/components/search/command-search";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsAdmin } from "@/lib/hooks/use-is-admin";
import { useWorkspace } from "@/lib/workspace/store";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const { user, demoMode, signOut } = useWorkspace();
  const isAdmin = useIsAdmin(user);

  // The header only earns its border and blur once content is behind it.
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => setMobileOpen(false), [pathname]);

  // ⌘K / Ctrl-K opens search from anywhere.
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 w-full transition-all duration-300",
          scrolled
            ? "border-b border-border/70 bg-background/80 backdrop-blur-xl"
            : "border-b border-transparent",
        )}
      >
        <div className="container flex h-16 items-center gap-4">
          <Link href="/" aria-label="DollarAndGold home" className="shrink-0">
            <Logo />
          </Link>

          <nav
            aria-label="Primary"
            className="ml-4 hidden items-center gap-0.5 lg:flex"
          >
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "relative rounded-full px-3 py-1.5 text-[13.5px] font-medium transition-colors",
                  isActive(item.href)
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {isActive(item.href) && (
                  <span className="absolute inset-0 -z-10 rounded-full bg-foreground/[0.07]" />
                )}
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden items-center gap-2 rounded-full border border-border/70 bg-foreground/[0.03] py-1.5 pl-3 pr-2 text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground sm:flex"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="pr-6">Search markets</span>
              <kbd className="rounded border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] font-medium">
                ⌘K
              </kbd>
            </button>

            <Button
              variant="ghost"
              size="icon-sm"
              className="sm:hidden"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <Search />
            </Button>

            <ThemeToggle />

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-gold-soft to-gold text-[13px] font-semibold text-primary-foreground"
                    aria-label="Account menu"
                  >
                    {(user.email ?? "?").charAt(0).toUpperCase()}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">
                    {user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard">
                      <LayoutDashboard />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin">
                        <Shield />
                        Admin
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/ai-trader">
                        <Bot />
                        AI Trader
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => void signOut()}>
                    <LogOut />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href={demoMode ? "/dashboard" : "/sign-in"}>
                  {demoMode ? "Open dashboard" : "Sign In"}
                </Link>
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setMobileOpen((open) => !open)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <nav
            aria-label="Mobile"
            className="animate-fade-up border-t border-border/70 bg-background/95 backdrop-blur-xl lg:hidden"
          >
            <div className="container flex flex-col py-3">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-foreground/[0.06] text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {item.label}
                </Link>
              ))}
              {!user && !demoMode && (
                <Button asChild className="mt-3">
                  <Link href="/sign-in">Sign In</Link>
                </Button>
              )}
            </div>
          </nav>
        )}
      </header>

      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Theme is unknown until hydration; render a stable placeholder until then.
  React.useEffect(() => setMounted(true), []);

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
      aria-label="Toggle theme"
    >
      {mounted && resolvedTheme === "light" ? <Moon /> : <Sun />}
    </Button>
  );
}
