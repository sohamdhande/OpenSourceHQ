"use client";

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Flame,
  Github,
  Link as LinkIcon,
  Loader2,
  Lock,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";

interface LinkItem {
  url: string;
  label: string;
  type: string;
}

interface SelfDailyLogClientProps {
  organizationId: string;
  orgSlug: string;
  defaultDate: string;
  initialStreak: number;
  initialLoggedDates: string[];
  initialReport: {
    id: string;
    reportDate: string;
    workDone: string;
    learning: string;
    blockers: string;
    nextSteps: string;
    hoursSpent: number | null;
    status: string;
    links: LinkItem[];
  } | null;
}

const HOUR_PRESETS = ["1", "2", "4", "6", "8"];

export function SelfDailyLogClient({
  organizationId,
  orgSlug,
  defaultDate,
  initialStreak,
  initialLoggedDates,
  initialReport,
}: SelfDailyLogClientProps) {
  const router = useRouter();
  const [reportDate, setReportDate] = useState(initialReport?.reportDate || defaultDate);
  const [loggedDates, setLoggedDates] = useState<string[]>(initialLoggedDates);
  const [currentStatus, setCurrentStatus] = useState<string | null>(initialReport?.status || null);
  const [workDone, setWorkDone] = useState(initialReport?.workDone || "");
  const [learning, setLearning] = useState(initialReport?.learning || "");
  const [blockers, setBlockers] = useState(initialReport?.blockers || "");
  const [nextSteps, setNextSteps] = useState(initialReport?.nextSteps || "");
  const [hoursSpent, setHoursSpent] = useState(
    initialReport?.hoursSpent != null ? String(initialReport.hoursSpent) : "2"
  );
  const [links, setLinks] = useState<LinkItem[]>(initialReport?.links || []);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

  const [loadingDate, setLoadingDate] = useState(false);
  const [importingGithub, setImportingGithub] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const last7Days = useMemo(() => {
    const base = new Date(`${defaultDate}T00:00:00.000Z`);
    const loggedSet = new Set(loggedDates);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() - (6 - i));
      const key = d.toISOString().split("T")[0];
      return {
        key,
        weekday: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
        dayNum: d.getUTCDate(),
        logged: loggedSet.has(key),
      };
    });
  }, [defaultDate, loggedDates]);

  const loadDateReport = useCallback(
    async (dateStr: string) => {
      setReportDate(dateStr);
      setFeedback(null);
      setLoadingDate(true);
      try {
        const res = await fetch(
          `/api/reports?organizationId=${encodeURIComponent(organizationId)}&mode=self&reportDate=${encodeURIComponent(dateStr)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        const match = data.reports?.[0];
        if (match) {
          setCurrentStatus(match.status || null);
          setWorkDone(match.workDone || "");
          setLearning(match.learning || "");
          setBlockers(match.blockers || "");
          setNextSteps(match.nextSteps || "");
          setHoursSpent(match.hoursSpent != null ? String(match.hoursSpent) : "");
          setLinks(
            Array.isArray(match.links)
              ? match.links.map((l: LinkItem) => ({ url: l.url, label: l.label, type: l.type || "GITHUB" }))
              : []
          );
        } else {
          setCurrentStatus(null);
          setWorkDone("");
          setLearning("");
          setBlockers("");
          setNextSteps("");
          setHoursSpent("2");
          setLinks([]);
        }
      } catch {
        setFeedback({ type: "error", message: "Could not load log for selected date." });
      } finally {
        setLoadingDate(false);
      }
    },
    [organizationId]
  );

  const handleImportGitHub = async () => {
    setImportingGithub(true);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/github/my-activity?organizationId=${encodeURIComponent(organizationId)}&date=${encodeURIComponent(reportDate)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to fetch GitHub activity.");
      if (!data.connected) {
        setFeedback({
          type: "error",
          message: "Connect your GitHub account in Profile & Settings first to auto-import activity.",
        });
        return;
      }

      const items: Array<{ activityType: string; title: string; url: string | null; repoFullName: string | null }> =
        data.activities || [];
      if (items.length === 0) {
        setFeedback({
          type: "error",
          message: "No synced GitHub commits or PRs found for your selected repositories yet.",
        });
        return;
      }

      const bullets = items
        .slice(0, 6)
        .map((item) => `- [${item.repoFullName || "GitHub"}] ${item.title}`)
        .join("\n");

      setWorkDone((prev) => (prev.trim() ? `${prev.trim()}\n${bullets}` : bullets));

      const existingUrls = new Set(links.map((l) => l.url));
      const newLinks = items
        .filter((item) => item.url && !existingUrls.has(item.url))
        .slice(0, 6)
        .map((item) => ({
          url: item.url as string,
          label: item.title.slice(0, 60),
          type: item.activityType.startsWith("PULL_REQUEST") ? "PR" : "COMMIT",
        }));

      if (newLinks.length > 0) {
        setLinks((prev) => [...prev, ...newLinks]);
      }

      setFeedback({
        type: "success",
        message:
          data.scope === "date"
            ? `Imported ${items.length} GitHub event(s) from ${reportDate}.`
            : `No events on ${reportDate}; imported ${items.length} recent GitHub event(s).`,
      });
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Could not import GitHub activity.",
      });
    } finally {
      setImportingGithub(false);
    }
  };

  const addLink = () => {
    if (!newLinkLabel.trim() || !newLinkUrl.trim()) return;
    setLinks((prev) => [...prev, { label: newLinkLabel.trim(), url: newLinkUrl.trim(), type: "GITHUB" }]);
    setNewLinkLabel("");
    setNewLinkUrl("");
  };

  const handleSubmit = async (status: "DRAFT" | "SUBMITTED") => {
    setSaving(true);
    setFeedback(null);
    try {
      const parsedHours = hoursSpent.trim() ? Number(hoursSpent) : null;
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "self",
          organizationId,
          reportDate,
          workDone,
          learning,
          blockers: blockers.trim() || null,
          nextSteps,
          hoursSpent: parsedHours,
          status,
          links,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to save personal log");
      }

      setCurrentStatus(status);
      if (status === "SUBMITTED" && !loggedDates.includes(reportDate)) {
        setLoggedDates((prev) => [...prev, reportDate]);
      }
      setFeedback({
        type: "success",
        message: status === "DRAFT" ? "Personal draft saved." : `Personal daily log saved for ${reportDate}!`,
      });
      router.refresh();
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save personal log",
      });
    } finally {
      setSaving(false);
    }
  };

  const workReady = workDone.trim().length >= 5;
  const learningReady = learning.trim().length >= 5;
  const nextReady = nextSteps.trim().length >= 5;
  const readyCount = [workReady, learningReady, nextReady].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-emerald-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Engineering Journal</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Personal Daily Log
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-zinc-500" />
            Private to you — no cohort selection or mentor review queue.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href={`/org/${orgSlug}/self/reports`}>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-white/15 bg-white/[0.04] text-zinc-200 hover:bg-white/10 gap-1.5"
            >
              <FileText className="h-3.5 w-3.5" />
              Log History
            </Button>
          </Link>
        </div>
      </div>

      {/* 7-Day Interactive Date Switcher */}
      <div className="self-glass-surface rounded-xl p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="grid grid-cols-7 gap-1.5 flex-1">
          {last7Days.map((day) => {
            const isSelected = reportDate === day.key;
            return (
              <button
                key={day.key}
                type="button"
                disabled={loadingDate}
                onClick={() => loadDateReport(day.key)}
                className={`relative rounded-lg border px-2 py-2 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                  isSelected
                    ? "border-emerald-400/60 bg-emerald-500/15 text-white shadow-[0_0_20px_rgba(16,185,129,0.18)]"
                    : "border-white/10 bg-white/[0.02] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                }`}
              >
                <span className="block text-[10px] uppercase tracking-wider">{day.weekday}</span>
                <span className="mt-0.5 block text-xs font-mono font-semibold">{day.dayNum}</span>
                {day.logged && (
                  <span
                    aria-label="Logged"
                    className="mx-auto mt-1 block h-1.5 w-1.5 rounded-full bg-emerald-400"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0 lg:border-l lg:border-white/10 lg:pl-3">
          <Calendar className="h-4 w-4 text-zinc-400 shrink-0" />
          <input
            type="date"
            aria-label="Select custom log date"
            value={reportDate}
            disabled={loadingDate}
            onChange={(e) => loadDateReport(e.target.value)}
            className="h-9 rounded-lg border border-white/15 bg-black/50 px-2.5 text-xs font-mono text-zinc-100 focus:border-emerald-400/50 focus:outline-none"
          />
        </div>
      </div>

      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs ${
            feedback.type === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {feedback.type === "error" ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Writing Surface */}
        <div className={`lg:col-span-8 space-y-4 transition-opacity ${loadingDate ? "opacity-50 pointer-events-none" : ""}`}>
          {/* Work Completed Card */}
          <div className="self-glass-surface rounded-xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-white">Work Completed</h2>
                <p className="text-[11px] text-zinc-400">
                  Summarize commits, PRs, code reviews, or docs shipped today.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={importingGithub}
                onClick={handleImportGitHub}
                className="border-white/15 bg-white/[0.04] text-zinc-100 hover:bg-white/10 gap-1.5 h-8 text-xs"
              >
                {importingGithub ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Github className="h-3.5 w-3.5 text-emerald-400" />
                )}
                {importingGithub ? "Importing..." : "Import from GitHub"}
              </Button>
            </div>
            <Textarea
              rows={5}
              placeholder="- Opened PR #42 to fix hydration race condition&#10;- Reviewed 2 community PRs on layer5..."
              value={workDone}
              onChange={(e) => setWorkDone(e.target.value)}
              className="bg-black/40 border-white/15 text-zinc-100 leading-relaxed"
              required
            />
          </div>

          {/* Key Learnings & Next Steps Side-by-Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="self-glass-surface rounded-xl p-5 space-y-2.5">
              <h2 className="text-sm font-semibold text-white">Key Learnings</h2>
              <Textarea
                rows={4}
                placeholder="Architecture insights, debugging takeaways..."
                value={learning}
                onChange={(e) => setLearning(e.target.value)}
                className="bg-black/40 border-white/15 text-zinc-100 leading-relaxed"
                required
              />
            </div>

            <div className="self-glass-surface rounded-xl p-5 space-y-2.5">
              <h2 className="text-sm font-semibold text-white">Next Steps</h2>
              <Textarea
                rows={4}
                placeholder="What you plan to tackle next session..."
                value={nextSteps}
                onChange={(e) => setNextSteps(e.target.value)}
                className="bg-black/40 border-white/15 text-zinc-100 leading-relaxed"
                required
              />
            </div>
          </div>

          {/* Notes / Friction + Evidence Links */}
          <div className="self-glass-surface rounded-xl p-5 space-y-4">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-white">Friction / Notes (optional)</h2>
              <Textarea
                rows={2}
                placeholder="Any technical hurdles or reminders for yourself..."
                value={blockers}
                onChange={(e) => setBlockers(e.target.value)}
                className="bg-black/40 border-white/15 text-zinc-100"
              />
            </div>

            <div className="space-y-2.5 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <LinkIcon className="h-3.5 w-3.5 text-emerald-400" />
                  PR / Issue / Commit Links
                </label>
                <span className="text-[11px] font-mono text-zinc-400">{links.length} attached</span>
              </div>

              {links.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {links.map((link, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs"
                    >
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-300 hover:underline inline-flex items-center gap-1 max-w-[220px] truncate"
                      >
                        <span className="truncate">{link.label}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setLinks((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-zinc-400 hover:text-red-400 p-0.5"
                        aria-label={`Remove ${link.label}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                <Input
                  placeholder="Label (e.g. PR #42)"
                  value={newLinkLabel}
                  onChange={(e) => setNewLinkLabel(e.target.value)}
                  className="sm:col-span-2 bg-black/40 border-white/15 text-zinc-100"
                />
                <Input
                  placeholder="https://github.com/..."
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  className="sm:col-span-2 bg-black/40 border-white/15 text-zinc-100"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addLink}
                  className="border-white/15 bg-white/[0.04] text-zinc-100 hover:bg-white/10 gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sticky Context & Actions Rail */}
        <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-20">
          {/* Status & Streak Card */}
          <div className="self-glass-surface rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-semibold text-white">{initialStreak} day streak</span>
              </div>
              <Badge
                variant={currentStatus === "SUBMITTED" ? "success" : "secondary"}
                className="text-[10px]"
              >
                {currentStatus === "SUBMITTED"
                  ? "Logged"
                  : currentStatus === "DRAFT"
                    ? "Draft"
                    : "Not logged"}
              </Badge>
            </div>

            {/* Quick Hours Selector */}
            <div className="space-y-2 pt-3 border-t border-white/10">
              <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-sky-400" />
                Time Invested (hours)
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {HOUR_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setHoursSpent(preset)}
                    className={`rounded-md border py-1.5 text-xs font-mono transition-colors ${
                      hoursSpent === preset
                        ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-300 font-semibold"
                        : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-200"
                    }`}
                  >
                    {preset}h
                  </button>
                ))}
              </div>
              <Input
                type="number"
                min="0"
                max="24"
                step="0.5"
                aria-label="Custom hours spent"
                placeholder="Custom hours (e.g. 2.5)"
                value={hoursSpent}
                onChange={(e) => setHoursSpent(e.target.value)}
                className="bg-black/40 border-white/15 text-zinc-100 h-8 text-xs font-mono"
              />
            </div>

            {/* Readiness Checklist */}
            <div className="space-y-2 pt-3 border-t border-white/10 text-xs">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Completion</span>
                <span className="font-mono text-zinc-200">{readyCount}/3</span>
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className={`flex items-center gap-2 ${workReady ? "text-emerald-300" : "text-zinc-500"}`}>
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Work completed (min 5 chars)</span>
                </div>
                <div className={`flex items-center gap-2 ${learningReady ? "text-emerald-300" : "text-zinc-500"}`}>
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Key learnings (min 5 chars)</span>
                </div>
                <div className={`flex items-center gap-2 ${nextReady ? "text-emerald-300" : "text-zinc-500"}`}>
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Next steps (min 5 chars)</span>
                </div>
              </div>
            </div>

            {/* Save Actions */}
            <div className="space-y-2 pt-3 border-t border-white/10">
              <Button
                type="button"
                disabled={saving || loadingDate || readyCount < 3}
                onClick={() => handleSubmit("SUBMITTED")}
                className="w-full bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 gap-1.5"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {saving ? "Saving..." : currentStatus === "SUBMITTED" ? "Update Personal Log" : "Save Personal Log"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving || loadingDate || readyCount < 3}
                onClick={() => handleSubmit("DRAFT")}
                className="w-full border-white/15 bg-white/[0.04] text-zinc-200 hover:bg-white/10 gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                Save as Draft
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
