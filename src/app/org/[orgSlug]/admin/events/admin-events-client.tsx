"use client";
import { formatDateTimeInTimeZone, localDateTimeToUtcISOString } from "@/lib/timezone";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Plus, ExternalLink } from "lucide-react";

interface AttendanceRecord {
  id: string;
  status: string;
  note?: string | null;
  user: { id: string; name: string; email: string };
}

interface EventRsvpRecord {
  id: string;
  status: string;
  user: { id: string; name: string };
}

interface EventItem {
  id: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  meetingUrl?: string | null;
  location?: string | null;
  cohort?: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  attendances: AttendanceRecord[];
  rsvps: EventRsvpRecord[];
}

interface MenteeUser {
  id: string;
  name: string;
  email: string;
  cohortIds: string[];
}

interface Cohort {
  id: string;
  name: string;
}

interface AdminEventsClientProps {
  events: EventItem[];
  cohorts: Cohort[];
  mentees: MenteeUser[];
  orgId: string;
  organizationTimezone: string;
}

export function AdminEventsClient({
  events: initialEvents,
  cohorts,
  mentees,
  orgId,
  organizationTimezone,
}: AdminEventsClientProps) {
  const [events, setEvents] = useState<EventItem[]>(initialEvents);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [attendanceEvent, setAttendanceEvent] = useState<EventItem | null>(null);

  // Form state for creating event
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [location, setLocation] = useState("");
  const [submittingEvent, setSubmittingEvent] = useState(false);
  const [eventFormError, setEventFormError] = useState<string | null>(null);

  // Attendance recording state
  const [recordingUserId, setRecordingUserId] = useState<string | null>(null);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startsAt || !endsAt) return;

    setSubmittingEvent(true);
    setEventFormError(null);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          cohortId: cohortId || undefined,
          title: title.trim(),
          description: description || undefined,
          startsAt: localDateTimeToUtcISOString(startsAt, organizationTimezone),
          endsAt: localDateTimeToUtcISOString(endsAt, organizationTimezone),
          timezone: organizationTimezone,
          meetingUrl: meetingUrl.trim() || undefined,
          location: location.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Could not schedule the event.");
      setShowScheduleModal(false);
      window.location.reload();
    } catch (err) {
      setEventFormError(err instanceof Error ? err.message : "Could not schedule the event.");
    } finally {
      setSubmittingEvent(false);
    }
  };

  const handleRecordAttendance = async (
    eventId: string,
    userId: string,
    status: "PRESENT" | "ABSENT" | "EXCUSED"
  ) => {
    setRecordingUserId(userId);
    setAttendanceError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status }),
      });
      const responseData = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(responseData?.error?.message || "Could not update attendance.");

      // Update local state only after the server confirms the change.
      const user = mentees.find((mentee) => mentee.id === userId) || {
        id: userId,
        name: "Mentee",
        email: "",
      };
      setEvents((current) => current.map((event) => {
        if (event.id !== eventId) return event;
        const existing = event.attendances.find((item) => item.user.id === userId);
        const attendances = existing
          ? event.attendances.map((item) => item.user.id === userId ? { ...item, status } : item)
          : [...event.attendances, { id: responseData.attendance?.id || `att-${Date.now()}`, status, user }];
        return { ...event, attendances };
      }));
      setAttendanceEvent((current) => {
        if (!current || current.id !== eventId) return current;
        const existing = current.attendances.find((item) => item.user.id === userId);
        const attendances = existing
          ? current.attendances.map((item) => item.user.id === userId ? { ...item, status } : item)
          : [...current.attendances, { id: responseData.attendance?.id || `att-${Date.now()}`, status, user }];
        return { ...current, attendances };
      });
    } catch (err) {
      setAttendanceError(err instanceof Error ? err.message : "Could not update attendance.");
    } finally {
      setRecordingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Events & Attendance Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Schedule cohort syncs, workshops, and office hours; collect RSVPs; and record verified student attendance.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowScheduleModal(true)} className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Schedule Event
        </Button>
      </div>

      <div className="space-y-4">
        {events.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-xs text-muted-foreground">
              No events scheduled yet. Click &quot;Schedule Event&quot; above to create your first session.
            </CardContent>
          </Card>
        ) : (
          events.map((ev) => (
            <Card key={ev.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{ev.title}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {ev.cohort?.name || "All Cohorts"}
                    </Badge>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {formatDateTimeInTimeZone(ev.startsAt, ev.timezone || organizationTimezone)}
                  </Badge>
                </div>
                {ev.description && (
                  <p className="text-xs text-muted-foreground mt-1">{ev.description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-3 text-xs border-t border-border pt-3">
                <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                  <span>Ends: <strong className="text-foreground">{formatDateTimeInTimeZone(ev.endsAt, ev.timezone || organizationTimezone)}</strong></span>
                  <span>Host: <strong className="text-foreground">{ev.createdBy.name}</strong></span>
                  {ev.meetingUrl && (
                    <a
                      href={ev.meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1 font-mono text-[11px]"
                    >
                      Meeting Room <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <span>RSVPs: <strong className="text-foreground">{ev.rsvps.length}</strong></span>
                  <span>Recorded Attendance: <strong className="text-foreground">{ev.attendances.length}</strong></span>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex flex-wrap gap-1.5">
                    {ev.attendances.map((att) => (
                      <span
                        key={att.id}
                        className="px-2 py-0.5 bg-muted/40 rounded border border-border flex items-center gap-1 text-[11px]"
                      >
                        <span>{att.user.name}</span>
                        <Badge
                          variant={
                            att.status === "PRESENT"
                              ? "success"
                              : att.status === "EXCUSED"
                              ? "warning"
                              : "outline"
                          }
                          className="text-[9px] py-0 px-1"
                        >
                          {att.status}
                        </Badge>
                      </span>
                    ))}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAttendanceEvent(ev)}
                    className="text-[11px]"
                  >
                    Take / Update Attendance
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Schedule Event Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold">Schedule Cohort Event</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleCreateEvent} className="space-y-3 text-xs">
                <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">Times are entered and displayed in the organization timezone: <strong className="text-foreground">{organizationTimezone}</strong>.</p>
                {eventFormError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{eventFormError}</p>}
                <Input
                  label="Event Title"
                  placeholder="e.g. Architecture Sync & Code Review Workshop"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />

                <Textarea
                  label="Description / Agenda"
                  placeholder="Agenda items, preparation steps..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />

                <div>
                  <label className="font-medium text-foreground block mb-1">Target Cohort</label>
                  <select
                    className="w-full bg-background border border-input rounded px-3 py-2 text-xs"
                    value={cohortId}
                    onChange={(e) => setCohortId(e.target.value)}
                  >
                    <option value="">All Cohorts (Org-wide)</option>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Starts At"
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    required
                  />
                  <Input
                    label="Ends At"
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    required
                  />
                </div>

                <Input
                  label="Meeting URL (Google Meet / Zoom)"
                  placeholder="https://meet.google.com/xyz-abc-def"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                />

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowScheduleModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" loading={submittingEvent}>
                    Publish Event
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Record Attendance Modal */}
      {attendanceEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold">
                Record Attendance: {attendanceEvent.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              {attendanceError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{attendanceError}</p>}
              <p className="text-muted-foreground text-[11px]">
                Click a status button for each mentee to record their attendance immediately in PostgreSQL.
              </p>

              <div className="divide-y divide-border/40">
                {mentees.filter((mentee) => !attendanceEvent.cohort || mentee.cohortIds.includes(attendanceEvent.cohort.id)).length === 0 ? (
                  <p className="py-6 text-center text-muted-foreground">No active mentees are enrolled in this event cohort.</p>
                ) : mentees.filter((mentee) => !attendanceEvent.cohort || mentee.cohortIds.includes(attendanceEvent.cohort.id)).map((mentee) => {
                  const existing = attendanceEvent.attendances.find((a) => a.user.id === mentee.id);
                  const isRecording = recordingUserId === mentee.id;

                  return (
                    <div key={mentee.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-foreground">{mentee.name}</div>
                        <div className="text-[11px] text-muted-foreground">{mentee.email}</div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant={existing?.status === "PRESENT" ? "primary" : "outline"}
                          disabled={isRecording}
                          onClick={() => handleRecordAttendance(attendanceEvent.id, mentee.id, "PRESENT")}
                          className="h-7 text-[11px] px-2"
                        >
                          Present
                        </Button>
                        <Button
                          size="sm"
                          variant={existing?.status === "ABSENT" ? "destructive" : "outline"}
                          disabled={isRecording}
                          onClick={() => handleRecordAttendance(attendanceEvent.id, mentee.id, "ABSENT")}
                          className="h-7 text-[11px] px-2"
                        >
                          Absent
                        </Button>
                        <Button
                          size="sm"
                          variant={existing?.status === "EXCUSED" ? "secondary" : "outline"}
                          disabled={isRecording}
                          onClick={() => handleRecordAttendance(attendanceEvent.id, mentee.id, "EXCUSED")}
                          className="h-7 text-[11px] px-2"
                        >
                          Excused
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-3 border-t border-border">
                <Button size="sm" onClick={() => setAttendanceEvent(null)}>
                  Done
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
