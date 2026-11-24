import { formatDateTime } from "@/lib/date";
import React from "react";
import prisma from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isGitHubAppConfigured, isGitHubOAuthConfigured } from "@/features/github/github-auth-service";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export default async function AdminGitHubIntegrationPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string };
  searchParams?: { installation?: string };
}) {
  const org = await prisma.organization.findUnique({
    where: { slug: params.orgSlug },
    include: {
      githubInstallations: { orderBy: { installedAt: "desc" } },
      repositories: {
        include: {
          cohortRepositories: { include: { cohort: true } },
        },
      },
    },
  });

  const oauthConfigured = isGitHubOAuthConfigured();
  const appConfigured = isGitHubAppConfigured();
  const webhookConfigured = Boolean(process.env.GITHUB_WEBHOOK_SECRET);
  const configured = oauthConfigured && appConfigured && webhookConfigured;
  const installation = org?.githubInstallations[0] || null;
  const installationStatus = searchParams?.installation;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">GitHub App & Integration</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure GitHub App credentials, HMAC webhook endpoints, and tracked repositories.
        </p>
      </div>

      {installationStatus === "connected" && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400">
          GitHub App installation connected and verified.
        </div>
      )}
      {installationStatus === "failed" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          GitHub installation could not be verified. Check the App ID, private key, and installation permissions.
        </div>
      )}
      {installationStatus === "cancelled" && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          GitHub installation was cancelled.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {appConfigured && org ? (
          <a
            href={`/api/orgs/${org.id}/github/install`}
            className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            {installation ? "Manage GitHub App Installation" : "Install GitHub App"}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">Configure the GitHub App credentials to enable installation.</span>
        )}
        <span className="text-[11px] text-muted-foreground">OAuth: {oauthConfigured ? "configured" : "not configured"}</span>
        <span className="text-[11px] text-muted-foreground">App API: {appConfigured ? "configured" : "not configured"}</span>
        <span className="text-[11px] text-muted-foreground">Webhook: {webhookConfigured ? "configured" : "not configured"}</span>
      </div>

      {installation && (
        <div className="p-4 rounded-lg border border-border bg-card text-xs space-y-1">
          <h3 className="font-semibold text-sm">Connected GitHub installation</h3>
          <p className="text-muted-foreground">{installation.accountLogin} ({installation.accountType}) · Installation ID {installation.providerInstallationId}</p>
          <p className="text-muted-foreground">{installation.suspendedAt ? "Installation suspended on GitHub." : "Installation active."}</p>
        </div>
      )}

      {/* Integration Status Banner */}
      {!configured ? (
        <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold text-sm">GitHub integration not configured (Running in local fixture mode)</h4>
            <p className="text-muted-foreground">
              One or more GitHub user authorization or webhook credentials are missing. Live OAuth and webhook ingestion remain disabled until configured. Existing fixture activities are visibly labelled.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm">GitHub App Configured</h4>
            <p className="text-muted-foreground">GitHub user authorization and signed webhook verification are configured. Organization repository access additionally requires an active GitHub App installation.</p>
          </div>
        </div>
      )}

      {/* Webhook Configuration Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Webhook Endpoint & Secret Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div>
            <label className="font-semibold block text-muted-foreground uppercase text-[10px]">
              Payload URL
            </label>
            <div className="mt-1 font-mono p-2 bg-muted rounded border border-border">
              {process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/webhooks/github
            </div>
          </div>

          <div>
            <label className="font-semibold block text-muted-foreground uppercase text-[10px]">
              Content type
            </label>
            <div className="mt-1 font-mono p-2 bg-muted rounded border border-border">
              application/json
            </div>
          </div>

          <div>
            <label className="font-semibold block text-muted-foreground uppercase text-[10px]">
              Supported Events
            </label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {["installation", "push", "pull_request", "issues", "pull_request_review", "issue_comment", "release"].map((ev) => (
                <span key={ev} className="px-2 py-0.5 bg-muted rounded font-mono text-[11px]">
                  {ev}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tracked Repositories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tracked Repositories ({org?.repositories.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b border-border text-muted-foreground uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 font-semibold">Repository</th>
                  <th className="py-2.5 font-semibold">Sync Status</th>
                  <th className="py-2.5 font-semibold">Cohorts</th>
                  <th className="py-2.5 font-semibold">Last Synced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {org?.repositories.map((repo) => (
                  <tr key={repo.id}>
                    <td className="py-3">
                      <a
                        href={repo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-primary hover:underline font-mono"
                      >
                        {repo.fullName}
                      </a>
                      <p className="text-[11px] text-muted-foreground">{repo.description}</p>
                    </td>
                    <td className="py-3">
                      <Badge variant="success">{repo.syncStatus}</Badge>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {repo.cohortRepositories.map((cr) => (
                          <span key={cr.id} className="px-1.5 py-0.5 bg-muted rounded text-[10px]">
                            {cr.cohort.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {repo.lastSyncedAt ? formatDateTime(repo.lastSyncedAt) : "Never"}
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

