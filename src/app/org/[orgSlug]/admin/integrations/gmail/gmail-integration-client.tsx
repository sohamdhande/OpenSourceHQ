"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  Mail,
  Send,
  ShieldCheck,
  Unlink,
} from "lucide-react";
import { formatDateTime } from "@/lib/date";

interface Props {
  orgId: string;
  orgName: string;
  orgSlug: string;
  status: {
    configured: boolean;
    connected: boolean;
    email?: string;
    connectedAt?: string;
    scope?: string;
    redirectUri: string;
  };
  queryStatus?: string;
  queryMessage?: string;
}

export function GmailIntegrationClient({
  orgId,
  orgName,
  orgSlug,
  status,
  queryStatus,
  queryMessage,
}: Props) {
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestEmail = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/integrations/gmail/test`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to send test email");
      }
      setTestResult({ success: true, message: data.message });
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Failed to send test email",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect Gmail? Automatic invitation emails will pause until reconnected.")) {
      return;
    }
    setDisconnecting(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/integrations/gmail/disconnect`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to disconnect");
      window.location.href = `/org/${orgSlug}/admin/integrations/gmail?status=disconnected`;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Disconnect failed");
      setDisconnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          <span>Gmail Integration & Email Dispatch</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Connect an authorized Gmail account via Google OAuth 2.0 to deliver automatic member invitations and notification emails.
        </p>
      </div>

      {queryStatus === "connected" && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Gmail account successfully connected! Member invitations and notification emails are now active.</span>
        </div>
      )}

      {queryStatus === "disconnected" && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground flex items-center gap-2">
          <Unlink className="w-4 h-4 shrink-0" />
          <span>Gmail integration has been disconnected.</span>
        </div>
      )}

      {queryStatus === "error" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Google OAuth error: {queryMessage || "Failed to complete Google authorization."}</span>
        </div>
      )}

      {testResult && (
        <div
          className={`rounded-lg border p-3 text-xs flex items-center gap-2 ${
            testResult.success
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{testResult.message}</span>
        </div>
      )}

      {/* Connection Overview Card */}
      <Card className="border-border/80">
        <CardHeader className="p-4 border-b border-border/60 bg-muted/10 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <span>Connection Status</span>
            <Badge variant={status.connected ? "success" : "secondary"}>
              {status.connected ? "Active & Connected" : "Not Connected"}
            </Badge>
          </CardTitle>
          <span className="text-[11px] font-mono text-muted-foreground">Organization: {orgName}</span>
        </CardHeader>
        <CardContent className="p-5 space-y-4 text-xs">
          {status.connected ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border border-border/60 bg-card">
                  <div className="text-muted-foreground font-medium text-[11px]">Connected Gmail Address</div>
                  <div className="text-sm font-bold text-foreground font-mono mt-1">{status.email}</div>
                </div>
                <div className="p-3 rounded-lg border border-border/60 bg-card">
                  <div className="text-muted-foreground font-medium text-[11px]">Connected Date</div>
                  <div className="text-sm font-semibold text-foreground mt-1">
                    {status.connectedAt ? formatDateTime(status.connectedAt) : "N/A"}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border/60 bg-muted/20">
                <div className="text-muted-foreground font-medium text-[11px] mb-1.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Granted Permissions</span>
                </div>
                <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                  <Badge variant="outline">openid</Badge>
                  <Badge variant="outline">email</Badge>
                  <Badge variant="outline">https://www.googleapis.com/auth/gmail.send</Badge>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <Button
                  size="sm"
                  onClick={handleTestEmail}
                  disabled={testing || disconnecting}
                  className="gap-1.5 text-xs"
                >
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Send Test Email</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={testing || disconnecting}
                  className="gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:border-destructive/40"
                >
                  {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                  <span>Disconnect</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                Connecting your Gmail account grants OpenSourceHQ authorization to send out invitation links to new mentors, mentees, and administrators directly from your sender address without third-party email deliverability penalties.
              </p>

              {status.configured ? (
                <div>
                  <a href={`/api/auth/google?orgSlug=${orgSlug}`}>
                    <Button size="sm" className="gap-2 text-xs font-semibold">
                      <Mail className="w-3.5 h-3.5" />
                      <span>Connect Gmail with Google OAuth</span>
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </Button>
                  </a>
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 text-xs flex items-center gap-2">
                  <KeyRound className="w-4 h-4 shrink-0" />
                  <span>
                    Google OAuth credentials are not fully configured in your environment. Ensure <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> are provided in your environment variables.
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Google Cloud Console Setup Reference Card */}
      <Card className="border-border/80">
        <CardHeader className="p-4 border-b border-border/60 bg-muted/10">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            <span>Google Cloud Console Configuration</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-3 text-xs leading-relaxed">
          <p className="text-muted-foreground">
            In your Google Cloud Console project (APIs & Services &rarr; Credentials &rarr; OAuth 2.0 Client IDs), ensure the following values are configured:
          </p>

          <div className="space-y-2">
            <div>
              <span className="font-semibold text-foreground block mb-1">Authorized Redirect URI (exact match):</span>
              <div className="p-2.5 rounded-md bg-muted/50 border border-border font-mono text-[11px] text-primary break-all select-all">
                {status.redirectUri}
              </div>
            </div>

            <div>
              <span className="font-semibold text-foreground block mb-1">Requested OAuth Scopes:</span>
              <div className="p-2.5 rounded-md bg-muted/50 border border-border font-mono text-[11px] text-muted-foreground">
                openid, https://www.googleapis.com/auth/userinfo.email, https://www.googleapis.com/auth/gmail.send
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

