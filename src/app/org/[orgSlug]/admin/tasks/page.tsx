import React from "react";
import prisma from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/date";

export default async function AdminTasksPage({ params }: { params: { orgSlug: string } }) {
  const org = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
  });
  if (!org) return null;

  const tasks = await prisma.task.findMany({
    where: { organizationId: org.id },
    include: {
      creator: { select: { id: true, name: true } },
      cohort: { select: { id: true, name: true } },
      repository: { select: { id: true, fullName: true } },
      assignments: {
        include: {
          mentee: { select: { id: true, name: true, email: true } },
          submissions: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Mentorship Tasks</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review all assigned tasks, submissions, and completion statuses across cohorts.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tasks List ({tasks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b border-border text-muted-foreground uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 font-semibold">Title & Category</th>
                  <th className="py-2.5 font-semibold">Cohort</th>
                  <th className="py-2.5 font-semibold">Priority</th>
                  <th className="py-2.5 font-semibold">Assignees</th>
                  <th className="py-2.5 font-semibold">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3">
                      <div className="font-semibold text-foreground">{task.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {task.category} &bull; Created by {task.creator.name}
                      </div>
                    </td>
                    <td className="py-3">{task.cohort?.name || "Global / Org-wide"}</td>
                    <td className="py-3">
                      <Badge
                        variant={
                          task.priority === "URGENT"
                            ? "destructive"
                            : task.priority === "HIGH"
                            ? "warning"
                            : "secondary"
                        }
                      >
                        {task.priority}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-col gap-1">
                        {task.assignments.map((a) => (
                          <div key={a.id} className="flex items-center gap-2">
                            <span>{a.mentee.name}</span>
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                              {a.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {task.dueAt ? formatDate(task.dueAt) : "No deadline"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

