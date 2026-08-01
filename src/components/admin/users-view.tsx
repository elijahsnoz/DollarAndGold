"use client";

import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";
import { formatRelativeTime } from "@/lib/format";

type Plan = "free" | "pro" | "enterprise";

export interface AdminProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  plan: string;
  is_admin: boolean;
  created_at: string;
}

const PLANS: Plan[] = ["free", "pro", "enterprise"];

/** Users & plan management — the accounts half of the admin dashboard. */
export function UsersView({
  profiles,
  currentUserId,
}: {
  profiles: AdminProfile[];
  currentUserId: string;
}) {
  const [rows, setRows] = React.useState(profiles);
  const [query, setQuery] = React.useState("");

  const filtered = rows.filter((row) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      row.email?.toLowerCase().includes(q) ||
      row.full_name?.toLowerCase().includes(q)
    );
  });

  const patch = async (id: string, body: { plan?: Plan; is_admin?: boolean }) => {
    const previous = rows;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...body } : r)));

    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error();
      toast.success("Updated");
    } catch {
      setRows(previous);
      toast.error("Couldn't save that change.");
    }
  };

  return (
    <Card className="p-6">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by email or name…"
        className="max-w-xs"
      />

      {filtered.length === 0 ? (
        <p className="mt-8 py-8 text-center text-sm text-muted-foreground">
          No users match that search.
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-3 font-medium">User</th>
                <th className="pb-3 font-medium">Joined</th>
                <th className="pb-3 font-medium">Plan</th>
                <th className="pb-3 font-medium">Admin</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-border/40 last:border-0">
                  <td className="py-3 pr-4">
                    <p className="font-medium">{row.email ?? "—"}</p>
                    {row.full_name && (
                      <p className="text-xs text-muted-foreground">{row.full_name}</p>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {formatRelativeTime(new Date(row.created_at).getTime())}
                  </td>
                  <td className="py-3 pr-4">
                    <select
                      value={row.plan}
                      onChange={(event) =>
                        patch(row.id, { plan: event.target.value as Plan })
                      }
                      className="h-9 rounded-xl border border-input bg-foreground/[0.03] px-2.5 text-sm capitalize focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                    >
                      {PLANS.map((plan) => (
                        <option key={plan} value={plan}>
                          {plan}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3">
                    {row.id === currentUserId ? (
                      <Badge variant="outline" title="You can't remove your own admin access here.">
                        You
                      </Badge>
                    ) : (
                      <Switch
                        checked={row.is_admin}
                        onCheckedChange={(checked) => patch(row.id, { is_admin: checked })}
                        aria-label={`Toggle admin access for ${row.email ?? row.id}`}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
