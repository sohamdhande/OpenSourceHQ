"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Settings, Github, ExternalLink, PowerOff } from "lucide-react";

interface SelfProfileClientProps {
  orgId: string;
  orgSlug: string;
  orgName: string;
  role: string;
  userName: string;
  userEmail: string;
  timezone: string;
  selfTrackingEnabledAt: string | null;
  githubConfigured: boolean;
  githubAccount: { username: string; profileUrl: string } | null;
}

export function SelfProfileClient({
  orgId,
  orgSlug,
  orgName,
  role,
  userName,
  userEmail,
  timezone,
  selfTrackingEnabledAt,
  githubConfigured,
  githubAccount,
}: SelfProfileClientProps) {
  const router = useRouter();
  const [disabling, setDisabling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDisable = async () => {
    if (!confirm("Disable your self-tracking workspace? Your personal logs, tasks, blockers, and repositories will be preserved if you re-enable later.")) {
      return;
    }
    setDisabling(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/self-tracking/disable`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to disable self-tracking");
      router.push(`/org/${orgSlug}/${role === "MENTOR" ? "mentor" : "admin"}`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to disable self-tracking");
    } finally {
      setDisabling(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="border-b border-white/10 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Settings className="h-5 w-5 text-zinc-300" />
          Self-Tracking Profile &amp; Preferences
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Manage your personal GitHub connection and self-tracking status in {orgName}.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl space-y-3 text-xs">
        <h2 className="text-sm font-semibold text-white">Identity</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span className="text-zinc-400 block">Name</span>
            <span className="font-medium text-zinc-100">{userName}</span>
          </div>
          <div>
            <span className="text-zinc-400 block">Email</span>
            <span className="font-mono text-zinc-100">{userEmail}</span>
          </div>
          <div>
            <span className="text-zinc-400 block">Timezone</span>
            <span className="font-mono text-zinc-100">{timezone}</span>
          </div>
          <div>
            <span className="text-zinc-400 block">Self-Tracking Enabled</span>
            <span className="font-mono text-emerald-300">
              {selfTrackingEnabledAt ? new Date(selfTrackingEnabledAt).toLocaleDateString() : "Active"}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl space-y-3 text-xs">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Github className="h-4 w-4" /> GitHub Connection
        </h2>
        {githubAccount ? (
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
            <a
              href={githubAccount.profileUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-emerald-300 hover:underline inline-flex items-center gap-1.5"
            >
              @{githubAccount.username}
              <ExternalLink className="h-3 w-3" />
            </a>
            <span className="text-[11px] text-emerald-400 font-medium">Connected</span>
          </div>
        ) : githubConfigured ? (
          <Link href="/api/auth/github?mode=link">
            <Button size="sm" className="bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 gap-1.5">
              <Github className="h-4 w-4" />
              Connect GitHub Account
            </Button>
          </Link>
        ) : (
          <p className="text-zinc-400">GitHub OAuth is not configured on this server.</p>
        )}
      </div>

      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 backdrop-blur-xl space-y-3 text-xs">
        <h2 className="text-sm font-semibold text-red-200">Disable Personal Self-Tracking</h2>
        <p className="text-zinc-400">
          Hides your personal workspace in this organization without deleting your historical logs, tasks, blockers, or repository selections.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={disabling}
          onClick={handleDisable}
          className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 gap-1.5"
        >
          <PowerOff className="h-3.5 w-3.5" />
          {disabling ? "Disabling..." : "Disable Self-Tracking"}
        </Button>
      </div>
    </div>
  );
}

