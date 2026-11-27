"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CheckSquare, Clock, Plus, Trash2 } from "lucide-react";

interface PersonalTask {
  id: string;
  title: string;
  description: string;
  priority: string;
  dueAt: string | null;
  repository?: { id: string; fullName: string } | null;
  status: "TODO" | "IN_PROGRESS" | "COMPLETED";
}

interface SelfTasksClientProps {
  organizationId: string;
  repositories: Array<{ id: string; fullName: string }>;
  initialTasks: PersonalTask[];
}

export function SelfTasksClient({ organizationId, repositories, initialTasks }: SelfTasksClientProps) {
  const [tasks, setTasks] = useState<PersonalTask[]>(initialTasks);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [repositoryId, setRepositoryId] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "self",
          organizationId,
          title,
          description,
          priority,
          repositoryId: repositoryId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to create personal task");

      const t = data.task;
      setTasks((prev) => [
        {
          id: t.id,
          title: t.title,
          description: t.description,
          priority: t.priority,
          dueAt: t.dueAt || null,
          repository: t.repository || null,
          status: "TODO",
        },
        ...prev,
      ]);
      setTitle("");
      setDescription("");
      setRepositoryId("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create personal task");
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (taskId: string, status: "TODO" | "IN_PROGRESS" | "COMPLETED") => {
    setBusyId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to update status");
      }
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (taskId: string) => {
    setBusyId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to delete task");
      }
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-white/10 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-sky-400" />
          Personal Open-Source Tasks
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Self-managed goals and milestones. Complete them directly without mentor review.
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
        <h2 className="text-sm font-semibold text-white">Add Personal Task</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            label="Task Title"
            placeholder="e.g. Fix hydration warning in PR #104"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="md:col-span-2 bg-black/40 border-white/15 text-zinc-100"
          />
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as "LOW" | "NORMAL" | "HIGH" | "URGENT")}
              className="h-9 w-full rounded-md border border-white/15 bg-black/40 px-3 text-xs text-zinc-100"
            >
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>
        <Textarea
          label="Description"
          rows={2}
          placeholder="Scope, issue link, or acceptance notes..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="bg-black/40 border-white/15 text-zinc-100"
        />
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="w-full sm:w-64">
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Repository (optional)</label>
            <select
              value={repositoryId}
              onChange={(e) => setRepositoryId(e.target.value)}
              className="h-9 w-full rounded-md border border-white/15 bg-black/40 px-3 text-xs text-zinc-100"
            >
              <option value="">None</option>
              {repositories.map((repo) => (
                <option key={repo.id} value={repo.id}>
                  {repo.fullName}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={creating}
            className="bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            {creating ? "Adding..." : "Create Task"}
          </Button>
        </div>
      </form>

      <div className="space-y-3">
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center text-xs text-zinc-400">
            No personal tasks yet. Add one above to get started.
          </div>
        ) : (
          tasks.map((task) => {
            const isBusy = busyId === task.id;
            return (
              <div
                key={task.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`text-sm font-semibold ${task.status === "COMPLETED" ? "line-through text-zinc-500" : "text-white"}`}>
                      {task.title}
                    </h3>
                    <Badge variant="secondary" className="text-[10px]">
                      {task.priority}
                    </Badge>
                    {task.repository && (
                      <span className="text-[11px] font-mono text-emerald-300">{task.repository.fullName}</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400">{task.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {task.status !== "IN_PROGRESS" && task.status !== "COMPLETED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => handleStatusChange(task.id, "IN_PROGRESS")}
                      className="h-7 text-[11px] border-white/15 bg-white/[0.04] text-zinc-200 hover:bg-white/10 gap-1"
                    >
                      <Clock className="h-3 w-3" />
                      Start
                    </Button>
                  )}
                  {task.status !== "COMPLETED" ? (
                    <Button
                      size="sm"
                      disabled={isBusy}
                      onClick={() => handleStatusChange(task.id, "COMPLETED")}
                      className="h-7 text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 gap-1"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Complete
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => handleStatusChange(task.id, "TODO")}
                      className="h-7 text-[11px] border-white/15 bg-white/[0.04] text-zinc-300 hover:bg-white/10"
                    >
                      Reopen
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isBusy}
                    onClick={() => handleDelete(task.id)}
                    aria-label={`Delete ${task.title}`}
                    className="h-7 px-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

