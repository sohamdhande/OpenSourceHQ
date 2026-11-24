import React from "react";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { SignOutButton } from "@/components/layout/sign-out-button";

export default async function PlatformAdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isPlatformSuperAdmin) redirect("/unauthorized");

  const [organizations, users, cohorts, activeMemberships] = await Promise.all([
    prisma.organization.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.cohort.count(),
    prisma.organizationMembership.count({ where: { status: "ACTIVE" } }),
  ]);

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">OpenSourceHQ</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Platform administration</h1>
          <p className="mt-1 text-sm text-muted-foreground">Global workspace overview for platform administrators.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardHeader><CardTitle className="text-xs">Organizations</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{organizations.length}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-xs">Active users</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{users}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-xs">Cohorts</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{cohorts}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-xs">Active memberships</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{activeMemberships}</CardContent></Card>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-sm">Organizations</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {organizations.map((organization) => (
                <div key={organization.id} className="flex items-center justify-between gap-4 py-3">
                  <div><p className="text-sm font-medium">{organization.name}</p><p className="text-xs text-muted-foreground">/{organization.slug}</p></div>
                  <Link className="text-xs font-medium text-primary hover:underline" href={`/org/${organization.slug}/admin`}>Open admin workspace</Link>
                </div>
              ))}
              {organizations.length === 0 && <p className="py-4 text-sm text-muted-foreground">No organizations have been created yet.</p>}
            </div>
          </CardContent>
        </Card>
        <SignOutButton />
      </div>
    </main>
  );
}
