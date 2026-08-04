export interface NavItem {
  href: string;
  label: string;
  /** Requires a session in Supabase mode; still reachable in demo mode. */
  authOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  // The Desk sits first among the product surfaces: it is the page this
  // platform exists to be opened at each morning.
  { href: "/desk", label: "Desk" },
  { href: "/markets", label: "Markets" },
  { href: "/analysis", label: "Market Intelligence" },
  { href: "/compare", label: "Compare" },
  { href: "/news", label: "News" },
  { href: "/dashboard", label: "Dashboard", authOnly: true },
];
