import React from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ArrowLeft, Mail, ExternalLink } from "lucide-react";

export default function UnauthorizedAccessPage({
  searchParams,
}: {
  searchParams: { reason?: string; message?: string };
}) {
  const reason = searchParams.reason || "no_membership";
  const customMessage = searchParams.message;

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-xl bg-destructive/10 text-destructive items-center justify-center font-bold text-lg shadow-sm border border-destructive/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Access Restricted</h1>
          <p className="text-xs text-muted-foreground">
            Invitation Required to Join an Organization Workspace
          </p>
        </div>

        <Card className="border-border">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-semibold">
              {reason === "no_invitation" ? "No Active Invitation Found" : "Membership Required"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4 text-xs leading-relaxed text-muted-foreground">
            <p>
              {customMessage ||
                "Your authenticated GitHub account is not currently associated with an active organization or cohort invitation in OpenSourceHQ."}
            </p>

            <div className="p-3 bg-muted/40 border border-border rounded-lg space-y-2">
              <span className="font-semibold text-foreground block text-[11px]">
                How to join OpenSourceHQ:
              </span>
              <ul className="list-disc list-inside space-y-1 text-[11px]">
                <li>Contact your mentorship program manager or organization admin.</li>
                <li>Request an invitation sent to your verified GitHub email address.</li>
                <li>Once invited, signing in with GitHub will immediately enroll you.</li>
              </ul>
            </div>

            <p className="text-[11px]">
              If you already have an existing email/password account in this organization, sign in with your credentials and connect your GitHub identity from your Profile page.
            </p>

            <div className="pt-2 flex items-center justify-between">
              <Link href="/login">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Return to Sign In
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

