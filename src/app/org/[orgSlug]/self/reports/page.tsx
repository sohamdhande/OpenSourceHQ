import React from "react";
import Link from "next/link";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { formatDate } from "@/lib/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Plus, ExternalLink } from "lucide-react";

export default async function SelfReportsHistoryPage({ params }: { params: { orgSlug: string } }) {
  const session = await getSession();
  if (!session) return null;

  const org = await prisma.organization.findUnique({ where: { slug: params.orgSlug } });
  if (!org) return null;

  const reports = await prisma.dailyReport.findMany({
    where: {
      organizationId: org.id,
      menteeId: session.id,
      cohortId: null,
      isSelfTracked: true,
    },
    include: { links: true },
    orderBy: [{ reportDate: "desc" }, { createdAt: "desc" }],
    take: 90,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-400" />
            Personal Log History
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Your private open-source daily logs. Visible only to you.
          </p>
        </div>
        <Link href={`/org/${params.orgSlug}/self/daily-log`}>
          <Button size="sm" className="bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Daily Log
          </Button>
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center text-xs text-zinc-400">
          No personal daily logs recorded yet. Submit your first log to start building your streak!
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-sm font-semibold text-white">
                    {formatDate(report.reportDate)}
                  </span>
                  <Badge variant={report.status === "SUBMITTED" ? "success" : "secondary"} className="text-[10px]">
                    {report.status === "SUBMITTED" ? "Logged" : report.status}
                  </Badge>
                </div>
                {report.hoursSpent != null && (
                  <span className="text-xs font-mono text-zinc-400">{report.hoursSpent}h logged</span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                    Work Completed
                  </span>
                  <p className="text-zinc-200 whitespace-pre-wrap leading-relaxed">{report.workDone}</p>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                    Key Learnings
                  </span>
                  <p className="text-zinc-200 whitespace-pre-wrap leading-relaxed">{report.learning}</p>
                </div>
              </div>

              {report.nextSteps && (
                <div className="text-xs">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                    Next Steps
                  </span>
                  <p className="text-zinc-300 whitespace-pre-wrap">{report.nextSteps}</p>
                </div>
              )}

              {report.links.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {report.links.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-mono text-emerald-300 hover:bg-white/10"
                    >
                      {link.label}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

