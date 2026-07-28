"use client";

import * as React from "react";
import { NotebookPen, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/misc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fetchConditions } from "@/lib/context/client";
import { formatRelativeTime } from "@/lib/format";
import { ASSETS, getAsset } from "@/lib/market/catalog";
import { useWorkspace } from "@/lib/workspace/store";

/** Free-form notes, optionally pinned to a market. */
export function PersonalNotes() {
  const { state, deleteNote } = useWorkspace();

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Personal notes
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your own read, kept next to the analysis.
          </p>
        </div>
        <NoteDialog />
      </div>

      {state.notes.length === 0 ? (
        <div className="mt-6 flex flex-col items-center py-8 text-center">
          <NotebookPen className="h-5 w-5 text-muted-foreground" />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Nothing yet. Notes are the difference between remembering a level and
            re-deriving it every week.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {state.notes.slice(0, 6).map((note) => (
            <li key={note.id} className="rounded-2xl border border-border/60 p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{note.title}</p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {note.body}
                  </p>
                  <p className="mt-2.5 text-[11px] text-muted-foreground">
                    {note.symbol ? `${getAsset(note.symbol)?.name} · ` : ""}
                    {formatRelativeTime(note.updatedAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    deleteNote(note.id);
                    toast("Note deleted");
                  }}
                  aria-label={`Delete note ${note.title}`}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function NoteDialog() {
  const { saveNote } = useWorkspace();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [symbol, setSymbol] = React.useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error("Give the note a title and something to say.");
      return;
    }

    // Only meaningful when the note is about a specific market, and bounded so
    // it can never block someone saving their own words.
    const conditions = symbol ? await fetchConditions(symbol) : undefined;

    saveNote({
      title: title.trim(),
      body: body.trim(),
      symbol: symbol || undefined,
      context: conditions,
    });

    setTitle("");
    setBody("");
    setSymbol("");
    setOpen(false);
    toast.success("Note saved");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus />
          New note
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New note</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="note-title">Title</Label>
            <Input
              id="note-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Gold — watching 3,280"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note-symbol">Market (optional)</Label>
            <select
              id="note-symbol"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-foreground/[0.03] px-3 text-sm focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
            >
              <option value="">None</option>
              {ASSETS.map((asset) => (
                <option key={asset.symbol} value={asset.symbol}>
                  {asset.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note-body">Note</Label>
            <Textarea
              id="note-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="min-h-28"
              required
            />
          </div>

          <Button type="submit" className="w-full">
            Save note
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
