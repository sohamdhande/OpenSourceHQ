"use client";
import { formatDateTime } from "@/lib/date";
import { getDateKeyInTimeZone } from "@/lib/timezone";

import React, { useCallback, useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  FileCode2,
  Github,
  Plus,
  Send,
  Save,
  Lock,
  Globe2,
  HelpCircle,
} from "lucide-react";

export default function StudentDailyLogPage({ params }: { params: { orgSlug: string } }) {
  const [reportDate, setReportDate] = useState("");
  const [organizationTimezone, setOrganizationTimezone] = useState("UTC");
  const [workDone, setWorkDone] = useState("");
  const [learning, setLearning] = useState("");
  const [blockers, setBlockers] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [hoursSpent, setHoursSpent] = useState("4.0");
  const [visibility, setVisibility] = useState<"MENTORS_ONLY" | "COHORT">("MENTORS_ONLY");
  const [revisionNotes, setRevisionNotes] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [links, setLinks] = useState<{ url: string; label: string; type: string }[]>([]);
  const [existingReport, setExistingReport] = useState<any | null>(null);
  const [cohortId, setCohortId] = useState("");
  const [availableCohorts, setAvailableCohorts] = useState<{ id: string; name: string }[]>([]);
  const [cohortsLoading, setCohortsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [importingGithub, setImportingGithub] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Load a report for both the selected date and cohort. A mentee can be enrolled
  // in multiple cohorts, and DailyReport is unique per cohort/member/date.
  const resetReportForm = useCallback(() => {
    setExistingReport(null);
    setWorkDone("");
    setLearning("");
    setBlockers("");
    setNextSteps("");
    setHoursSpent("4.0");
    setVisibility("MENTORS_ONLY");
    setRevisionNotes("");
    setLinks([]);
  }, []);

  const loadReportForDate = useCallback(async (selectedDate: string, selectedCohortId: string) => {
    setFetching(true);
    try {
      const sessionRes = await fetch(`/api/auth/session?orgSlug=${encodeURIComponent(params.orgSlug)}`, { cache: "no-store" });
      const sessionData = await sessionRes.json();
      const orgId = sessionData.user?.activeOrgId;
      const userId = sessionData.user?.id;

      if (!sessionRes.ok || !orgId || !userId) throw new Error("Your organization session could not be verified.");

      const reportParams = new URLSearchParams({ organizationId: orgId, menteeId: userId });
      if (selectedCohortId) reportParams.set("cohortId", selectedCohortId);
      reportParams.set("reportDate", selectedDate);
      const res = await fetch(`/api/reports?${reportParams.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Could not load your daily reports.");

      const ownReports = (data.reports || []).filter(
        (report: any) => report.reportDate?.split("T")[0] === selectedDate && report.menteeId === userId
      );
      // When no cohort is selected, only auto-select if exactly one matching
      // report exists. Never load an arbitrary report from another cohort.
      const matching = selectedCohortId
        ? ownReports.find((report: any) => report.cohortId === selectedCohortId)
        : ownReports.length === 1 ? ownReports[0] : null;

      if (matching) {
        setExistingReport(matching);
        if (!selectedCohortId && matching.cohortId) setCohortId(matching.cohortId);
        setWorkDone(matching.workDone || "");
        setLearning(matching.learning || "");
        setBlockers(matching.blockers || "");
        setNextSteps(matching.nextSteps || "");
        setHoursSpent(matching.hoursSpent !== null && matching.hoursSpent !== undefined ? String(matching.hoursSpent) : "4.0");
        setVisibility(matching.visibility || "MENTORS_ONLY");
        setRevisionNotes(matching.revisionNotes || "");
        setLinks(matching.links || []);
      } else {
        resetReportForm();
        if (!selectedCohortId && ownReports.length > 1) {
          setMessage({ text: "You have reports in multiple cohorts for this date. Choose a cohort to view or edit its report.", type: "error" });
        }
      }
    } catch (err) {
      console.error(err);
      resetReportForm();
      setMessage({ text: err instanceof Error ? err.message : "Could not load your daily report.", type: "error" });
    } finally {
      setFetching(false);
    }
  }, [params.orgSlug, resetReportForm]);

  useEffect(() => {
    if (!reportDate) {
      let cancelled = false;
      const initializeDate = async () => {
        try {
          const response = await fetch(`/api/auth/session?orgSlug=${encodeURIComponent(params.orgSlug)}`, { cache: "no-store" });
          const data = await response.json();
          if (!response.ok || !data.user) throw new Error("Your organization session could not be verified.");
          if (!cancelled) {
            const timezone = data.user.activeOrgTimezone || "UTC";
            setOrganizationTimezone(timezone);
            setReportDate(getDateKeyInTimeZone(new Date(), timezone));
          }
        } catch (error) {
          if (!cancelled) setMessage({ text: error instanceof Error ? error.message : "Could not determine today's date.", type: "error" });
        }
      };
      void initializeDate();
      return () => { cancelled = true; };
    }
    if (cohortsLoading) return;
    void loadReportForDate(reportDate, cohortId);
  }, [reportDate, cohortId, cohortsLoading, params.orgSlug, loadReportForDate]);

  useEffect(() => {
    let cancelled = false;
    const loadActiveCohorts = async () => {
      setCohortsLoading(true);
      try {
        const sessionResponse = await fetch(`/api/auth/session?orgSlug=${encodeURIComponent(params.orgSlug)}`);
        const sessionData = await sessionResponse.json();
        const organizationId = sessionData.user?.activeOrgId;
        if (!organizationId) throw new Error("No active organization found.");
        const response = await fetch(`/api/orgs/${organizationId}/cohorts`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error?.message || "Could not load your active cohorts.");
        const cohorts = (data.cohorts || []).filter((cohort: any) => cohort.status === "ACTIVE").map((cohort: any) => ({ id: cohort.id, name: cohort.name }));
        if (cancelled) return;
        setAvailableCohorts(cohorts);
        setCohortId((current) => current && cohorts.some((cohort: { id: string }) => cohort.id === current) ? current : cohorts.length === 1 ? cohorts[0].id : "");
      } catch (error) {
        if (!cancelled) setMessage({ text: error instanceof Error ? error.message : "Could not load cohorts.", type: "error" });
      } finally {
        if (!cancelled) setCohortsLoading(false);
      }
    };
    void loadActiveCohorts();
    return () => { cancelled = true; };
  }, [params.orgSlug]);

  const addLink = () => {
    if (!linkUrl || !linkLabel) return;
    setLinks([...links, { url: linkUrl, label: linkLabel, type: "PR" }]);
    setLinkUrl("");
    setLinkLabel("");
  };

  const removeLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const handleImportGitHubActivity = async () => {
    setMessage(null);
    setImportingGithub(true);
    try {
      const sessionRes = await fetch(`/api/auth/session?orgSlug=${encodeURIComponent(params.orgSlug)}`, { cache: "no-store" });
      const sessionData = await sessionRes.json();
      const orgId = sessionData.user?.activeOrgId;
      if (!orgId) throw new Error("No active organization found.");

      const res = await fetch(
        `/api/github/my-activity?organizationId=${encodeURIComponent(orgId)}&date=${encodeURIComponent(reportDate)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to fetch GitHub activity.");

      if (!data.connected) {
        setMessage({ text: "Connect your GitHub account first to auto-import activity.", type: "error" });
        return;
      }

      const items: Array<{ activityType: string; title: string; url: string | null; repoFullName: string | null }> =
        data.activities || [];
      if (items.length === 0) {
        setMessage({
          text: "No verified GitHub commits or PRs found for your selected repositories yet.",
          type: "error",
        });
        return;
      }

      const summaryBullets = items
        .slice(0, 6)
        .map((item) => `- [${item.repoFullName || "GitHub"}] ${item.title}`)
        .join("\n");

      setWorkDone((prev) => (prev.trim() ? `${prev.trim()}\n${summaryBullets}` : summaryBullets));

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

      setMessage({
        text:
          data.scope === "date"
            ? `Imported ${items.length} verified GitHub event(s) from ${reportDate}.`
            : `No events on ${reportDate}; imported ${items.length} recent verified GitHub event(s).`,
        type: "success",
      });
    } catch (err: unknown) {
      setMessage({
        text: err instanceof Error ? err.message : "Could not import GitHub activity.",
        type: "error",
      });
    } finally {
      setImportingGithub(false);
    }
  };

  function parseValidationMessage(raw: string): string {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((p: any) => {
            const fieldLabels: Record<string, string> = {
              workDone: "Work Completed Today",
              learning: "Key Learnings & Discoveries",
              nextSteps: "Next Steps / Tomorrow",
              blockers: "Active Blockers",
            };
            const label = fieldLabels[p.path?.[0]] || p.path?.[0] || "Field";
            return `${label}: ${p.message || "Must be at least 5 characters"}`;
          })
          .join(" • ");
      }
    } catch {}
    return raw;
  }

  const handleSubmit = async (targetStatus: "DRAFT" | "SUBMITTED" | "RESUBMITTED") => {
    setMessage(null);

    // Client-side minimum character validation for substantive submissions
    if (targetStatus === "SUBMITTED" || targetStatus === "RESUBMITTED") {
      if (workDone.trim().length < 5) {
        setMessage({
          text: "Please provide at least 5 characters in 'Work Completed Today' before submitting.",
          type: "error",
        });
        return;
      }
      if (learning.trim().length < 5) {
        setMessage({
          text: "Please provide at least 5 characters in 'Key Learnings & Architecture Discoveries' before submitting.",
          type: "error",
        });
        return;
      }
      if (nextSteps.trim().length < 5) {
        setMessage({
          text: "Please provide at least 5 characters in 'Next Steps / Tomorrow's Objectives' before submitting.",
          type: "error",
        });
        return;
      }
    }

    setLoading(true);

    try {
      const sessionRes = await fetch(`/api/auth/session?orgSlug=${encodeURIComponent(params.orgSlug)}`);
      const sessionData = await sessionRes.json();
      const orgId = sessionData.user?.activeOrgId;

      if (!orgId) throw new Error("No active organization found");

      const selectedCohortId = cohortId || existingReport?.cohortId;
      if (!selectedCohortId) throw new Error("Choose an active cohort before saving this report.");
      if (targetStatus === "RESUBMITTED" && revisionNotes.trim().length < 5) throw new Error("Add at least five characters explaining what changed before resubmitting.");

      const payload = {
        organizationId: orgId,
        cohortId: selectedCohortId,
        reportDate,
        workDone,
        learning,
        blockers: blockers.trim() || null,
        nextSteps,
        hoursSpent: hoursSpent ? parseFloat(hoursSpent) : null,
        visibility,
        status: targetStatus,
        revisionNotes: revisionNotes.trim() || null,
        links,
      };

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error?.message || "Failed to submit report");
      }

      // If user reported a blocker, also raise into the dedicated Blocker triage system.
      // The report save is the primary operation, so a blocker failure is shown as a partial success.
      let blockerWarning: string | null = null;
      if (blockers.trim() && (targetStatus === "SUBMITTED" || targetStatus === "RESUBMITTED")) {
        const blockerResponse = await fetch("/api/blockers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: orgId,
            cohortId: selectedCohortId,
            title: `Blocker from Daily Report (${reportDate})`,
            description: blockers.trim(),
            category: "Daily Progress",
            urgency: "HIGH",
            source: "DAILY_REPORT",
            sourceId: resData.report?.id,
          }),
        });
        if (!blockerResponse.ok) {
          const blockerResult = await blockerResponse.json().catch(() => ({}));
          blockerWarning = blockerResult.error?.message || "The report was saved, but the blocker could not be added to mentor triage. Open My Blockers and add it there.";
        }
      }

      setMessage({
        text: blockerWarning || (
          targetStatus === "RESUBMITTED"
            ? "Report resubmitted with revisions for mentor review!"
            : targetStatus === "SUBMITTED"
            ? "Daily log submitted successfully! Streak updated."
            : "Draft saved successfully!"
        ),
        type: blockerWarning ? "error" : "success",
      });

      void loadReportForDate(reportDate, selectedCohortId);
    } catch (err: unknown) {
      const errorText = err instanceof Error ? err.message : "Error saving report";
      setMessage({
        text: parseValidationMessage(errorText),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const isChangesRequested = existingReport?.status === "CHANGES_REQUESTED";
  const isReadOnly = Boolean(existingReport && ["SUBMITTED", "UNDER_REVIEW", "RESUBMITTED", "REVIEWED"].includes(existingReport.status));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              Daily Engineering Log
            </h1>
            <Badge variant="cyan" className="font-mono text-[10px]">
              {organizationTimezone}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Document deliverables, kernel/compiler discoveries, blockers, and next session milestones.
          </p>
        </div>

        {existingReport && (
          <Badge
            variant={
              existingReport.status === "REVIEWED"
                ? "success"
                : existingReport.status === "CHANGES_REQUESTED"
                ? "warning"
                : "secondary"
            }
            className="text-xs font-semibold py-1 px-3 self-start sm:self-auto"
          >
            Status: {existingReport.status}
          </Badge>
        )}
      </div>

      {/* Mentor Review Alert if Changes Requested */}
      {isChangesRequested && existingReport.reviews?.length > 0 && (
        <Card className="border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <CardTitle className="text-sm font-bold text-foreground">
                Mentor Requested Revisions
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-1 text-xs">
            <p className="p-3 rounded-lg bg-muted/60 border border-border/40 italic text-foreground leading-relaxed">
              &ldquo;{existingReport.reviews[0].comment}&rdquo;
            </p>
            <span className="text-[11px] text-muted-foreground block font-mono">
              &mdash; {existingReport.reviews[0].reviewer.name} &bull;{" "}
              {formatDateTime(existingReport.reviews[0].createdAt)}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Feedback Toast Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold border flex items-center gap-2.5 ${
            message.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              : "bg-destructive/10 border-destructive/20 text-destructive"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Submission Form Card */}
      <Card className="shadow-lg">
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                {isChangesRequested ? "Revise & Resubmit Work Log" : isReadOnly ? "Submitted Daily Engineering Log" : "Daily Engineering Deliverables"}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Your report is saved for the selected cohort and organization-local calendar date.
              </CardDescription>
            </div>

            {/* Date Picker & Hours */}
            <div className="flex items-center gap-3">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase block">
                  Log Date
                </span>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="h-8 px-2.5 text-xs font-mono rounded-lg border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase block">
                  Hours Logged
                </span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={hoursSpent}
                  disabled={isReadOnly}
                  onChange={(e) => setHoursSpent(e.target.value)}
                  className="h-8 w-20 px-2.5 text-xs font-mono rounded-lg border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="border-b border-border/40 pb-4 pt-4">
          <label htmlFor="daily-log-cohort" className="mb-1.5 block text-xs font-semibold text-foreground">Cohort</label>
          {cohortsLoading ? (
            <p className="text-xs text-muted-foreground">Loading your active cohorts…</p>
          ) : availableCohorts.length === 0 ? (
            <p role="alert" className="text-sm text-destructive">You are not actively enrolled in a cohort. Ask your program administrator to enroll you before submitting a daily log.</p>
          ) : availableCohorts.length === 1 ? (
            <p className="text-sm font-medium text-foreground">{availableCohorts[0].name}</p>
          ) : (
            <select id="daily-log-cohort" value={cohortId} onChange={(event) => setCohortId(event.target.value)} className="h-10 w-full max-w-md rounded-lg border border-border bg-background px-3 text-sm" required>
              <option value="">Choose the cohort for this report</option>
              {availableCohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}
            </select>
          )}
        </CardContent>

        {isReadOnly && (
          <div role="status" className="mx-6 mt-4 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
            This report has been submitted and is read-only while it awaits review or after it has been reviewed. Your mentor must request changes before you can edit it.
          </div>
        )}

        <CardContent className="space-y-5 pt-5">
          <fieldset disabled={isReadOnly} className="contents">
          {/* Work Done */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">
                1. Work Completed Today (Deliverables &amp; Code)
              </span>
              {!isReadOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={importingGithub}
                  onClick={handleImportGitHubActivity}
                  className="h-7 gap-1.5 font-mono text-[11px]"
                >
                  <Github className="w-3.5 h-3.5" />
                  <span>Import GitHub Activity</span>
                </Button>
              )}
            </div>
            <Textarea
              placeholder="Features built, PRs merged, bug investigations, kernel traces, benchmarks, or documentation authored..."
              value={workDone}
              onChange={(e) => setWorkDone(e.target.value)}
              className="min-h-[100px] text-xs leading-relaxed"
              required
            />
          </div>

          {/* Learnings */}
          <Textarea
            label="2. Technical Discoveries & Architecture Learnings"
            placeholder="Nuances uncovered, memory models, compiler internals, system call behaviors, or performance bottlenecks..."
            value={learning}
            onChange={(e) => setLearning(e.target.value)}
            className="min-h-[90px] text-xs leading-relaxed"
            required
          />

          {/* Blockers */}
          <div className="space-y-1.5 p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                <span>3. Blockers / Help Needed</span>
              </label>
              <span className="text-[10px] font-mono text-muted-foreground">
                Optional &bull; Auto-notifies mentors
              </span>
            </div>
            <textarea
              placeholder="Any technical impediments, missing access, failing integration tests, or questions for your mentor..."
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              className="w-full min-h-[75px] rounded-lg border border-border bg-background/80 p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Plan for Next Session */}
          <Textarea
            label="4. Plan for Next Working Session"
            placeholder="Specific deliverables and goals you aim to tackle next session..."
            value={nextSteps}
            onChange={(e) => setNextSteps(e.target.value)}
            className="min-h-[75px] text-xs leading-relaxed"
            required
          />

          {/* Revision Notes if Resubmitting */}
          {isChangesRequested && (
            <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-1.5">
              <label className="text-xs font-bold text-foreground block">
                Notes for Mentor on Changes Made
              </label>
              <textarea
                placeholder="Explain the specific changes or additional detail added in response to feedback..."
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                className="w-full min-h-[70px] rounded-lg border border-border bg-background/80 p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {/* Visibility Setting (Card Radios) */}
          <div className="pt-2 border-t border-border/40">
            <span className="text-xs font-bold text-foreground block mb-2">
              Report Visibility Scope
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                aria-pressed={visibility === "MENTORS_ONLY"}
                onClick={() => setVisibility("MENTORS_ONLY")}
                className={`w-full text-left p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  visibility === "MENTORS_ONLY"
                    ? "border-primary bg-primary/5 shadow-xs"
                    : "border-border/60 hover:border-border hover:bg-muted/30"
                }`}
              >
                <div className="mt-0.5">
                  <Lock className={`w-4 h-4 ${visibility === "MENTORS_ONLY" ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <span className="font-semibold text-xs text-foreground block">
                    Private to Mentors (Default)
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Only organization administrators and your assigned mentors can view this log.
                  </p>
                </div>
              </button>

              <button
                type="button"
                aria-pressed={visibility === "COHORT"}
                onClick={() => setVisibility("COHORT")}
                className={`w-full text-left p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  visibility === "COHORT"
                    ? "border-primary bg-primary/5 shadow-xs"
                    : "border-border/60 hover:border-border hover:bg-muted/30"
                }`}
              >
                <div className="mt-0.5">
                  <Globe2 className={`w-4 h-4 ${visibility === "COHORT" ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <span className="font-semibold text-xs text-foreground block">
                    Cohort Shared
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Visible to peer fellow mentees in your cohort for knowledge sharing.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* GitHub Links */}
          <div className="space-y-3 pt-3 border-t border-border/40">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Github className="w-3.5 h-3.5 text-foreground" />
                <span>GitHub Deliverables & Pull Request Links</span>
              </label>
              <span className="text-[10px] font-mono text-muted-foreground">
                Traceable artifacts
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                placeholder="https://github.com/org/repo/pull/42"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="flex-1 h-8 px-3 text-xs rounded-lg border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                placeholder="PR Title or Commit description"
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                className="flex-1 h-8 px-3 text-xs rounded-lg border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button type="button" variant="outline" size="sm" onClick={addLink} className="h-8 gap-1">
                <Plus className="w-3.5 h-3.5" />
                <span>Add Link</span>
              </Button>
            </div>

            {links.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {links.map((link, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-2 py-1 px-2.5 font-mono text-xs">
                    <Github className="w-3 h-3 text-foreground" />
                    <span>{link.label}</span>
                    <button
                      type="button"
                      onClick={() => removeLink(idx)}
                      className="text-muted-foreground hover:text-destructive font-bold ml-1"
                    >
                      &times;
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Action Footer */}
          {!isReadOnly && <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              disabled={loading || cohortsLoading || availableCohorts.length === 0 || !(cohortId || existingReport?.cohortId)}
              onClick={() => handleSubmit("DRAFT")}
              className="gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Draft</span>
            </Button>

            {isChangesRequested ? (
              <Button
                type="button"
                variant="glow"
                loading={loading}
                disabled={cohortsLoading || availableCohorts.length === 0 || !(cohortId || existingReport?.cohortId)}
                onClick={() => handleSubmit("RESUBMITTED")}
                className="gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Resubmit Log with Revisions</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="glow"
                loading={loading}
                disabled={cohortsLoading || availableCohorts.length === 0 || !(cohortId || existingReport?.cohortId)}
                onClick={() => handleSubmit("SUBMITTED")}
                className="gap-1.5 shadow-glow/30"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Daily Log</span>
              </Button>
            )}
          </div>}
          </fieldset>
        </CardContent>
      </Card>
    </div>
  );
}
