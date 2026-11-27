"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Plus } from "lucide-react";

interface PersonalBlocker {
  id: string;
  title: string;
  description: string;
  urgency: string;
  status: string;
  response?: string | null;
  createdAt: string;
}

export function SelfBlockersClient({
  organizationId,
  initialBlockers,
}: {
  organizationId: string;
  initialBlockers: PersonalBlocker[];
}) {
  const [blockers, setBlockers] = useState<PersonalBlocker[]>(initialBlockers);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("MEDIUM");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/blockers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "self",
          organizationId,
          title,
          description,
          urgency,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to log blocker");
      const b = data.blocker;
      setBlockers((prev) => [
        {
          id: b.id,
          title: b.title,
          description: b.description,
          urgency: b.urgency,
          status: b.status,
          response: b.response,
          createdAt: b.createdAt,
        },
        ...prev,
      ]);
      setTitle("");
      setDescription("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to log blocker");
    } finally {
      setCreating(false);
    }
  };

  const handleResolve = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/blockers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RESOLVED", response: "Resolved personally." }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to resolve blocker");
      setBlockers((prev) => prev.map((b) => (b.id === id ? { ...b, status: "RESOLVED" } : b)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resolve blocker");
    } finally {
      setBusyId(null);
    }
  };

  const handleReopen = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/blockers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REOPEN" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to reopen blocker");
      setBlockers((prev) => prev.map((b) => (b.id === id ? { ...b, status: "REOPENED" } : b)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reopen blocker");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-white/10 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-rose-400" />
          Personal Technical Blockers
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Track debugging hurdles and resolve them yourself — completely private, with no mentor escalation.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
          {error}
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl space-y-4"
      >
        <h2 className="text-sm font-semibold text-white">Log Personal Blocker</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            label="Title"
            placeholder="e.g. Failing Docker build on ARM64"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="md:col-span-2 bg-black/40 border-white/15 text-zinc-100"
          />
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Urgency</label>
            <select
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL")}
              className="h-9 w-full rounded-md border border-white/15 bg-black/40 px-3 text-xs text-zinc-100"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>
        <Textarea
          label="Details"
          rows={2}
          placeholder="Context, stack trace, or investigation notes..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="bg-black/40 border-white/15 text-zinc-100"
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={creating}
            className="bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            {creating ? "Saving..." : "Log Blocker"}
          </Button>
        </div>
      </form>

      <div className="space-y-3">
        {blockers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center text-xs text-zinc-400">
            No personal blockers logged.
          </div>
        ) : (
          blockers.map((b) => (
            <div
              key={b.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-white">{b.title}</h3>
                  <Badge variant={b.status === "RESOLVED" ? "success" : "secondary"} className="text-[10px]">
                    {b.status}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] border-white/15 text-zinc-300">
                    {b.urgency}
                  </Badge>
                </div>
                <p className="text-xs text-zinc-400">{b.description}</p>
              </div>
              <div className="shrink-0">
                {b.status !== "RESOLVED" ? (
                  <Button
                    size="sm"
                    disabled={busyId === b.id}
                    onClick={() => handleResolve(b.id)}
                    className="h-7 text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 gap-1"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Mark Resolved
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === b.id}
                    onClick={() => handleReopen(b.id)}
                    className="h-7 text-[11px] border-white/15 bg-white/[0.04] text-zinc-300 hover:bg-white/10"
                  >
                    Reopen
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

