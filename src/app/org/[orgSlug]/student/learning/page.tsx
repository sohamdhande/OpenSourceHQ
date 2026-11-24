"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Award, BookOpen, CheckCircle2, Clock3, ExternalLink, Loader2, LockKeyhole, Send, TriangleAlert } from "lucide-react";

type MilestoneStatus = "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "CHANGES_REQUESTED" | "RESUBMITTED" | "APPROVED";
type MenteeMilestone = { id: string; status: MilestoneStatus; notes: string | null; evidenceUrl: string | null; reviewComment: string | null; reviewedAt: string | null; updatedAt: string };
type PathMilestone = { id: string; title: string; description: string | null; sortOrder: number; skill: { id: string; name: string; category: string } | null; menteeMilestones: MenteeMilestone[] };
type LearningPath = { id: string; title: string; description: string | null; cohort: { id: string; name: string } | null; milestones: PathMilestone[] };

const statusVariant: Record<MilestoneStatus, "secondary" | "success" | "warning" | "cyan"> = {
  NOT_STARTED: "secondary", IN_PROGRESS: "cyan", SUBMITTED: "warning", RESUBMITTED: "warning", CHANGES_REQUESTED: "warning", APPROVED: "success",
};
const statusLabel: Record<MilestoneStatus, string> = {
  NOT_STARTED: "Not started", IN_PROGRESS: "In progress", SUBMITTED: "Awaiting review", RESUBMITTED: "Resubmitted", CHANGES_REQUESTED: "Changes requested", APPROVED: "Approved",
};

export default function StudentLearningPage({ params }: { params: { orgSlug: string } }) {
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { notes: string; evidenceUrl: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadPaths = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sessionResponse = await fetch(`/api/auth/session?orgSlug=${encodeURIComponent(params.orgSlug)}`, { cache: "no-store" });
      const sessionData = await sessionResponse.json();
      const organizationId = sessionData.user?.activeOrgId;
      if (!organizationId) throw new Error("No active organization was found for your session.");
      const response = await fetch(`/api/learning/paths?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Could not load learning paths.");
      const nextPaths = (data.paths || []) as LearningPath[];
      setPaths(nextPaths);
      setExpandedId((current) => current || nextPaths[0]?.id || null);
      setDrafts((current) => {
        const next = { ...current };
        for (const path of nextPaths) for (const milestone of path.milestones) {
          const submission = milestone.menteeMilestones?.[0];
          if (!next[milestone.id] && submission) next[milestone.id] = { notes: submission.notes || "", evidenceUrl: submission.evidenceUrl || "" };
        }
        return next;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load learning paths.");
    } finally {
      setLoading(false);
    }
  }, [params.orgSlug]);

  useEffect(() => { void loadPaths(); }, [loadPaths]);

  const submitEvidence = async (milestoneId: string) => {
    const draft = drafts[milestoneId] || { notes: "", evidenceUrl: "" };
    if (draft.notes.trim().length < 3) { setError("Describe what you completed in at least three characters."); return; }
    if (draft.evidenceUrl.trim()) {
      try { new URL(draft.evidenceUrl.trim()); } catch { setError("Enter a valid evidence URL or leave the field empty."); return; }
    }
    setSavingId(milestoneId); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/learning/milestones/${encodeURIComponent(milestoneId)}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: draft.notes, evidenceUrl: draft.evidenceUrl.trim() || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Could not submit evidence.");
      setNotice("Evidence submitted. Your mentor will be notified for review.");
      await loadPaths();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit evidence.");
    } finally { setSavingId(null); }
  };

  const milestoneCount = paths.reduce((count, path) => count + path.milestones.length, 0);
  const approvedCount = paths.reduce((count, path) => count + path.milestones.filter((item) => item.menteeMilestones?.[0]?.status === "APPROVED").length, 0);
  const pendingCount = paths.reduce((count, path) => count + path.milestones.filter((item) => ["SUBMITTED", "RESUBMITTED"].includes(item.menteeMilestones?.[0]?.status || "")).length, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-eyebrow"><BookOpen className="h-3.5 w-3.5" /> DEVELOPMENT PLAN</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Learning paths</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Work through the milestones assigned to your organization or cohort. Submit evidence when you are ready for mentor review.</p>
        </div>
        <Badge variant="outline" className="h-8 gap-1.5 self-start px-3 sm:self-auto"><LockKeyhole className="h-3.5 w-3.5" /> Private evidence submissions</Badge>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="metric-surface"><CardContent className="flex items-center gap-3 p-4"><div className="metric-icon"><BookOpen className="h-4 w-4" /></div><div><p className="text-xs text-muted-foreground">Assigned milestones</p><p className="mt-0.5 text-2xl font-semibold tabular-nums">{loading ? "—" : milestoneCount}</p></div></CardContent></Card>
        <Card className="metric-surface"><CardContent className="flex items-center gap-3 p-4"><div className="metric-icon"><CheckCircle2 className="h-4 w-4" /></div><div><p className="text-xs text-muted-foreground">Approved</p><p className="mt-0.5 text-2xl font-semibold tabular-nums">{loading ? "—" : approvedCount}</p></div></CardContent></Card>
        <Card className="metric-surface"><CardContent className="flex items-center gap-3 p-4"><div className="metric-icon"><Clock3 className="h-4 w-4" /></div><div><p className="text-xs text-muted-foreground">Awaiting review</p><p className="mt-0.5 text-2xl font-semibold tabular-nums">{loading ? "—" : pendingCount}</p></div></CardContent></Card>
      </section>

      {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</div>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading assigned learning paths…</div>
      ) : paths.length === 0 ? (
        <Card className="border-dashed"><CardContent className="flex flex-col items-center px-6 py-14 text-center"><div className="empty-icon"><Award className="h-6 w-6" /></div><h2 className="mt-4 text-base font-semibold">No learning paths assigned yet</h2><p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">Your organization administrator or mentor has not published a learning path for your organization or active cohort. Once one is assigned, its milestones will appear here.</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {paths.map((path) => {
            const expanded = expandedId === path.id;
            const pathApproved = path.milestones.filter((item) => item.menteeMilestones?.[0]?.status === "APPROVED").length;
            const pathProgress = path.milestones.length ? Math.round(pathApproved / path.milestones.length * 100) : 0;
            return <Card key={path.id} className="overflow-hidden">
              <button type="button" aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : path.id)} className="flex w-full items-start justify-between gap-4 p-5 text-left transition-colors hover:bg-muted/20 sm:p-6">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><CardTitle className="text-base">{path.title}</CardTitle><Badge variant={path.cohort ? "cyan" : "outline"}>{path.cohort?.name || "Organization-wide"}</Badge></div>{path.description && <CardDescription className="mt-2 max-w-3xl text-sm leading-6">{path.description}</CardDescription>}<div className="mt-4 flex items-center gap-3"><div className="h-1.5 w-44 max-w-[45vw] overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pathProgress}%` }} /></div><span className="text-xs tabular-nums text-muted-foreground">{pathApproved}/{path.milestones.length} approved</span></div></div>
                <span className="shrink-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground">{expanded ? "Collapse" : "View milestones"}</span>
              </button>
              {expanded && <CardContent className="space-y-3 border-t border-border/70 bg-muted/10 p-4 sm:p-5">
                {path.milestones.length === 0 ? <p className="text-sm text-muted-foreground">This learning path has no milestones yet.</p> : path.milestones.map((milestone, index) => {
                  const submission = milestone.menteeMilestones?.[0];
                  const status = submission?.status || "NOT_STARTED";
                  const canSubmit = ["NOT_STARTED", "IN_PROGRESS", "CHANGES_REQUESTED"].includes(status);
                  const draft = drafts[milestone.id] || { notes: submission?.notes || "", evidenceUrl: submission?.evidenceUrl || "" };
                  return <div key={milestone.id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold tabular-nums">{index + 1}</span><div className="min-w-0"><h3 className="text-sm font-semibold">{milestone.title}</h3>{milestone.description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{milestone.description}</p>}{milestone.skill && <p className="mt-2 text-xs text-muted-foreground">{milestone.skill.category} · {milestone.skill.name}</p>}</div></div><Badge variant={statusVariant[status]}>{statusLabel[status]}</Badge></div>
                    {submission?.reviewComment && status === "CHANGES_REQUESTED" && <div className="mt-4 flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><div><p className="font-medium text-foreground">Mentor feedback</p><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{submission.reviewComment}</p></div></div>}
                    {submission?.evidenceUrl && <a href={submission.evidenceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">View submitted evidence <ExternalLink className="h-3 w-3" /></a>}
                    {canSubmit ? <div className="mt-4 space-y-3 border-t border-border/70 pt-4"><Textarea label="Evidence and notes" placeholder="Describe the work you completed, what you learned, and how it meets this milestone…" value={draft.notes} onChange={(event) => setDrafts((current) => ({ ...current, [milestone.id]: { ...draft, notes: event.target.value } }))} /><Input label="Evidence URL (optional)" placeholder="https://github.com/owner/repository/pull/123" value={draft.evidenceUrl} onChange={(event) => setDrafts((current) => ({ ...current, [milestone.id]: { ...draft, evidenceUrl: event.target.value } }))} /><div className="flex justify-end"><Button size="sm" disabled={savingId === milestone.id} onClick={() => void submitEvidence(milestone.id)}>{savingId === milestone.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}{status === "CHANGES_REQUESTED" ? "Resubmit evidence" : "Submit for review"}</Button></div></div> : <p className="mt-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">{status === "APPROVED" ? "This milestone has been approved." : "Your evidence is with your mentor. You can edit and resubmit after feedback is requested."}</p>}
                  </div>;
                })}
              </CardContent>}
            </Card>;
          })}
        </div>
      )}
    </div>
  );
}
