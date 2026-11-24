import React from "react";
import prisma from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";

export default async function SelectOrganizationPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        include: { organization: true },
      },
    },
  });

  if (!user || user.memberships.length === 0) {
    redirect("/unauthorized");
  }

  // If only 1 organization, redirect immediately
  if (user.memberships.length === 1) {
    const m = user.memberships[0];
    const role = m.role;
    if (role === "ORG_ADMIN") redirect(`/org/${m.organization.slug}/admin`);
    if (role === "MENTOR") redirect(`/org/${m.organization.slug}/mentor`);
    if (role === "OBSERVER") redirect(`/org/${m.organization.slug}/observer`);
    redirect(`/org/${m.organization.slug}/student`);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-xl bg-primary/10 text-primary items-center justify-center font-bold text-lg shadow-sm border border-primary/20">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Select Organization</h1>
          <p className="text-xs text-muted-foreground">
            You hold active memberships in multiple organizations. Choose a workspace to enter.
          </p>
        </div>

        <div className="space-y-3">
          {user.memberships.map((m) => {
            const role = m.role;
            let targetUrl = `/org/${m.organization.slug}/student`;
            if (role === "ORG_ADMIN") targetUrl = `/org/${m.organization.slug}/admin`;
            else if (role === "MENTOR") targetUrl = `/org/${m.organization.slug}/mentor`;
            else if (role === "OBSERVER") targetUrl = `/org/${m.organization.slug}/observer`;

            return (
              <Card key={m.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">
                        {m.organization.name}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {m.role}
                      </Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      /{m.organization.slug}
                    </span>
                  </div>

                  <Link href={targetUrl}>
                    <Button size="sm" className="gap-1 text-xs">
                      Enter Workspace <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

