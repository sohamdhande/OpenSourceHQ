import { formatDateTime } from "@/lib/date";
import React from "react";
import prisma from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminAuditPage({ params }: { params: { orgSlug: string } }) {
  const org = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
  });
  if (!org) return null;

  const logs = await prisma.auditLog.findMany({
    where: { organizationId: org.id },
    include: {
      actor: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Security Audit Logs</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Append-only verifiable audit trail for sensitive administrative, membership, and review actions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Audit Log Records ({logs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b border-border text-muted-foreground uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 font-semibold">Timestamp</th>
                  <th className="py-2.5 font-semibold">Actor</th>
                  <th className="py-2.5 font-semibold">Action</th>
                  <th className="py-2.5 font-semibold">Target Type / ID</th>
                  <th className="py-2.5 font-semibold">Safe Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3 text-muted-foreground font-sans">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="py-3 font-sans">
                      <span className="font-medium text-foreground">{log.actor?.name || "System"}</span>
                      <span className="text-[10px] text-muted-foreground block">{log.actor?.email}</span>
                    </td>
                    <td className="py-3">
                      <Badge variant="outline">{log.action}</Badge>
                    </td>
                    <td className="py-3">
                      <span className="text-foreground">{log.targetType}</span>
                      <span className="text-muted-foreground text-[10px] block">{log.targetId}</span>
                    </td>
                    <td className="py-3 max-w-xs truncate text-muted-foreground">
                      {log.metadata ? JSON.stringify(log.metadata) : "-"}
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

