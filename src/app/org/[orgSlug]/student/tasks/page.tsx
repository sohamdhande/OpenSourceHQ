"use client";
import { formatDate } from "@/lib/date";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { AlertCircle, CheckCircle2, Clock, Send, Play } from "lucide-react";

export default function StudentTasksPage({ params }: { params: { orgSlug: string } }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingAssignmentId, setSubmittingAssignmentId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [blockerTaskId, setBlockerTaskId] = useState<string | null>(null);
  const [blockerDesc, setBlockerDesc] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const sessionRes = await fetch(`/api/auth/session?orgSlug=${encodeURIComponent(params.orgSlug)}`);
      const sessionData = await sessionRes.json();
      const orgId = sessionData.user?.activeOrgId;
      if (!orgId) throw new Error(sessionData.error?.message || "No active organization access.");
      const res = await fetch(`/api/tasks?organizationId=${encodeURIComponent(orgId)}`);
      const data = await res.json();
      if (data.tasks) setTasks(data.tasks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleStartTask = async (assignmentId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/task-assignments/${assignmentId}/submissions`, { method: "PATCH" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Could not start this task.");
      await fetchTasks();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not start this task.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitDeliverable = async (assignmentId: string) => {
    if (!notes.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/task-assignments/${assignmentId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, evidenceUrl }),
      });
      if (res.ok) {
        setSubmittingAssignmentId(null);
        setNotes("");
        setEvidenceUrl("");
        fetchTasks();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRaiseTaskBlocker = async (taskId: string, orgId: string) => {
    if (!blockerDesc.trim()) return;
    setActionLoading(true);
    try {
      await fetch("/api/blockers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          title: "Blocker on Task Deliverable",
          description: blockerDesc,
          urgency: "HIGH",
          source: "TASK",
          sourceId: taskId,
        }),
      });
      setBlockerTaskId(null);
      setBlockerDesc("");
      alert("Blocker raised successfully and sent to mentor!");
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Assigned Mentorship Tasks</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Work deliverables, acceptance criteria, and PR submissions.
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-muted-foreground">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="py-12 text-center text-xs text-muted-foreground">
          No tasks currently assigned to you.
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => {
            const assignment = task.assignments?.[0];
            const isCompleted = assignment?.status === "COMPLETED";
            const isChangesRequested = assignment?.status === "CHANGES_REQUESTED";

            return (
              <Card key={task.id} className={isChangesRequested ? "border-amber-500/40" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-sm text-foreground">{task.title}</span>
                      <span className="text-xs text-muted-foreground ml-2">({task.category})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          task.priority === "URGENT"
                            ? "destructive"
                            : task.priority === "HIGH"
                            ? "warning"
                            : "secondary"
                        }
                      >
                        {task.priority}
                      </Badge>
                      <Badge
                        variant={
                          isCompleted
                            ? "success"
                            : isChangesRequested
                            ? "warning"
                            : assignment?.status === "SUBMITTED"
                            ? "default"
                            : "outline"
                        }
                      >
                        {assignment?.status || "ASSIGNED"}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {task.description}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex flex-wrap gap-4 text-muted-foreground">
                    <span>Mentor: {task.creator?.name || "Assigned Mentor"}</span>
                    {task.repository && (
                      <span>Repository: <span className="font-mono text-foreground">{task.repository.fullName}</span></span>
                    )}
                    {task.dueAt && (
                      <span>Due: {formatDate(task.dueAt)}</span>
                    )}
                  </div>

                  {task.acceptanceCriteria && (
                    <div className="p-2.5 bg-muted/20 border border-border rounded text-[11px]">
                      <span className="font-semibold text-foreground block mb-0.5">
                        Acceptance Criteria:
                      </span>
                      <p className="text-muted-foreground">{task.acceptanceCriteria}</p>
                    </div>
                  )}

                  {/* Submission history */}
                  {assignment?.submissions?.length > 0 && (
                    <div className="p-3 bg-muted/30 border border-border rounded-md space-y-1">
                      <span className="font-semibold text-foreground">Latest Submission:</span>
                      <p className="text-muted-foreground">{assignment.submissions[0].notes}</p>
                      {assignment.submissions[0].evidenceUrl && (
                        <a
                          href={assignment.submissions[0].evidenceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline font-mono text-[11px] block mt-1"
                        >
                          Evidence: {assignment.submissions[0].evidenceUrl}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Mentor Review Comment */}
                  {assignment?.reviews?.length > 0 && (
                    <div className="p-3 bg-muted/40 rounded-md space-y-1">
                      <div className="flex items-center justify-between font-medium">
                        <span>Mentor Review Decision:</span>
                        <Badge variant="outline" className="text-[9px]">
                          {assignment.reviews[0].decision}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">{assignment.reviews[0].comment}</p>
                    </div>
                  )}

                  {/* Task Actions */}
                  {!isCompleted && (
                    <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-amber-500 hover:text-amber-600 gap-1"
                        onClick={() => setBlockerTaskId(blockerTaskId === task.id ? null : task.id)}
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        Report Blocker on Task
                      </Button>

                      <div className="flex items-center gap-2">
                        {assignment?.status === "TODO" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={actionLoading}
                            onClick={() => handleStartTask(assignment.id)}
                            className="gap-1 text-xs"
                          >
                            <Play className="w-3.5 h-3.5" />
                            Start Task
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() =>
                            setSubmittingAssignmentId(
                              submittingAssignmentId === assignment?.id ? null : assignment?.id
                            )
                          }
                          className="gap-1 text-xs"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {isChangesRequested ? "Resubmit Deliverables" : "Submit Deliverables"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Deliverable submission sub-form */}
                  {submittingAssignmentId === assignment?.id && (
                    <div className="p-3 bg-muted/20 border border-border rounded-md space-y-3 mt-3">
                      <Textarea
                        label="Submission Notes & Evidence"
                        placeholder="Explain changes made, tests executed, or benchmark results..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        required
                      />
                      <Input
                        label="Pull Request or Commit Evidence URL"
                        placeholder="https://github.com/nstsdc/core-platform/pull/42"
                        value={evidenceUrl}
                        onChange={(e) => setEvidenceUrl(e.target.value)}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSubmittingAssignmentId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          loading={actionLoading}
                          onClick={() => handleSubmitDeliverable(assignment.id)}
                        >
                          Confirm Submission
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Blocker sub-form */}
                  {blockerTaskId === task.id && (
                    <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-md space-y-2 mt-2">
                      <span className="font-semibold text-destructive block">
                        Raise Blocker on &ldquo;{task.title}&rdquo;
                      </span>
                      <Textarea
                        placeholder="Explain what is blocking your progress on this task..."
                        value={blockerDesc}
                        onChange={(e) => setBlockerDesc(e.target.value)}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setBlockerTaskId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          loading={actionLoading}
                          onClick={() => handleRaiseTaskBlocker(task.id, task.organizationId)}
                        >
                          Send Blocker to Mentor
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
