"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Clock3, ExternalLink, HelpCircle, Loader2, MapPin, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { formatDateTimeInTimeZone } from "@/lib/timezone";

type RSVP = {
  id: string;
  status: "YES" | "NO" | "MAYBE";
  isExcuseRequested: boolean;
  excuseReason: string | null;
  notes: string | null;
};
type Event = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  meetingUrl: string | null;
  location: string | null;
  cohort: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  rsvps: RSVP[];
};

const statusVariant = { YES: "success", NO: "destructive", MAYBE: "warning" } as const;
const statusLabel = { YES: "Attending", NO: "Not attending", MAYBE: "Maybe" } as const;

export function StudentEventsClient({ organizationId, organizationName }: { organizationId: string; organizationName: string }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [excuseReason, setExcuseReason] = useState("");
  const [savingEventId, setSavingEventId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"UPCOMING" | "PAST">("UPCOMING");

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`/api/events?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Could not load cohort events.");
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load cohort events.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { void loadEvents(); }, [loadEvents]);

  const visibleEvents = useMemo(() => {
    const now = Date.now();
    return events.filter((event) => filter === "UPCOMING" ? new Date(event.endsAt).getTime() >= now : new Date(event.endsAt).getTime() < now);
  }, [events, filter]);

  const submitRsvp = async (event: Event, status: RSVP["status"], requestExcuse = false) => {
    const reason = excuseReason.trim();
    if (requestExcuse && reason.length < 5) {
      setActionError("Add at least 5 characters explaining why you cannot attend.");
      return;
    }
    setSavingEventId(event.id);
    setActionError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(event.id)}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          isExcuseRequested: requestExcuse,
          excuseReason: requestExcuse ? reason : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Could not save your RSVP.");
      setEvents((current) => current.map((item) => item.id === event.id ? { ...item, rsvps: [data.rsvp] } : item));
      setActiveEventId(null);
      setExcuseReason("");
      setNotice(requestExcuse ? "Your absence request has been sent." : "Your RSVP has been updated.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not save your RSVP.");
    } finally {
      setSavingEventId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="page-eyebrow"><CalendarDays className="h-3.5 w-3.5" /> COHORT CALENDAR</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Events & sessions</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">View upcoming sessions for {organizationName}, RSVP, and request an absence when needed. Times are shown in each event’s organization timezone.</p>
        </div>
        <div className="flex rounded-xl border border-border bg-card p-1" aria-label="Event time filter">
          <button type="button" onClick={() => setFilter("UPCOMING")} aria-pressed={filter === "UPCOMING"} className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${filter === "UPCOMING" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Upcoming</button>
          <button type="button" onClick={() => setFilter("PAST")} aria-pressed={filter === "PAST"} className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${filter === "PAST" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Past events</button>
        </div>
      </header>

      {loadError && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{loadError} <button className="ml-2 font-semibold underline" onClick={() => void loadEvents()}>Retry</button></div>}
      {actionError && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{actionError}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</div>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading events…</div>
      ) : visibleEvents.length === 0 ? (
        <Card className="border-dashed"><CardContent className="flex flex-col items-center px-6 py-14 text-center"><div className="empty-icon"><CalendarDays className="h-6 w-6" /></div><h2 className="mt-4 text-base font-semibold">No {filter === "UPCOMING" ? "upcoming" : "past"} events</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">When your organization or assigned mentor schedules a cohort session, it will appear here.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {visibleEvents.map((event) => {
            const rsvp = event.rsvps?.[0];
            const isSaving = savingEventId === event.id;
            const isPast = new Date(event.endsAt).getTime() < Date.now();
            const showExcuse = activeEventId === event.id;
            return <Card key={event.id} className="overflow-hidden">
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold">{event.title}</h2>
                      {event.cohort && <Badge variant="cyan">{event.cohort.name}</Badge>}
                      {rsvp && <Badge variant={statusVariant[rsvp.status]}>{statusLabel[rsvp.status]}</Badge>}
                      {rsvp?.isExcuseRequested && <Badge variant="warning">Absence requested</Badge>}
                    </div>
                    {event.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{event.description}</p>}
                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatDateTimeInTimeZone(event.startsAt, event.timezone || "UTC")}</span>
                      <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />Ends {formatDateTimeInTimeZone(event.endsAt, event.timezone || "UTC")}</span>
                      {event.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{event.location}</span>}
                    </div>
                    <p className="mt-3 text-[11px] text-muted-foreground">Scheduled by {event.createdBy?.name || "Program team"}</p>
                    {rsvp?.isExcuseRequested && rsvp.excuseReason && <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-muted-foreground">Your absence request: {rsvp.excuseReason}</p>}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                    {event.meetingUrl && <a href={event.meetingUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"><Video className="h-3.5 w-3.5" />Join session <ExternalLink className="h-3 w-3" /></a>}
                    {!isPast && <>
                      <Button size="sm" variant={rsvp?.status === "YES" && !rsvp.isExcuseRequested ? "secondary" : "outline"} disabled={isSaving} onClick={() => void submitRsvp(event, "YES")}>{isSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}Attend</Button>
                      <Button size="sm" variant={rsvp?.status === "MAYBE" ? "secondary" : "outline"} disabled={isSaving} onClick={() => void submitRsvp(event, "MAYBE")}><HelpCircle className="mr-1.5 h-3.5 w-3.5" />Maybe</Button>
                      <Button size="sm" variant="ghost" disabled={isSaving} onClick={() => { setActiveEventId(showExcuse ? null : event.id); setActionError(null); }} >Request absence</Button>
                    </>}
                  </div>
                </div>
                {showExcuse && !isPast && <div className="mt-5 space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                  <p className="text-sm font-medium">Request an absence</p>
                  <Textarea label="Reason" value={excuseReason} onChange={(event) => setExcuseReason(event.target.value)} placeholder="Explain why you cannot attend this session." maxLength={1000} />
                  <div className="flex flex-wrap justify-end gap-2"><Button size="sm" variant="outline" onClick={() => { setActiveEventId(null); setExcuseReason(""); }}>Cancel</Button><Button size="sm" disabled={isSaving || excuseReason.trim().length < 5} onClick={() => void submitRsvp(event, "NO", true)}>{isSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Submit request</Button></div>
                </div>}
              </CardContent>
            </Card>;
          })}
        </div>
      )}
    </div>
  );
}
