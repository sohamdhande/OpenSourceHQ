"use client";
import { formatDate } from "@/lib/date";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Plus, Pin, Megaphone } from "lucide-react";

interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  publishedAt: string;
  cohort?: { id: string; name: string } | null;
  author: { id: string; name: string };
}

interface Cohort {
  id: string;
  name: string;
}

interface AdminAnnouncementsClientProps {
  announcements: AnnouncementItem[];
  cohorts: Cohort[];
  orgId: string;
  orgSlug: string;
}

export function AdminAnnouncementsClient({
  announcements: initialAnnouncements,
  cohorts,
  orgId,
  orgSlug,
}: AdminAnnouncementsClientProps) {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(initialAnnouncements);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          cohortId: cohortId || undefined,
          isPinned,
        }),
      });

      if (res.ok) {
        setShowBroadcastModal(false);
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Organization Announcements</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Broadcast cohort milestones, schedule updates, workshops, and critical notifications to members.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowBroadcastModal(true)} className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Broadcast Announcement
        </Button>
      </div>

      <div className="space-y-4">
        {announcements.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-xs text-muted-foreground">
              No announcements published yet. Click &quot;Broadcast Announcement&quot; to post an update.
            </CardContent>
          </Card>
        ) : (
          announcements.map((ann) => (
            <Card
              key={ann.id}
              className={ann.isPinned ? "border-amber-500/40 bg-amber-500/5" : ""}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-semibold">{ann.title}</CardTitle>
                    {ann.isPinned && (
                      <Badge variant="warning" className="flex items-center gap-1 text-[10px]">
                        <Pin className="w-3 h-3" /> Pinned
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      {ann.cohort?.name || "All Cohorts"}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDate(ann.publishedAt)}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  By {ann.author.name}
                </span>
              </CardHeader>
              <CardContent className="text-xs">
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{ann.body}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Broadcast Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold">Broadcast Announcement</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleBroadcastSubmit} className="space-y-3 text-xs">
                <Input
                  label="Title"
                  placeholder="e.g. Mid-term Mentorship Reviews Schedule"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />

                <Textarea
                  label="Announcement Content"
                  placeholder="Full message body, guidelines, and links..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                  rows={4}
                />

                <div>
                  <label className="font-medium text-foreground block mb-1">Target Audience</label>
                  <select
                    className="w-full bg-background border border-input rounded px-3 py-2 text-xs"
                    value={cohortId}
                    onChange={(e) => setCohortId(e.target.value)}
                  >
                    <option value="">All Members (Organization-wide)</option>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isPinnedCheck"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="rounded border-input text-primary"
                  />
                  <label htmlFor="isPinnedCheck" className="font-medium text-foreground cursor-pointer">
                    Pin this announcement to top of feed
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowBroadcastModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" loading={submitting}>
                    Broadcast
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

