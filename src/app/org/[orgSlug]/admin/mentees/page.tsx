import React from "react";
import prisma from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function AdminMenteesPage({ params }: { params: { orgSlug: string } }) {
  const org = await prisma.organization.findUnique({ where: { slug: params.orgSlug }, select: { id: true, name: true } });
  if (!org) return null;
  const memberships = await prisma.organizationMembership.findMany({
    where: { organizationId: org.id, role: "MENTEE", status: "ACTIVE" },
    include: { user: { select: {
      id: true, name: true, email: true, status: true,
      cohortEnrollments: { where: { status: "ACTIVE", cohort: { organizationId: org.id } }, include: { cohort: { select: { id: true, name: true } } } },
      githubAccounts: { where: { connectionStatus: "CONNECTED" }, select: { username: true, profileUrl: true }, take: 1 },
    } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Mentees Directory</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Enrolled students and cohort affiliations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Enrolled Mentees ({memberships.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b border-border text-muted-foreground uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 font-semibold">Mentee</th>
                  <th className="py-2.5 font-semibold">Cohort</th>
                  <th className="py-2.5 font-semibold">GitHub</th>
                  <th className="py-2.5 font-semibold">Status</th>
                  <th className="py-2.5 font-semibold text-right">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {memberships.map((m) => {
                  const gh = m.user.githubAccounts[0];
                  return (
                    <tr key={m.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3">
                        <span className="font-semibold text-foreground">{m.user.name}</span>
                        <span className="text-[11px] text-muted-foreground block">{m.user.email}</span>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1">
                          {m.user.cohortEnrollments.map((e) => (
                            <Badge key={e.id} variant="secondary">
                              {e.cohort.name}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-3">
                        {gh ? (
                          <span className="font-mono text-primary">@{gh.username}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3">
                        <Badge variant="outline">{m.status}</Badge>
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          href={`/org/${params.orgSlug}/mentor/mentees/${m.user.id}`}
                          className="inline-flex items-center gap-1 rounded border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-secondary hover:text-primary"
                        >
                          View Profile →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

