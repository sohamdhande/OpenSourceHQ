"use client";
import { formatDate } from "@/lib/date";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Plus, CheckSquare, Clock, AlertCircle, ExternalLink, Filter } from "lucide-react";

interface Mentee {
  id: string;
  name: string;
  email: string;
}

interface Cohort {
  id: string;
  name: string;
}

interface Repository {
  id: string;
  fullName: string;
}

interface TaskAssignment {
  id: string;
  status: string;
  mentee: Mentee;
  submissions: Array<{
    id: string;
    notes: string;
    evidenceUrl?: string | null;
    submittedAt: string;
  }>;
  reviews: Array<{
    id: string;
    decision: string;
    comment: string;
    createdAt: string;
  }>;
}

interface TaskItem {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  dueAt?: string | null;
  externalIssueUrl?: string | null;
  cohort?: Cohort | null;
  repository?: Repository | null;
  creator: { id: string; name: string };
  assignments: TaskAssignment[];
}

interface MentorTasksManagerProps {
  tasks: TaskItem[];
  cohorts: Cohort[];
  repositories: Repository[];
  mentees: Mentee[];
  orgId: string;
  orgSlug: string;
}

export function MentorTasksManager({
  tasks: initialTasks,
  cohorts,
  repositories,
  mentees,
  orgId,
  orgSlug,
}: MentorTasksManagerProps) {
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [evaluatingAssignment, setEvaluatingAssignment] = useState<TaskAssignment | null>(null);

  // Form states for creating task
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Feature");
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [cohortId, setCohortId] = useState<string>(cohorts[0]?.id || "");
  const [repositoryId, setRepositoryId] = useState<string>("");
  const [dueAt, setDueAt] = useState<string>("");
  const [selectedMentees, setSelectedMentees] = useState<string[]>([]);
  const [submittingTask, setSubmittingTask] = useState(false);

  // Form states for evaluating submission
  const [evalDecision, setEvalDecision] = useState<"ACCEPTED" | "CHANGES_REQUESTED">("ACCEPTED");
  const [evalComment, setEvalComment] = useState("");
  const [evalSubmitting, setEvalSubmitting] = useState(false);

  // Filter
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setSubmittingTask(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          cohortId: cohortId || undefined,
          repositoryId: repositoryId || undefined,
          title,
          description,
          category,
          priority,
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
          assigneeIds: selectedMentees.length > 0 ? selectedMentees : mentees.map((m) => m.id),
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setTitle("");
        setDescription("");
        setDueAt("");
        setSelectedMentees([]);
        // Refresh tasks
        const fetchRes = await fetch(`/api/tasks?organizationId=${orgId}`);
        const data = await fetchRes.json();
        if (data.tasks) setTasks(data.tasks);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingTask(false);
    }
  };

  const handleEvaluateSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evaluatingAssignment || !evalComment.trim()) return;

    setEvalSubmitting(true);
    try {
      const res = await fetch(`/api/task-assignments/${evaluatingAssignment.id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: evalDecision,
          comment: evalComment,
        }),
      });

      if (res.ok) {
        setEvaluatingAssignment(null);
        setEvalComment("");
        // Refresh tasks
        const fetchRes = await fetch(`/api/tasks?organizationId=${orgId}`);
        const data = await fetchRes.json();
        if (data.tasks) setTasks(data.tasks);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEvalSubmitting(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Mentorship Tasks</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Assign code deliverables, track student PR submissions, and conduct evaluations.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreateModal(true)} className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Create New Task
        </Button>
      </div>

      {/* Filter Row */}
      <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg text-xs">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="font-medium text-foreground">Priority:</span>
        <select
          className="bg-background border border-input rounded px-2.5 py-1 text-xs"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="ALL">All Priorities</option>
          <option value="URGENT">Urgent</option>
          <option value="HIGH">High</option>
          <option value="NORMAL">Normal</option>
          <option value="LOW">Low</option>
        </select>
        <div className="ml-auto text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filteredTasks.length}</span> tasks
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-xs text-muted-foreground">
              No tasks match your selection. Create your first task using the button above.
            </CardContent>
          </Card>
        ) : (
          filteredTasks.map((task) => (
            <Card key={task.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{task.title}</span>
                    <Badge variant="outline" className="text-[10px]">{task.category}</Badge>
                    <Badge
                      variant={
                        task.priority === "URGENT"
                          ? "destructive"
                          : task.priority === "HIGH"
                          ? "warning"
                          : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {task.priority}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {task.dueAt && <span>Due: {formatDate(task.dueAt)}</span>}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{task.description}</p>
                <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground mt-2">
                  <span>Cohort: <strong className="text-foreground">{task.cohort?.name || "Org-wide"}</strong></span>
                  {task.repository && (
                    <span>Repo: <code className="text-primary font-mono">{task.repository.fullName}</code></span>
                  )}
                  <span>Created by: {task.creator.name}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs border-t border-border pt-3">
                <span className="font-semibold text-foreground uppercase text-[10px] tracking-wider block">
                  Assigned Mentees & Submissions ({task.assignments.length})
                </span>
                <div className="divide-y divide-border/40">
                  {task.assignments.map((assignment) => {
                    const latestSubmission = assignment.submissions[0];
                    const latestReview = assignment.reviews[0];
                    const isPendingReview = assignment.status === "SUBMITTED" || assignment.status === "RESUBMITTED";

                    return (
                      <div key={assignment.id} className="py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{assignment.mentee.name}</span>
                            <Badge
                              variant={
                                assignment.status === "ACCEPTED"
                                  ? "success"
                                  : assignment.status === "CHANGES_REQUESTED"
                                  ? "warning"
                                  : isPendingReview
                                  ? "warning"
                                  : "outline"
                              }
                              className="text-[10px]"
                            >
                              {assignment.status}
                            </Badge>
                          </div>

                          {latestSubmission && (
                            <div className="text-[11px] text-muted-foreground pl-2 border-l-2 border-primary/30">
                              <span className="font-medium text-foreground">Latest Submission:</span> {latestSubmission.notes}
                              {latestSubmission.evidenceUrl && (
                                <a
                                  href={latestSubmission.evidenceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="ml-2 text-primary hover:underline font-mono inline-flex items-center gap-0.5"
                                >
                                  PR Link <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          )}

                          {latestReview && (
                            <div className="text-[11px] text-muted-foreground pl-2 border-l-2 border-border mt-1">
                              <span className="font-medium text-foreground">Review Feedback:</span> {latestReview.comment}
                            </div>
                          )}
                        </div>

                        <div>
                          {isPendingReview ? (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => {
                                setEvaluatingAssignment(assignment);
                                setEvalComment("");
                                setEvalDecision("ACCEPTED");
                              }}
                            >
                              Evaluate Submission
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEvaluatingAssignment(assignment);
                                setEvalComment(latestReview?.comment || "");
                                setEvalDecision((latestReview?.decision as any) || "ACCEPTED");
                              }}
                            >
                              Update Evaluation
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg shadow-xl">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold">Create Mentorship Task</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
                <Input
                  label="Task Title"
                  placeholder="e.g. Implement Webhook HMAC Verification"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
                <Textarea
                  label="Description & Acceptance Criteria"
                  placeholder="Detail the exact deliverables, requirements, and reference issues..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={4}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-foreground block mb-1">Priority</label>
                    <select
                      className="w-full bg-background border border-input rounded px-3 py-2 text-xs"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                    >
                      <option value="LOW">Low</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-medium text-foreground block mb-1">Category</label>
                    <select
                      className="w-full bg-background border border-input rounded px-3 py-2 text-xs"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="Feature">Feature</option>
                      <option value="Bug">Bug</option>
                      <option value="Documentation">Documentation</option>
                      <option value="Refactor">Refactor</option>
                      <option value="Testing">Testing</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-foreground block mb-1">Cohort</label>
                    <select
                      className="w-full bg-background border border-input rounded px-3 py-2 text-xs"
                      value={cohortId}
                      onChange={(e) => setCohortId(e.target.value)}
                    >
                      <option value="">Org-wide (All Cohorts)</option>
                      {cohorts.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-medium text-foreground block mb-1">Target Repository</label>
                    <select
                      className="w-full bg-background border border-input rounded px-3 py-2 text-xs"
                      value={repositoryId}
                      onChange={(e) => setRepositoryId(e.target.value)}
                    >
                      <option value="">None / Optional</option>
                      {repositories.map((r) => (
                        <option key={r.id} value={r.id}>{r.fullName}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <Input
                  type="date"
                  label="Due Date (Optional)"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                />

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" loading={submittingTask}>
                    Publish Task
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Evaluate Submission Modal */}
      {evaluatingAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg shadow-xl">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold">
                Evaluate Task Submission — {evaluatingAssignment.mentee.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleEvaluateSubmission} className="space-y-4 text-xs">
                {evaluatingAssignment.submissions.length > 0 && (
                  <div className="p-3 bg-muted/30 border border-border rounded-md space-y-1">
                    <span className="font-semibold text-foreground">Submitted Notes:</span>
                    <p className="text-muted-foreground">{evaluatingAssignment.submissions[0].notes}</p>
                    {evaluatingAssignment.submissions[0].evidenceUrl && (
                      <a
                        href={evaluatingAssignment.submissions[0].evidenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline font-mono block mt-1"
                      >
                        Evidence: {evaluatingAssignment.submissions[0].evidenceUrl}
                      </a>
                    )}
                  </div>
                )}

                <div>
                  <label className="font-medium text-foreground block mb-1">Evaluation Decision</label>
                  <select
                    className="w-full bg-background border border-input rounded px-3 py-2 text-xs"
                    value={evalDecision}
                    onChange={(e) => setEvalDecision(e.target.value as any)}
                  >
                    <option value="ACCEPTED">Accepted (Task Completed Successfully)</option>
                    <option value="CHANGES_REQUESTED">Changes Requested (Return to Mentee)</option>
                  </select>
                </div>

                <Textarea
                  label="Constructive Feedback"
                  placeholder="Provide technical evaluation, code review pointers, or instructions for required revisions..."
                  value={evalComment}
                  onChange={(e) => setEvalComment(e.target.value)}
                  required
                  rows={4}
                />

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEvaluatingAssignment(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" loading={evalSubmitting}>
                    Submit Evaluation
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
