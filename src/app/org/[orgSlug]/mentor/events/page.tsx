import React from "react";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Video } from "lucide-react";
import { formatDate, formatTimeUtc } from "@/lib/date";

export default async function MentorEventsPage({ params }: { params: { orgSlug: string } }) {
  const session = await getSession();
  if (!session) return null;

  const org = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
  });
  if (!org) return null;

  const membership = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: session.id } },
  });
  if (!session.isPlatformSuperAdmin && (membership?.status !== "ACTIVE" || !["ORG_ADMIN", "MENTOR"].includes(membership.role))) return null;

  const events = await prisma.event.findMany({
    where: {
      organizationId: org.id,
      ...(membership?.role === "MENTOR" ? { OR: [{ cohortId: null }, { cohort: { mentors: { some: { mentorId: session.id } } } }] } : {}),
    },
    include: {
      cohort: { select: { id: true, name: true } },
      attendances: { include: { user: { select: { id: true, name: true, imageUrl: true } } } },
    },
    orderBy: { startsAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Cohort Events & Office Hours</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Schedule weekly code reviews, technical syncs, and record mentee attendance.
        </p>
      </div>

      <div className="space-y-4">
        {events.map((ev) => (
          <Card key={ev.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-sm text-foreground">{ev.title}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({ev.cohort?.name || "All Cohorts"})
                  </span>
                </div>
                <Badge variant="outline">
                  {formatDate(ev.startsAt)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {formatDate(ev.startsAt)} &bull; {formatTimeUtc(ev.startsAt)} &mdash;{" "}
                  {formatTimeUtc(ev.endsAt)}
                </span>
                {ev.meetingUrl && (
                  <a
                    href={ev.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-4 text-primary hover:underline flex items-center gap-1"
                  >
                    <Video className="w-3.5 h-3.5" />
                    Meeting Link
                  </a>
                )}
              </div>

              <div>
                <span className="font-semibold text-foreground uppercase text-[10px] block mb-1">
                  Recorded Attendance ({ev.attendances.length})
                </span>
                <div className="flex flex-wrap gap-2">
                  {ev.attendances.map((att) => (
                    <span
                      key={att.id}
                      className="px-2 py-0.5 bg-muted rounded border border-border text-[11px] flex items-center gap-1.5"
                    >
                      <span>{att.user.name}</span>
                      <Badge variant={att.status === "PRESENT" ? "success" : "outline"} className="text-[9px] py-0">
                        {att.status}
                      </Badge>
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

