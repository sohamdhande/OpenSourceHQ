"use client";
import { formatDate, formatDateTime } from "@/lib/date";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Clock, Plus, RefreshCw, X } from "lucide-react";

export default function StudentBlockersPage({ params }: { params: { orgSlug: string } }) {
  const [blockers, setBlockers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [urgency, setUrgency] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("MEDIUM");
  const [submitting, setSubmitting] = useState(false);
  const [reopeningId, setReopeningId] = useState<string | null>(null);

  const fetchBlockers = async () => {
    setLoading(true);
    try {
      const sessionRes = await fetch(`/api/auth/session?orgSlug=${encodeURIComponent(params.orgSlug)}`);
      const sessionData = await sessionRes.json();
      const orgId = sessionData.user?.activeOrgId;
      if (!orgId) throw new Error(sessionData.error?.message || "No active organization access.");
      const res = await fetch(`/api/blockers?organizationId=${encodeURIComponent(orgId)}`);
      const data = await res.json();
      if (data.blockers) setBlockers(data.blockers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockers();
  }, []);

  const handleCreateBlocker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      const sessionRes = await fetch(`/api/auth/session?orgSlug=${encodeURIComponent(params.orgSlug)}`);
      const sessionData = await sessionRes.json();
      const orgId = sessionData.user?.activeOrgId;

      const res = await fetch("/api/blockers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          title,
          description,
          category,
          urgency,
          source: "GENERAL",
        }),
      });

      if (res.ok) {
        setTitle("");
        setDescription("");
        setShowCreate(false);
        fetchBlockers();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopen = async (blockerId: string) => {
    setReopeningId(blockerId);
    try {
      const res = await fetch(`/api/blockers/${blockerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REOPEN" }),
      });
      if (res.ok) {
        fetchBlockers();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReopeningId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Blockers & Assistance</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Log technical hurdles, track mentor triage response, and resolve obstacles quickly.
          </p>
        </div>
        <Button
          size="sm"
          variant={showCreate ? "outline" : "primary"}
          onClick={() => setShowCreate(!showCreate)}
          className="gap-1.5 text-xs font-mono"
        >
          {showCreate ? (
            <>
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              <span>Raise New Blocker</span>
            </>
          )}
        </Button>
      </div>

      {showCreate && (
        <Card className="border-primary/40 shadow-xs">
          <CardHeader>
            <CardTitle className="text-sm">Raise a Blocker for Mentor Help</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateBlocker} className="space-y-4 text-xs">
              <Input
                label="Blocker Summary"
                placeholder="e.g. Memory barrier race condition on ARM64 cross-compile"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-medium text-foreground block mb-1.5">Category</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="General">General Technical</option>
                    <option value="Compiler / Toolchain">Compiler / Toolchain</option>
                    <option value="Kernel / Systems">Kernel / Systems</option>
                    <option value="Environment / Permissions">Environment / Permissions</option>
                    <option value="Architecture / Design">Architecture / Design</option>
                  </select>
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1.5">Urgency Level</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as any)}
                  >
                    <option value="LOW">Low (Can continue other tasks)</option>
                    <option value="MEDIUM">Medium (Slowing progress)</option>
                    <option value="HIGH">High (Blocked on critical path)</option>
                    <option value="CRITICAL">Critical (Completely unable to proceed)</option>
                  </select>
                </div>
              </div>

              <Textarea
                label="Detailed Description & Steps Attempted"
                placeholder="Include error messages, reproducible steps, environment details, and what you have already tried..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreate(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={submitting}>
                  Submit Blocker
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="py-8 text-center text-xs text-muted-foreground">Loading blockers...</div>
      ) : blockers.length === 0 ? (
        <div className="py-12 text-center text-xs text-muted-foreground">
          No blockers logged. When you run into technical hurdles or environment issues, raise a blocker here!
        </div>
      ) : (
        <div className="space-y-4">
          {blockers.map((b) => (
            <Card key={b.id} className={b.status === "OPEN" ? "border-amber-500/30" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{b.title}</span>
                    <Badge
                      variant={
                        b.urgency === "CRITICAL" || b.urgency === "HIGH"
                          ? "destructive"
                          : b.urgency === "MEDIUM"
                          ? "warning"
                          : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {b.urgency}
                    </Badge>
                  </div>
                  <Badge variant={b.status === "RESOLVED" ? "success" : "outline"}>
                    {b.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>Category: {b.category}</span>
                  <span>&bull; Raised: {formatDateTime(b.createdAt)}</span>
                  {b.cohort && <span>&bull; Cohort: {b.cohort.name}</span>}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <p className="text-muted-foreground leading-relaxed">{b.description}</p>

                {/* Mentor guidance / response if available */}
                {b.response && (
                  <div className="p-3 bg-muted/30 border border-border rounded-md space-y-1">
                    <div className="flex items-center justify-between font-semibold text-foreground">
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Mentor Guidance ({b.mentor?.name || "Mentor"}):</span>
                      </div>
                      {b.resolvedAt && (
                        <span className="text-[10px] text-muted-foreground font-normal">
                          Resolved {formatDate(b.resolvedAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground leading-relaxed pl-5">{b.response}</p>
                  </div>
                )}

                {/* Action to reopen if resolved but still blocked */}
                {b.status === "RESOLVED" && (
                  <div className="flex justify-end pt-2 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 text-muted-foreground hover:text-foreground gap-1"
                      loading={reopeningId === b.id}
                      onClick={() => handleReopen(b.id)}
                    >
                      <RefreshCw className="w-3 h-3" />
                      Still Blocked? Reopen Blocker
                    </Button>
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

