"use client";

import * as React from "react";
import type { User } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** Whether the given user has `is_admin` set, for showing the admin nav link. */
export function useIsAdmin(user: User | null): boolean {
  const [isAdmin, setIsAdmin] = React.useState(false);

  React.useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    const client = getSupabaseBrowserClient();
    if (!client) return;

    let active = true;
    client
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (active) setIsAdmin(data?.is_admin ?? false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  return isAdmin;
}
