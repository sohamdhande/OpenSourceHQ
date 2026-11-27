import { formatDate } from "@/lib/date";
import React from "react";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function MentorReviewsPage({ params }: { params: { orgSlug: string } }) {
  const session = await getSession();
  if (!session) return null;

  const org = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
  });
  if (!org) return null;

  // Report reviews
  const reportReviews = await prisma.reportReview.findMany({
    where: { reviewerId: session.id, report: { organizationId: org.id } },
    include: {
      report: {
        include: {
          mentee: { select: { id: true, name: true, email: true } },
          cohort: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Task reviews
  const taskReviews = await prisma.taskReview.findMany({
    where: { reviewerId: session.id, assignment: { task: { organizationId: org.id } } },
    include: {
      assignment: {
        include: {
          mentee: { select: { id: true, name: true } },
          task: { select: { title: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Feedback evaluations authored
  const authoredFeedback = await prisma.feedback.findMany({
    where: {
      authorId: session.id,
      organizationId: org.id,
    },
    include: {
      mentee: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Milestones approved
  const approvedMilestones = await prisma.menteeMilestone.findMany({
    where: {
      reviewedById: session.id,
      milestone: { learningPath: { organizationId: org.id } },
    },
    include: {
      mentee: { select: { id: true, name: true } },
      milestone: { select: { title: true } },
    },
    orderBy: { reviewedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">My Evaluation & Review History</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit history of all daily report reviews, task submissions evaluated, milestone approvals, and formal feedback.
          </p>
        </div>
        <Link href={`/org/${params.orgSlug}/mentor/reports`}>
          <Button size="sm">Go to Active Queue</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Daily Report Reviews */}
        <Card>
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-semibold">
              Daily Report Reviews ({reportReviews.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {reportReviews.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">
                No daily reports reviewed yet.
              </div>
            ) : (
              reportReviews.map((r) => (
                <div key={r.id} className="p-3 bg-muted/20 border border-border rounded-md text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/org/${params.orgSlug}/mentor/mentees/${r.report.mentee.id}`}
                      className="font-semibold text-foreground hover:underline"
                    >
                      {r.report.mentee.name}
                    </Link>
                    <Badge variant={r.status === "REVIEWED" ? "success" : "warning"}>
                      {r.status}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Report Date: {formatDate(r.report.reportDate)} &bull; {r.report.cohort?.name || "Cohort"}
                  </div>
                  <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{r.comment}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Task Evaluations */}
        <Card>
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-semibold">
              Task Deliverable Evaluations ({taskReviews.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {taskReviews.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">
                No task submissions evaluated yet.
              </div>
            ) : (
              taskReviews.map((t) => (
                <div key={t.id} className="p-3 bg-muted/20 border border-border rounded-md text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{t.assignment.task.title}</span>
                    <Badge variant={t.decision === "ACCEPTED" ? "success" : "warning"}>
                      {t.decision}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Mentee: {t.assignment.mentee.name} &bull; {formatDate(t.createdAt)}
                  </div>
                  <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{t.comment}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Formal Mentee Evaluations (Feedback) */}
        <Card>
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-semibold">
              Formal Mentee Evaluations ({authoredFeedback.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {authoredFeedback.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">
                No formal mentee feedback submitted yet.
              </div>
            ) : (
              authoredFeedback.map((f) => (
                <div key={f.id} className="p-3 bg-muted/20 border border-border rounded-md text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/org/${params.orgSlug}/mentor/mentees/${f.mentee.id}?tab=feedback`}
                      className="font-semibold text-foreground hover:underline"
                    >
                      {f.mentee.name}
                    </Link>
                    <Badge variant="outline" className="text-[10px]">{f.category}</Badge>
                  </div>
                  <p className="text-muted-foreground line-clamp-2">{f.content}</p>
                  {f.privateNotes && (
                    <div className="text-[10px] text-purple-600 dark:text-purple-400 bg-purple-500/10 p-1.5 rounded">
                      <strong>Private Note:</strong> {f.privateNotes}
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Milestone Decisions */}
        <Card>
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-semibold">
              Learning Milestone Reviews ({approvedMilestones.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {approvedMilestones.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">
                No milestone evidence reviewed yet.
              </div>
            ) : (
              approvedMilestones.map((m) => (
                <div key={m.id} className="p-3 bg-muted/20 border border-border rounded-md text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{m.milestone.title}</span>
                    <Badge variant={m.status === "APPROVED" ? "success" : "warning"}>
                      {m.status}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Mentee: {m.mentee.name} &bull; {m.reviewedAt ? formatDate(m.reviewedAt) : ""}
                  </div>
                  {m.notes && <p className="text-muted-foreground mt-1">{m.notes}</p>}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
