"use client";

import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/date";
import {
  Search,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Users,
  Lock,
  Layers,
  FileText,
  ExternalLink,
  ChevronDown,
  LayoutGrid,
  List,
  RotateCcw,
  Download,
  X,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

export interface ReportReviewItem {
  id: string;
  status: string;
  comment: string;
  createdAt: Date | string;
  reviewer: {
    id: string;
    name: string;
    email: string;
  };
}

export interface ReportLinkItem {
  id: string;
  url: string;
  label: string;
}

export interface ReportItem {
  id: string;
  organizationId: string;
  cohortId: string | null;
  menteeId: string;
  reportDate: Date | string;
  workDone: string;
  learning: string;
  blockers: string | null;
  nextSteps: string | null;
  hoursSpent: number | null;
  visibility: string;
  status: string;
  submittedAt: Date | string | null;
  revisionNotes: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  mentee: {
    id: string;
    name: string;
    email: string;
    imageUrl?: string | null;
  };
  cohort: {
    id: string;
    name: string;
    slug?: string;
  } | null;
  links: ReportLinkItem[];
  reviews: ReportReviewItem[];
}

export interface CohortOption {
  id: string;
  name: string;
  slug?: string;
}

interface AdminReportsClientProps {
  initialReports: ReportItem[];
  cohorts: CohortOption[];
  orgSlug: string;
}

export function AdminReportsClient({
  initialReports,
  cohorts,
  orgSlug,
}: AdminReportsClientProps) {
  const [reports, setReports] = useState<ReportItem[]>(initialReports);
  const [searchQuery, setSearchQuery] = useState("");
  const [cohortFilter, setCohortFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"feed" | "table">("feed");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "hours">("newest");
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);

  const [reviewingReportId, setReviewingReportId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const quickSnippets = [
    "Great progress today! Solid architectural structure.",
    "Please attach profiling data or benchmark metrics.",
    "Let's sync up directly to resolve this blocker.",
    "Commit looks clean; ready to merge.",
  ];

  const handleReviewSubmit = async (reportId: string, decision: "REVIEWED" | "CHANGES_REQUESTED") => {
    if (!reviewComment.trim()) return;
    setReviewSubmitting(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment: reviewComment.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        const newRev: ReportReviewItem = data.review || {
          id: `temp-${Date.now()}`,
          status: decision,
          comment: reviewComment.trim(),
          createdAt: new Date().toISOString(),
          reviewer: { id: "me", name: "Reviewer", email: "" },
        };
        setReports((prev) =>
          prev.map((r) => {
            if (r.id !== reportId) return r;
            return {
              ...r,
              status: decision,
              reviews: [newRev, ...r.reviews],
            };
          })
        );
        if (selectedReport && selectedReport.id === reportId) {
          setSelectedReport((prev) =>
            prev
              ? {
                  ...prev,
                  status: decision,
                  reviews: [newRev, ...prev.reviews],
                }
              : null
          );
        }
        setReviewingReportId(null);
        setReviewComment("");
      }
    } catch (err) {
      console.error("Failed to submit review:", err);
    } finally {
      setReviewSubmitting(false);
    }
  };

  // Telemetry KPIs
  const stats = useMemo(() => {
    const total = reports.length;
    const needsReview = reports.filter((r) =>
      ["SUBMITTED", "RESUBMITTED", "UNDER_REVIEW"].includes(r.status)
    ).length;
    const hasBlockers = reports.filter(
      (r) => Boolean(r.blockers && r.blockers.trim())
    ).length;
    const totalHours = reports.reduce((acc, r) => acc + (r.hoursSpent || 0), 0);

    return { total, needsReview, hasBlockers, totalHours };
  }, [reports]);

  // Filtered & Sorted Reports
  const filteredReports = useMemo(() => {
    return reports
      .filter((r) => {
        // Cohort filter
        if (cohortFilter !== "ALL" && r.cohortId !== cohortFilter) return false;

        // Status filter
        if (statusFilter === "NEEDS_REVIEW") {
          if (!["SUBMITTED", "RESUBMITTED", "UNDER_REVIEW"].includes(r.status))
            return false;
        } else if (statusFilter === "HAS_BLOCKERS") {
          if (!r.blockers || !r.blockers.trim()) return false;
        } else if (statusFilter !== "ALL") {
          if (r.status !== statusFilter) return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchMentee = r.mentee.name.toLowerCase().includes(q);
          const matchEmail = r.mentee.email.toLowerCase().includes(q);
          const matchCohort = (r.cohort?.name || "").toLowerCase().includes(q);
          const matchWork = r.workDone.toLowerCase().includes(q);
          const matchLearning = r.learning.toLowerCase().includes(q);
          const matchBlockers = (r.blockers || "").toLowerCase().includes(q);
          return (
            matchMentee ||
            matchEmail ||
            matchCohort ||
            matchWork ||
            matchLearning ||
            matchBlockers
          );
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "newest") {
          return new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime();
        }
        if (sortBy === "oldest") {
          return new Date(a.reportDate).getTime() - new Date(b.reportDate).getTime();
        }
        if (sortBy === "hours") {
          return (b.hoursSpent || 0) - (a.hoursSpent || 0);
        }
        return 0;
      });
  }, [reports, cohortFilter, statusFilter, searchQuery, sortBy]);

  const hasActiveFilters =
    searchQuery.trim() !== "" || cohortFilter !== "ALL" || statusFilter !== "ALL";

  const resetFilters = () => {
    setSearchQuery("");
    setCohortFilter("ALL");
    setStatusFilter("ALL");
    setSortBy("newest");
  };

  const exportCsv = () => {
    const headers = [
      "Report Date",
      "Mentee Name",
      "Mentee Email",
      "Cohort",
      "Hours Spent",
      "Status",
      "Visibility",
      "Work Completed",
      "Learning",
      "Blockers",
      "Next Steps",
    ];
    const rows = filteredReports.map((r) => [
      formatDate(r.reportDate),
      `"${r.mentee.name.replace(/"/g, '""')}"`,
      `"${r.mentee.email}"`,
      `"${(r.cohort?.name || "Personal").replace(/"/g, '""')}"`,
      r.hoursSpent ?? "",
      r.status,
      r.visibility,
      `"${(r.workDone || "").replace(/"/g, '""')}"`,
      `"${(r.learning || "").replace(/"/g, '""')}"`,
      `"${(r.blockers || "").replace(/"/g, '""')}"`,
      `"${(r.nextSteps || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `daily-reports-${orgSlug}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUBMITTED":
      case "RESUBMITTED":
      case "UNDER_REVIEW":
        return {
          label: status === "RESUBMITTED" ? "Resubmitted" : "Needs Review",
          variant: "default" as const,
          dot: true,
          badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        };
      case "REVIEWED":
        return {
          label: "Reviewed",
          variant: "success" as const,
          dot: true,
          badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        };
      case "CHANGES_REQUESTED":
        return {
          label: "Changes Requested",
          variant: "warning" as const,
          dot: true,
          badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        };
      case "DRAFT":
        return {
          label: "Draft",
          variant: "secondary" as const,
          dot: false,
          badgeClass: "bg-secondary text-secondary-foreground border-border",
        };
      default:
        return {
          label: status,
          variant: "outline" as const,
          dot: false,
          badgeClass: "border-border text-foreground",
        };
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="page-eyebrow">
            <Layers className="h-3.5 w-3.5" />
            GOVERNANCE & TELEMETRY
          </div>
          <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Daily Progress Reports
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Organization-wide telemetry of engineering logs, learning milestones, active blockers, and mentor reviews.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={exportCsv}
            disabled={filteredReports.length === 0}
            className="h-8 gap-1.5 text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>
      </section>

      {/* Telemetry Metric Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Reports */}
        <Card className="metric-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
              Total Submissions
            </span>
            <div className="w-7 h-7 rounded bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-foreground">
            {stats.total}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Across {cohorts.length} active cohorts
          </p>
        </Card>

        {/* Card 2: Needs Review */}
        <Card className="metric-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
              Pending Review
            </span>
            <div className="w-7 h-7 rounded bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
            {stats.needsReview}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Awaiting mentor feedback
          </p>
        </Card>

        {/* Card 3: Active Blockers */}
        <Card className="metric-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
              Flagged Blockers
            </span>
            <div
              className={`w-7 h-7 rounded flex items-center justify-center border ${
                stats.hasBlockers > 0
                  ? "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div
            className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
              stats.hasBlockers > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {stats.hasBlockers}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {stats.hasBlockers > 0 ? "Require mentor intervention" : "No open blockers reported"}
          </p>
        </Card>

        {/* Card 4: Hours Logged */}
        <Card className="metric-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
              Hours Logged
            </span>
            <div className="w-7 h-7 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-foreground">
            {stats.totalHours.toFixed(1)}h
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Cumulative fellow development time
          </p>
        </Card>
      </section>

      {/* Control & Filter Toolbar */}
      <section className="p-3.5 bg-card border border-border rounded-md space-y-3">
        <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
          {/* Search bar with proper padding-left so icon never overlaps text */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by mentee name, topics, keywords..."
              className="w-full h-8 pl-9 pr-8 bg-background border border-border rounded text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Cohort Selector */}
            <div className="relative">
              <select
                value={cohortFilter}
                onChange={(e) => setCohortFilter(e.target.value)}
                aria-label="Filter by cohort"
                className="h-8 px-2.5 pr-7 bg-background border border-border rounded text-xs text-foreground focus:outline-none focus:border-primary/50 appearance-none cursor-pointer"
              >
                <option value="ALL">All Cohorts ({cohorts.length})</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                aria-label="Sort reports"
                className="h-8 px-2.5 pr-7 bg-background border border-border rounded text-xs text-foreground focus:outline-none focus:border-primary/50 appearance-none cursor-pointer"
              >
                <option value="newest">Sort: Newest Date</option>
                <option value="oldest">Sort: Oldest Date</option>
                <option value="hours">Sort: Most Hours</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center border border-border bg-background rounded p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("feed")}
                aria-label="Feed view"
                className={`p-1 rounded text-xs transition-colors ${
                  viewMode === "feed"
                    ? "bg-secondary text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Feed view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                aria-label="Table view"
                className={`p-1 rounded text-xs transition-colors ${
                  viewMode === "table"
                    ? "bg-secondary text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Table view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            {hasActiveFilters && (
              <Button
                size="sm"
                variant="ghost"
                onClick={resetFilters}
                className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/60">
          <span className="text-[10px] font-mono text-muted-foreground uppercase mr-1">Filter:</span>
          {[
            { id: "ALL", label: "All", count: reports.length },
            {
              id: "NEEDS_REVIEW",
              label: "Needs Review",
              count: stats.needsReview,
            },
            {
              id: "HAS_BLOCKERS",
              label: "Has Blockers",
              count: stats.hasBlockers,
            },
            {
              id: "REVIEWED",
              label: "Reviewed",
              count: reports.filter((r) => r.status === "REVIEWED").length,
            },
            {
              id: "CHANGES_REQUESTED",
              label: "Changes Requested",
              count: reports.filter((r) => r.status === "CHANGES_REQUESTED").length,
            },
            {
              id: "DRAFT",
              label: "Drafts",
              count: reports.filter((r) => r.status === "DRAFT").length,
            },
          ].map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono transition-all ${
                  active
                    ? "bg-primary/10 text-primary border border-primary/25 font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[9.5px] px-1.5 py-0.2 rounded font-mono tabular-nums ${
                    active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Content Area */}
      {filteredReports.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-border bg-card">
          <div className="w-10 h-10 rounded-md bg-secondary border border-border flex items-center justify-center text-muted-foreground mx-auto">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-foreground">No reports match your filters</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            Try adjusting your search query, status filters, or cohort selection to find reports.
          </p>
          {hasActiveFilters && (
            <Button
              size="sm"
              variant="outline"
              onClick={resetFilters}
              className="mt-4 gap-1.5 text-xs mx-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset all filters
            </Button>
          )}
        </Card>
      ) : viewMode === "feed" ? (
        /* FEED VIEW (Structured Workstation Cards) */
        <div className="space-y-4">
          {filteredReports.map((report) => {
            const statusInfo = getStatusBadge(report.status);
            const hasBlocker = Boolean(report.blockers && report.blockers.trim());

            return (
              <Card
                key={report.id}
                className="bg-card border border-border transition-all hover:border-primary/30"
              >
                {/* Header row */}
                <CardHeader className="p-4 sm:p-5 border-b border-border/70 bg-muted/20">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Mentee info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded bg-secondary border border-border text-foreground font-mono font-bold text-xs flex items-center justify-center shrink-0">
                        {getInitials(report.mentee.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">
                            {report.mentee.name}
                          </span>
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {report.mentee.email}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-mono text-muted-foreground bg-muted border border-border">
                            {report.cohort?.name || "Personal"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Metadata & Status Badges */}
                    <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                      {/* Date Badge */}
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono text-foreground bg-muted border border-border">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span>{formatDate(report.reportDate)}</span>
                      </div>

                      {/* Hours Badge */}
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono text-foreground bg-muted border border-border">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span>{report.hoursSpent ? `${report.hoursSpent}h` : "N/A"}</span>
                      </div>

                      {/* Visibility Pill */}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-mono text-muted-foreground border border-border bg-transparent">
                        {report.visibility === "COHORT" ? (
                          <>
                            <Users className="w-3 h-3 text-muted-foreground" />
                            <span>Shared</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3 text-muted-foreground" />
                            <span>Private</span>
                          </>
                        )}
                      </span>

                      {/* Status Badge */}
                      <Badge
                        variant={statusInfo.variant}
                        dot={statusInfo.dot}
                        className={statusInfo.badgeClass}
                      >
                        {statusInfo.label}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 space-y-4 text-xs">
                  {/* Two-Column Grid: Work Completed & Key Learnings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Work Completed */}
                    <div className="p-3 bg-muted/25 rounded border border-border/70 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-foreground font-semibold text-[11px] uppercase tracking-wide font-mono">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                        <span>Work Accomplished</span>
                      </div>
                      <p className="text-foreground/90 leading-relaxed whitespace-pre-line">
                        {report.workDone}
                      </p>
                    </div>

                    {/* Key Learning */}
                    <div className="p-3 bg-muted/25 rounded border border-border/70 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-foreground font-semibold text-[11px] uppercase tracking-wide font-mono">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Key Insights & Learnings</span>
                      </div>
                      <p className="text-foreground/90 leading-relaxed whitespace-pre-line">
                        {report.learning}
                      </p>
                    </div>
                  </div>

                  {/* Next Steps (if present) */}
                  {report.nextSteps && (
                    <div className="p-3 bg-muted/25 rounded border border-border/70 space-y-1">
                      <div className="flex items-center gap-1.5 text-muted-foreground font-semibold text-[10.5px] uppercase tracking-wide font-mono">
                        <ArrowRight className="w-3.5 h-3.5 text-primary" />
                        <span>Planned Next Steps</span>
                      </div>
                      <p className="text-foreground/90 leading-relaxed whitespace-pre-line">
                        {report.nextSteps}
                      </p>
                    </div>
                  )}

                  {/* Refined Blocker Callout Banner */}
                  {hasBlocker && (
                    <div className="border-l-2 border-red-500 bg-red-500/10 p-3 rounded-r-md">
                      <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-semibold text-[11px] uppercase tracking-wide font-mono">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Blocker / Assistance Requested</span>
                      </div>
                      <p className="mt-1 text-red-700 dark:text-red-200 leading-relaxed">
                        {report.blockers}
                      </p>
                    </div>
                  )}

                  {/* Revision Notes (if resubmitted) */}
                  {report.revisionNotes && (
                    <div className="border-l-2 border-blue-500 bg-blue-500/10 p-2.5 rounded-r text-[11px]">
                      <span className="font-semibold text-blue-600 dark:text-blue-300 font-mono">
                        Revision Notes from Mentee:
                      </span>
                      <p className="text-foreground mt-0.5">{report.revisionNotes}</p>
                    </div>
                  )}

                  {/* External Artifact Links */}
                  {report.links.length > 0 && (
                    <div className="pt-1 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">
                        Evidence Links:
                      </span>
                      {report.links.map((link) => (
                        <a
                          key={link.id}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-mono text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors"
                        >
                          <span>{link.label}</span>
                          <ExternalLink className="w-3 h-3 ml-0.5" />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Mentor Reviews Section */}
                  {report.reviews.length > 0 && (
                    <div className="pt-2 border-t border-border/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] font-mono text-muted-foreground uppercase font-semibold">
                          Mentor Reviews ({report.reviews.length})
                        </span>
                      </div>

                      {report.reviews.map((rev) => (
                        <div
                          key={rev.id}
                          className="p-3 bg-muted/30 rounded border border-border/70 space-y-1.5"
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">
                                {rev.reviewer.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {formatDate(rev.createdAt)}
                              </span>
                            </div>
                            <Badge
                              variant={rev.status === "REVIEWED" ? "success" : "warning"}
                              className="text-[9.5px] px-2 py-0 font-mono"
                            >
                              {rev.status === "REVIEWED" ? "Accepted" : "Changes Requested"}
                            </Badge>
                          </div>
                          <p className="text-foreground/90 text-xs leading-relaxed">
                            {rev.comment}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Mentor Review & Inspection Actions */}
                  <div className="pt-3 border-t border-border/60">
                    {reviewingReportId === report.id ? (
                      <div className="space-y-3 rounded-md border border-primary/30 bg-muted/20 p-3 mt-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold uppercase tracking-wide text-foreground">
                            Submit Mentor Review — {report.mentee.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setReviewingReportId(null);
                              setReviewComment("");
                            }}
                            className="p-1 rounded text-muted-foreground hover:bg-muted"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {quickSnippets.map((snippet) => (
                            <button
                              key={snippet}
                              type="button"
                              onClick={() =>
                                setReviewComment((prev) => (prev ? `${prev} ${snippet}` : snippet))
                              }
                              className="rounded border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                            >
                              + {snippet}
                            </button>
                          ))}
                        </div>

                        <textarea
                          placeholder="Provide constructive review guidance or explain changes requested..."
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          className="w-full h-20 rounded border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                        />

                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setReviewingReportId(null);
                              setReviewComment("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            loading={reviewSubmitting}
                            disabled={!reviewComment.trim()}
                            onClick={() => handleReviewSubmit(report.id, "CHANGES_REQUESTED")}
                            className="border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10"
                          >
                            Request Changes
                          </Button>
                          <Button
                            size="sm"
                            loading={reviewSubmitting}
                            disabled={!reviewComment.trim()}
                            onClick={() => handleReviewSubmit(report.id, "REVIEWED")}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                          >
                            Approve & Mark Reviewed
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setReviewingReportId(report.id);
                            setReviewComment("");
                          }}
                          className="h-7 text-xs gap-1.5"
                        >
                          <Sparkles className="w-3 h-3 text-primary" />
                          <span>Review Submission</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedReport(report)}
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Inspect Details &rarr;
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* TABLE AUDIT VIEW (Compact Workstation Rows) */
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[10px] font-mono uppercase text-muted-foreground tracking-wider">
                <th className="py-2.5 px-3.5">Mentee</th>
                <th className="py-2.5 px-3">Cohort</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Hours</th>
                <th className="py-2.5 px-3">Accomplishment</th>
                <th className="py-2.5 px-3">Blocker</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredReports.map((report) => {
                const statusInfo = getStatusBadge(report.status);
                const hasBlocker = Boolean(report.blockers && report.blockers.trim());

                return (
                  <tr
                    key={report.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {/* Mentee */}
                    <td className="py-2.5 px-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-secondary border border-border text-foreground font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                          {getInitials(report.mentee.name)}
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium text-foreground block truncate">
                            {report.mentee.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono block truncate">
                            {report.mentee.email}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Cohort */}
                    <td className="py-2.5 px-3">
                      <span className="text-[11px] text-muted-foreground max-w-[140px] truncate block">
                        {report.cohort?.name || "Personal"}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-2.5 px-3 font-mono text-[11px] text-foreground whitespace-nowrap">
                      {formatDate(report.reportDate)}
                    </td>

                    {/* Hours */}
                    <td className="py-2.5 px-3 font-mono text-[11px] tabular-nums text-foreground">
                      {report.hoursSpent ? `${report.hoursSpent}h` : "—"}
                    </td>

                    {/* Accomplishment */}
                    <td className="py-2.5 px-3 text-foreground/90 max-w-[240px]">
                      <p className="truncate text-xs">{report.workDone}</p>
                    </td>

                    {/* Blocker */}
                    <td className="py-2.5 px-3">
                      {hasBlocker ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Blocker
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-mono text-xs">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3">
                      <Badge
                        variant={statusInfo.variant}
                        dot={statusInfo.dot}
                        className={statusInfo.badgeClass}
                      >
                        {statusInfo.label}
                      </Badge>
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedReport(report)}
                        className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Report Inspection Modal */}
      {selectedReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedReport(null);
          }}
        >
          <div className="w-full max-w-2xl bg-card border border-border rounded-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-secondary border border-border text-foreground font-mono font-bold text-xs flex items-center justify-center">
                  {getInitials(selectedReport.mentee.name)}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {selectedReport.mentee.name} — Progress Report
                  </h3>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    {selectedReport.cohort?.name || "Personal"} &bull; {formatDate(selectedReport.reportDate)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant={getStatusBadge(selectedReport.status).variant}
                  dot={getStatusBadge(selectedReport.status).dot}
                  className={getStatusBadge(selectedReport.status).badgeClass}
                >
                  {getStatusBadge(selectedReport.status).label}
                </Badge>
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Close dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/20 rounded border border-border/70">
                <div>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Hours Logged</span>
                  <p className="text-sm font-bold font-mono text-foreground mt-0.5">
                    {selectedReport.hoursSpent ?? "N/A"} hrs
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Visibility</span>
                  <p className="text-sm font-medium text-foreground mt-0.5">
                    {selectedReport.visibility === "COHORT" ? "Cohort Shared" : "Mentors Only"}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-foreground font-mono text-[11px] uppercase">
                  Work Accomplished:
                </span>
                <p className="p-3 bg-muted/25 rounded border border-border/70 text-foreground whitespace-pre-line leading-relaxed">
                  {selectedReport.workDone}
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-foreground font-mono text-[11px] uppercase">
                  Key Learnings:
                </span>
                <p className="p-3 bg-muted/25 rounded border border-border/70 text-foreground whitespace-pre-line leading-relaxed">
                  {selectedReport.learning}
                </p>
              </div>

              {selectedReport.nextSteps && (
                <div className="space-y-1">
                  <span className="font-semibold text-foreground font-mono text-[11px] uppercase">
                    Next Steps:
                  </span>
                  <p className="p-3 bg-muted/25 rounded border border-border/70 text-foreground whitespace-pre-line leading-relaxed">
                    {selectedReport.nextSteps}
                  </p>
                </div>
              )}

              {selectedReport.blockers && (
                <div className="border-l-2 border-red-500 bg-red-500/10 p-3 rounded-r">
                  <span className="font-semibold text-red-600 dark:text-red-400 font-mono text-[11px] uppercase block">
                    Blocker / Assistance Requested:
                  </span>
                  <p className="text-red-700 dark:text-red-200 mt-1 leading-relaxed">
                    {selectedReport.blockers}
                  </p>
                </div>
              )}

              {selectedReport.reviews.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <span className="font-semibold text-foreground font-mono text-[11px] uppercase">
                    Mentor Feedback & Reviews:
                  </span>
                  {selectedReport.reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-3 bg-muted/30 rounded border border-border/70 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{rev.reviewer.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {formatDate(rev.createdAt)}
                        </span>
                      </div>
                      <p className="text-foreground/90 text-xs">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Review Drawer in Inspector Modal */}
              <div className="pt-3 border-t border-border">
                {reviewingReportId === selectedReport.id ? (
                  <div className="space-y-3 rounded-md border border-primary/30 bg-muted/20 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold uppercase tracking-wide text-foreground">
                        Submit Mentor Review
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setReviewingReportId(null);
                          setReviewComment("");
                        }}
                        className="p-1 rounded text-muted-foreground hover:bg-muted"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {quickSnippets.map((snippet) => (
                        <button
                          key={snippet}
                          type="button"
                          onClick={() =>
                            setReviewComment((prev) => (prev ? `${prev} ${snippet}` : snippet))
                          }
                          className="rounded border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                        >
                          + {snippet}
                        </button>
                      ))}
                    </div>

                    <textarea
                      placeholder="Provide constructive review guidance or explain changes requested..."
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      className="w-full h-20 rounded border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                    />

                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setReviewingReportId(null);
                          setReviewComment("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        loading={reviewSubmitting}
                        disabled={!reviewComment.trim()}
                        onClick={() => handleReviewSubmit(selectedReport.id, "CHANGES_REQUESTED")}
                        className="border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10"
                      >
                        Request Changes
                      </Button>
                      <Button
                        size="sm"
                        loading={reviewSubmitting}
                        disabled={!reviewComment.trim()}
                        onClick={() => handleReviewSubmit(selectedReport.id, "REVIEWED")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                      >
                        Approve & Mark Reviewed
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setReviewingReportId(selectedReport.id);
                      setReviewComment("");
                    }}
                    className="h-8 text-xs gap-1.5 w-full justify-center"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>Submit Mentor Evaluation</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-border bg-muted/30 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedReport(null)}
                className="text-xs"
              >
                Close Inspector
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
