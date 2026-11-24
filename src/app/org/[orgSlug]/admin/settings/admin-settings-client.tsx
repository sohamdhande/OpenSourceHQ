"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock3, Loader2, Save } from "lucide-react";

interface Props {
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  initialTimezone: string;
}

const TIMEZONE_SUGGESTIONS = ["Asia/Kolkata", "UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Africa/Nairobi", "Asia/Singapore", "Australia/Sydney"];

export function AdminSettingsClient({ organizationId, name, slug, description, initialTimezone }: Props) {
  const [timezone, setTimezone] = useState(initialTimezone || "UTC");
  const [savedTimezone, setSavedTimezone] = useState(initialTimezone || "UTC");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const saveTimezone = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/orgs/${encodeURIComponent(organizationId)}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: timezone.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message || "Could not update the organization timezone.");
      setTimezone(data.organization.timezone);
      setSavedTimezone(data.organization.timezone);
      setNotice("Organization timezone saved. New events and daily report dates will use this timezone.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the organization timezone.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="page-eyebrow"><Clock3 className="h-3.5 w-3.5" /> ORGANIZATION CONFIGURATION</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Organization settings</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Set the program-wide timezone used for event scheduling, event notifications, and daily report calendar dates.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">General information</CardTitle>
          <CardDescription>Organization identity is managed separately from member profile settings.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div><p className="text-xs font-medium text-muted-foreground">Organization name</p><p className="mt-1 text-sm font-semibold">{name}</p></div>
          <div><p className="text-xs font-medium text-muted-foreground">Organization slug</p><p className="mt-1 font-mono text-sm">{slug}</p></div>
          <div className="sm:col-span-2"><p className="text-xs font-medium text-muted-foreground">Description</p><p className="mt-1 text-sm leading-6">{description || "No organization description has been added."}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Clock3 className="h-4 w-4" /> Program timezone</CardTitle>
          <CardDescription>Use an IANA timezone identifier. Existing events keep their saved timezone; this setting applies to newly scheduled events and date-based program workflows.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="IANA timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            list="opensourcehq-timezone-suggestions"
            placeholder="Asia/Kolkata"
            autoComplete="off"
            aria-describedby="timezone-help"
          />
          <datalist id="opensourcehq-timezone-suggestions">
            {TIMEZONE_SUGGESTIONS.map((item) => <option key={item} value={item} />)}
          </datalist>
          <p id="timezone-help" className="text-xs leading-5 text-muted-foreground">Examples: Asia/Kolkata, Europe/London, America/New_York, UTC. Use a named region rather than a fixed UTC offset so daylight-saving rules are handled correctly.</p>
          {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
          {notice && <p role="status" className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{notice}</p>}
          <div className="flex justify-end"><Button onClick={() => void saveTimezone()} disabled={saving || !timezone.trim() || timezone.trim() === savedTimezone}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save timezone</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}
