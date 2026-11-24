"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Search, Filter, AlertTriangle, ArrowRight, ExternalLink } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/date";

export default function StudentReportsHistoryPage({ params }: { params: { orgSlug: string } }) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchReports = async () => {
    setLoading(true);
    try {
      const sessionRes = await fetch(`/api/auth/session?orgSlug=${encodeURIComponent(params.orgSlug)}`);
      const sessionData = await sessionRes.json();
      const orgId = sessionData.user?.activeOrgId;

      if (!orgId) return;

      const res = await fetch(`/api/reports?organizationId=${orgId}`);
      const data = await res.json();
      if (data.reports) setReports(data.reports);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const filteredReports = reports.filter((r) => {
    const matchesStatus = filterStatus === "ALL" || r.status === filterStatus;
    const matchesSearch =
      !searchQuery.trim() ||
      r.workDone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.learning?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.blockers?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Daily Reports History</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit trail of all submitted engineering logs, mentor evaluations, and revisions.
          </p>
        </div>
        <Link href={`/org/${params.orgSlug}/student/daily-log`}>
          <Button size="sm">Submit New Report</Button>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search work completed, learnings, or blockers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-background text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {["ALL", "SUBMITTED", "REVIEWED", "CHANGES_REQUESTED", "DRAFT"].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    filterStatus === status
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report List */}
      {loading ? (
        <div className="text-center py-12 text-xs text-muted-foreground">Loading reports...</div>
      ) : filteredReports.length === 0 ? (
        <div className="text-center py-12 text-xs text-muted-foreground">
          No reports match your current filter criteria.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => (
            <Card
              key={report.id}
              className={report.status === "CHANGES_REQUESTED" ? "border-amber-500/40" : ""}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-sm text-foreground">
                      {formatDate(report.reportDate)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({report.cohort?.name || "Cohort"})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{report.visibility}</Badge>
                    <Badge
                      variant={
                        report.status === "REVIEWED"
                          ? "success"
                          : report.status === "CHANGES_REQUESTED"
                          ? "warning"
                          : "secondary"
                      }
                    >
                      {report.status}
                    </Badge>
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Hours logged: {report.hoursSpent ?? "N/A"} &bull; Submitted:{" "}
                  {report.submittedAt ? formatDateTime(report.submittedAt) : "Draft"}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div>
                  <span className="font-semibold text-foreground">Work Completed:</span>
                  <p className="text-muted-foreground mt-0.5 leading-relaxed">{report.workDone}</p>
                </div>

                <div>
                  <span className="font-semibold text-foreground">Technical Learning:</span>
                  <p className="text-muted-foreground mt-0.5 leading-relaxed">{report.learning}</p>
                </div>

                {report.blockers && (
                  <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-red-950 dark:text-red-200">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400 block mb-0.5">
                      Blockers Encountered:
                    </span>
                    <p className="text-xs text-red-900 dark:text-red-200 leading-relaxed">{report.blockers}</p>
                  </div>
                )}

                <div>
                  <span className="font-semibold text-foreground">Next Goals:</span>
                  <p className="text-muted-foreground mt-0.5">{report.nextSteps}</p>
                </div>

                {report.links?.length > 0 && (
                  <div>
                    <span className="font-semibold text-foreground">GitHub Links:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {report.links.map((link: any) => (
                        <a
                          key={link.id}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-primary hover:underline text-[11px] flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mentor Review History */}
                {report.reviews?.length > 0 && (
                  <div className="pt-2 border-t border-border space-y-1.5 mt-2">
                    <span className="font-semibold text-foreground">Mentor Review:</span>
                    {report.reviews.map((rev: any) => (
                      <div key={rev.id} className="p-2.5 bg-muted/40 rounded-md text-[11px] space-y-1">
                        <div className="flex items-center justify-between font-medium">
                          <span>{rev.reviewer.name}</span>
                          <Badge variant="outline" className="text-[9px]">
                            {rev.status}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">{rev.comment}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action if changes requested */}
                {report.status === "CHANGES_REQUESTED" && (
                  <div className="pt-2 border-t border-border flex justify-end">
                    <Link href={`/org/${params.orgSlug}/student/daily-log`}>
                      <Button size="sm" className="gap-1 text-xs">
                        Edit & Resubmit Changes <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
