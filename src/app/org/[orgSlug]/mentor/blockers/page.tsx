"use client";
import { formatDate } from "@/lib/date";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { AlertCircle, CheckCircle, Clock, Filter, MessageSquare, ShieldAlert } from "lucide-react";

interface Blocker {
  id: string;
  title: string;
  description: string;
  category: string;
  urgency: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "REOPENED";
  source: string;
  sourceId?: string | null;
  response?: string | null;
  firstRespondedAt?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  cohort?: { id: string; name: string } | null;
  mentee: { id: string; name: string; email: string; imageUrl?: string | null };
  mentor?: { id: string; name: string; email: string } | null;
}

export default function MentorBlockerTriagePage({ params }: { params: { orgSlug: string } }) {
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBlocker, setSelectedBlocker] = useState<Blocker | null>(null);
  const [responseGuidance, setResponseGuidance] = useState("");
  const [responseStatus, setResponseStatus] = useState<"IN_PROGRESS" | "RESOLVED">("RESOLVED");
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL_ACTIVE");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("ALL");

  const fetchBlockers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/blockers");
      const data = await res.json();
      if (data.blockers) {
        setBlockers(data.blockers);
        if (selectedBlocker) {
          const updated = data.blockers.find((b: Blocker) => b.id === selectedBlocker.id);
          if (updated) setSelectedBlocker(updated);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBlocker || !responseGuidance.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/blockers/${selectedBlocker.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: responseGuidance,
          status: responseStatus,
        }),
      });
      if (res.ok) {
        setResponseGuidance("");
        setSelectedBlocker(null);
        await fetchBlockers();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredBlockers = blockers.filter((b) => {
    if (statusFilter === "ALL_ACTIVE") {
      if (b.status === "RESOLVED") return false;
    } else if (statusFilter !== "ALL") {
      if (b.status !== statusFilter) return false;
    }
    if (urgencyFilter !== "ALL" && b.urgency !== urgencyFilter) {
      return false;
    }
    return true;
  });

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "CRITICAL":
        return <Badge variant="destructive" className="font-mono text-[10px]">CRITICAL</Badge>;
      case "HIGH":
        return <Badge variant="warning" className="font-mono text-[10px]">HIGH</Badge>;
      case "MEDIUM":
        return <Badge variant="secondary" className="font-mono text-[10px]">MEDIUM</Badge>;
      default:
        return <Badge variant="outline" className="font-mono text-[10px]">LOW</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "RESOLVED":
        return <Badge variant="success" className="text-[10px]">RESOLVED</Badge>;
      case "IN_PROGRESS":
        return <Badge variant="warning" className="text-[10px]">IN PROGRESS</Badge>;
      case "REOPENED":
        return <Badge variant="destructive" className="text-[10px]">REOPENED</Badge>;
      default:
        return <Badge variant="destructive" className="text-[10px]">OPEN</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            Blocker Triage & Resolution
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Identify technical and logistical impediments raised by mentees, provide immediate unblocking guidance, and track resolution.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchBlockers}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-card border border-border rounded-lg text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-medium text-foreground">Status:</span>
          <select
            className="bg-background border border-input rounded px-2.5 py-1 text-xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL_ACTIVE">Active Blockers (Open / Investigating / Reopened)</option>
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="REOPENED">Reopened</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">Urgency:</span>
          <select
            className="bg-background border border-input rounded px-2.5 py-1 text-xs"
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
          >
            <option value="ALL">All Urgencies</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        <div className="ml-auto text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filteredBlockers.length}</span> of {blockers.length} items
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Blocker List */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">Loading blockers...</div>
          ) : filteredBlockers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center space-y-2">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-sm font-medium text-foreground">No matching blockers found</p>
                <p className="text-xs text-muted-foreground">All mentees are currently unblocked or filtered out.</p>
              </CardContent>
            </Card>
          ) : (
            filteredBlockers.map((blocker) => {
              const isSelected = selectedBlocker?.id === blocker.id;
              return (
                <Card
                  key={blocker.id}
                  className={`cursor-pointer transition-all hover:border-primary/50 ${
                    isSelected ? "ring-2 ring-primary border-primary bg-accent/20" : ""
                  }`}
                  onClick={() => {
                    setSelectedBlocker(blocker);
                    setResponseGuidance(blocker.response || "");
                  }}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">{blocker.title}</span>
                          {getUrgencyBadge(blocker.urgency)}
                          {getStatusBadge(blocker.status)}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Mentee: <span className="font-medium text-foreground">{blocker.mentee.name}</span>
                          {blocker.cohort && <span> &bull; Cohort: {blocker.cohort.name}</span>}
                          <span> &bull; Category: {blocker.category}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDate(blocker.createdAt)}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-1 space-y-2 text-xs">
                    <p className="text-muted-foreground line-clamp-2">{blocker.description}</p>
                    {blocker.response && (
                      <div className="p-2 bg-muted/40 rounded border border-border text-[11px]">
                        <span className="font-semibold text-foreground">Latest Guidance:</span>
                        <p className="text-muted-foreground mt-0.5 line-clamp-1">{blocker.response}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Action / Detail Pane */}
        <div>
          {selectedBlocker ? (
            <Card className="sticky top-6">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
                    Triage & Guidance
                  </span>
                  {getStatusBadge(selectedBlocker.status)}
                </div>
                <CardTitle className="text-sm font-semibold mt-1">{selectedBlocker.title}</CardTitle>
                <div className="text-[11px] text-muted-foreground">
                  Raised by <span className="font-medium text-foreground">{selectedBlocker.mentee.name}</span> ({selectedBlocker.mentee.email})
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-xs">
                <div>
                  <span className="font-semibold text-foreground block mb-1">Issue Description:</span>
                  <div className="p-2.5 bg-muted/30 rounded border border-border text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {selectedBlocker.description}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                  <div>
                    <span className="font-medium block text-foreground">Urgency:</span>
                    {getUrgencyBadge(selectedBlocker.urgency)}
                  </div>
                  <div>
                    <span className="font-medium block text-foreground">Report Source:</span>
                    <span>{selectedBlocker.source}</span>
                  </div>
                </div>

                <form onSubmit={handleResolveSubmit} className="space-y-3 pt-3 border-t border-border">
                  <span className="font-semibold text-foreground block">Mentor Guidance & Action:</span>
                  <Textarea
                    placeholder="Provide specific technical unblocking steps, suggested PR revisions, or documentation links..."
                    value={responseGuidance}
                    onChange={(e) => setResponseGuidance(e.target.value)}
                    required
                    rows={4}
                  />

                  <div>
                    <label className="font-medium text-foreground block mb-1 text-[11px]">
                      Update Status to:
                    </label>
                    <select
                      className="w-full bg-background border border-input rounded px-3 py-1.5 text-xs"
                      value={responseStatus}
                      onChange={(e) => setResponseStatus(e.target.value as any)}
                    >
                      <option value="RESOLVED">Mark as Resolved</option>
                      <option value="IN_PROGRESS">Mark as In-Progress</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedBlocker(null)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" loading={submitting}>
                      Submit Guidance
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="text-center py-12 px-4 text-muted-foreground text-xs">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="font-medium text-foreground">Select a blocker to triage</p>
              <p className="mt-1">
                Choose any blocker on the left to review its details, inspect the mentee&apos;s report context, and submit actionable unblocking guidance.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
