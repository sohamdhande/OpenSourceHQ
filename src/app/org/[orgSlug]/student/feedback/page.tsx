"use client";
import { formatDate } from "@/lib/date";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { CheckCircle2, MessageSquare, Send } from "lucide-react";

export default function StudentFeedbackPage({ params }: { params: { orgSlug: string } }) {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchFeedback = async () => {
    setLoading(true);
    try {
      const sessionRes = await fetch(`/api/auth/session?orgSlug=${encodeURIComponent(params.orgSlug)}`);
      const sessionData = await sessionRes.json();
      const orgId = sessionData.user?.activeOrgId;
      if (!orgId) throw new Error(sessionData.error?.message || "No active organization access.");
      const res = await fetch(`/api/feedback?organizationId=${encodeURIComponent(orgId)}`);
      const data = await res.json();
      if (data.feedbacks) setFeedbacks(data.feedbacks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, []);

  const handleAcknowledge = async (feedbackId: string, reply = "") => {
    setActionLoading(true);
    setActionError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/feedback/${feedbackId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menteeResponse: reply }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Could not save your acknowledgment.");
      setRespondingId(null);
      setResponseText("");
      setNotice(reply.trim() ? "Your response was sent and the feedback was acknowledged." : "Feedback acknowledged.");
      await fetchFeedback();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not save your acknowledgment.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Mentor Feedback & Guidance</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Structured evaluations, technical recommendations, and collaboration reviews from mentors.
        </p>
      </div>

      {actionError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{actionError}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}

      {loading ? (
        <div className="py-12 text-center text-xs text-muted-foreground">Loading feedback...</div>
      ) : feedbacks.length === 0 ? (
        <div className="py-12 text-center text-xs text-muted-foreground">
          No feedback published yet. As you submit reports and tasks, your mentors will share evaluations here.
        </div>
      ) : (
        <div className="space-y-4">
          {feedbacks.map((f) => (
            <Card key={f.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-sm text-foreground">{f.author?.name}</span>
                    <span className="text-[11px] text-muted-foreground ml-2">
                      {formatDate(f.createdAt)}
                    </span>
                  </div>
                  <Badge variant="outline">{f.category}</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-xs space-y-3">
                <p className="text-muted-foreground leading-relaxed">{f.content}</p>

                {/* Structured Evaluation Criteria if present */}
                {(f.technicalStrengths || f.areasForImprovement || f.recommendations) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border">
                    {f.technicalStrengths && (
                      <div className="p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-md">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 block mb-0.5">
                          Technical Strengths:
                        </span>
                        <p className="text-muted-foreground text-[11px]">{f.technicalStrengths}</p>
                      </div>
                    )}
                    {f.areasForImprovement && (
                      <div className="p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-md">
                        <span className="font-semibold text-amber-600 dark:text-amber-400 block mb-0.5">
                          Areas for Growth:
                        </span>
                        <p className="text-muted-foreground text-[11px]">{f.areasForImprovement}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Mentee acknowledgment & response */}
                {f.acknowledgedAt ? (
                  <div className="p-2.5 bg-muted/30 border border-border rounded-md text-[11px] space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Acknowledged on {formatDate(f.acknowledgedAt)}</span>
                    </div>
                    {f.menteeResponse && (
                      <p className="text-muted-foreground pl-5">
                        My Response: &ldquo;{f.menteeResponse}&rdquo;
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs gap-1"
                      onClick={() => setRespondingId(respondingId === f.id ? null : f.id)}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Add Response / Clarification
                    </Button>
                    <Button
                      size="sm"
                      loading={actionLoading}
                      onClick={() => handleAcknowledge(f.id)}
                      className="gap-1 text-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Acknowledge
                    </Button>
                  </div>
                )}

                {/* Response sub-form */}
                {respondingId === f.id && (
                  <div className="p-3 bg-muted/20 border border-border rounded-md space-y-2 mt-2">
                    <Textarea
                      placeholder="Write your response, questions, or clarification for your mentor..."
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRespondingId(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        loading={actionLoading}
                        onClick={() => handleAcknowledge(f.id, responseText)}
                        className="gap-1 text-xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Send Response & Acknowledge
                      </Button>
                    </div>
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
