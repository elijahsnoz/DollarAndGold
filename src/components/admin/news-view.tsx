"use client";

import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label, Switch } from "@/components/ui/misc";
import { NEWS_CATEGORIES } from "@/lib/news/types";
import type {
  ImpactDirection,
  ImpactMagnitude,
  NewsCategory,
} from "@/lib/news/types";

export interface AdminArticle {
  id: string;
  headline: string;
  source: string;
  category: NewsCategory;
  symbols: string[];
  summary: string;
  why_it_matters: string;
  impact_direction: ImpactDirection;
  impact_magnitude: ImpactMagnitude;
  impact_note: string;
  url: string | null;
  published: boolean;
  published_at: string;
}

const DIRECTIONS: ImpactDirection[] = ["bullish", "bearish", "mixed"];
const MAGNITUDES: ImpactMagnitude[] = ["low", "moderate", "high"];

/** Content moderation — the news half of the admin dashboard. */
export function NewsAdminView({ articles }: { articles: AdminArticle[] }) {
  const [rows, setRows] = React.useState(articles);
  const [editing, setEditing] = React.useState<AdminArticle | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (article: AdminArticle) => {
    setEditing(article);
    setDialogOpen(true);
  };

  const onSaved = (article: AdminArticle) => {
    setRows((prev) => {
      const exists = prev.some((r) => r.id === article.id);
      return exists
        ? prev.map((r) => (r.id === article.id ? article : r))
        : [article, ...prev];
    });
    setDialogOpen(false);
  };

  const togglePublished = async (article: AdminArticle) => {
    const previous = rows;
    setRows((prev) =>
      prev.map((r) =>
        r.id === article.id ? { ...r, published: !r.published } : r,
      ),
    );

    try {
      const response = await fetch(`/api/admin/news/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !article.published }),
      });
      if (!response.ok) throw new Error();
    } catch {
      setRows(previous);
      toast.error("Couldn't update that article.");
    }
  };

  const remove = async (id: string) => {
    const previous = rows;
    setRows((prev) => prev.filter((r) => r.id !== id));

    try {
      const response = await fetch(`/api/admin/news/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      toast.success("Article deleted");
    } catch {
      setRows(previous);
      toast.error("Couldn't delete that article.");
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} article{rows.length === 1 ? "" : "s"}
        </p>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreate}>
              <Plus />
              New article
            </Button>
          </DialogTrigger>
          <ArticleDialog article={editing} onSaved={onSaved} />
        </Dialog>
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 py-8 text-center text-sm text-muted-foreground">
          Nothing published yet — the sample feed is showing in its place.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {rows.map((article) => (
            <li key={article.id} className="rounded-2xl border border-border/60 p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {article.category}
                    </Badge>
                    <Badge variant={article.published ? "bull" : "neutral"}>
                      {article.published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm font-medium">{article.headline}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {article.source}
                    {article.symbols.length > 0 && ` · ${article.symbols.join(", ")}`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Switch
                    checked={article.published}
                    onCheckedChange={() => togglePublished(article)}
                    aria-label={`Toggle published state for ${article.headline}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openEdit(article)}
                    aria-label={`Edit ${article.headline}`}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(article.id)}
                    aria-label={`Delete ${article.headline}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ArticleDialog({
  article,
  onSaved,
}: {
  article: AdminArticle | null;
  onSaved: (article: AdminArticle) => void;
}) {
  const [form, setForm] = React.useState(() => toFormState(article));
  const [pending, setPending] = React.useState(false);

  // Re-seed whenever the target article changes (switching from create to
  // edit, or between two different edits) rather than on every render.
  React.useEffect(() => setForm(toFormState(article)), [article]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);

    const body = {
      headline: form.headline.trim(),
      source: form.source.trim(),
      category: form.category,
      symbols: form.symbols
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
      summary: form.summary.trim(),
      why_it_matters: form.whyItMatters.trim(),
      impact_direction: form.impactDirection,
      impact_magnitude: form.impactMagnitude,
      impact_note: form.impactNote.trim(),
      url: form.url.trim() || null,
      published: form.published,
    };

    try {
      const response = await fetch(
        article ? `/api/admin/news/${article.id}` : "/api/admin/news",
        {
          method: article ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) throw new Error();
      const { article: saved } = await response.json();
      onSaved(saved);
      toast.success(article ? "Article updated" : "Article created");
    } catch {
      toast.error("Couldn't save that article.");
    } finally {
      setPending(false);
    }
  };

  return (
    <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{article ? "Edit article" : "New article"}</DialogTitle>
      </DialogHeader>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="article-headline">Headline</Label>
          <Input
            id="article-headline"
            value={form.headline}
            onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="article-source">Source</Label>
            <Input
              id="article-source"
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="article-category">Category</Label>
            <select
              id="article-category"
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value as NewsCategory }))
              }
              className="h-10 w-full rounded-xl border border-input bg-foreground/[0.03] px-3 text-sm focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
            >
              {NEWS_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="article-symbols">Symbols (comma-separated)</Label>
          <Input
            id="article-symbols"
            value={form.symbols}
            onChange={(e) => setForm((f) => ({ ...f, symbols: e.target.value }))}
            placeholder="XAUUSD, EURUSD"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="article-summary">30-second summary</Label>
          <Textarea
            id="article-summary"
            value={form.summary}
            onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            className="min-h-20"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="article-why">Why it matters</Label>
          <Textarea
            id="article-why"
            value={form.whyItMatters}
            onChange={(e) => setForm((f) => ({ ...f, whyItMatters: e.target.value }))}
            className="min-h-20"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="article-direction">Impact direction</Label>
            <select
              id="article-direction"
              value={form.impactDirection}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  impactDirection: e.target.value as ImpactDirection,
                }))
              }
              className="h-10 w-full rounded-xl border border-input bg-foreground/[0.03] px-3 text-sm capitalize focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
            >
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="article-magnitude">Impact magnitude</Label>
            <select
              id="article-magnitude"
              value={form.impactMagnitude}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  impactMagnitude: e.target.value as ImpactMagnitude,
                }))
              }
              className="h-10 w-full rounded-xl border border-input bg-foreground/[0.03] px-3 text-sm capitalize focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
            >
              {MAGNITUDES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="article-impact-note">Impact note</Label>
          <Textarea
            id="article-impact-note"
            value={form.impactNote}
            onChange={(e) => setForm((f) => ({ ...f, impactNote: e.target.value }))}
            className="min-h-16"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="article-url">Source URL (optional)</Label>
          <Input
            id="article-url"
            type="url"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            placeholder="https://…"
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border/60 px-3.5 py-2.5">
          <Label htmlFor="article-published">Published</Label>
          <Switch
            id="article-published"
            checked={form.published}
            onCheckedChange={(checked) => setForm((f) => ({ ...f, published: checked }))}
          />
        </div>

        <Button type="submit" className="w-full" disabled={pending}>
          {article ? "Save changes" : "Publish"}
        </Button>
      </form>
    </DialogContent>
  );
}

function toFormState(article: AdminArticle | null) {
  return {
    headline: article?.headline ?? "",
    source: article?.source ?? "",
    category: (article?.category ?? "economy") as NewsCategory,
    symbols: article?.symbols.join(", ") ?? "",
    summary: article?.summary ?? "",
    whyItMatters: article?.why_it_matters ?? "",
    impactDirection: (article?.impact_direction ?? "mixed") as ImpactDirection,
    impactMagnitude: (article?.impact_magnitude ?? "moderate") as ImpactMagnitude,
    impactNote: article?.impact_note ?? "",
    url: article?.url ?? "",
    published: article?.published ?? true,
  };
}
