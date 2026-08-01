import type { Metadata } from "next";

import { UsersView } from "@/components/admin/users-view";
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage() {
  const supabase = await getSupabaseServerClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, plan, is_admin, created_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Every signed-up account, its plan and its admin access.
      </p>

      <div className="mt-6">
        <UsersView profiles={data ?? []} currentUserId={user.id} />
      </div>
    </div>
  );
}
