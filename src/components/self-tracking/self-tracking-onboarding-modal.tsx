"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, GitBranch, Flame, CheckSquare, AlertCircle, FolderGit2, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SelfTrackingOnboardingModalProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  orgSlug: string;
}

export function SelfTrackingOnboardingModal({
  open,
  onClose,
  orgId,
  orgSlug,
}: SelfTrackingOnboardingModalProps) {
  const router = useRouter();
  const [enabling, setEnabling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleEnable = async () => {
    setEnabling(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/self-tracking/enable`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to enable self-tracking");
      }
      onClose();
      router.push(`/org/${orgSlug}/self`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to enable self-tracking");
    } finally {
      setEnabling(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="self-tracking-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950/90 p-6 md:p-7 text-zinc-100 shadow-[0_24px_80px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
        <button
          type="button"
          onClick={onClose}
          disabled={enabling}
          aria-label="Close modal"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-emerald-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400/90">
              Personal Workspace
            </span>
            <h2 id="self-tracking-modal-title" className="text-lg font-bold tracking-tight text-white">
              Track Your Open Source Journey
            </h2>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-zinc-300">
          Do you also contribute to open-source projects? Enable your personal workspace to track your GitHub activity, daily progress, repositories, tasks, blockers, and learning milestones independently of your mentorship responsibilities.
        </p>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <GitBranch className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-zinc-100">GitHub Telemetry</p>
              <p className="text-zinc-400 mt-0.5">Track commits, PRs, and issues on your own repos.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <Flame className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-zinc-100">Daily Logs &amp; Streaks</p>
              <p className="text-zinc-400 mt-0.5">Private daily work logs with zero mentor review.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <CheckSquare className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-zinc-100">Personal Tasks</p>
              <p className="text-zinc-400 mt-0.5">Self-managed goals and completion tracking.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <FolderGit2 className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-zinc-100">Independent &amp; Private</p>
              <p className="text-zinc-400 mt-0.5">Separate from cohorts, mentees, and org analytics.</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={enabling}
            className="border border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/10 hover:text-white"
          >
            Not Now
          </Button>
          <Button
            type="button"
            onClick={handleEnable}
            disabled={enabling}
            className="bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 gap-1.5"
          >
            {enabling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enabling...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Enable Self-Tracking
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

