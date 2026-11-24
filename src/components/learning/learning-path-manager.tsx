"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, BookOpen, Loader2, Plus, Trash2 } from "lucide-react";

type CohortOption = { id: string; name: string };
type PathSummary = { id: string; title: string; description: string | null; cohort: CohortOption | null; milestones: { id: string; title: string; description: string | null }[] };
interface Props { organizationId: string; cohorts: CohortOption[]; canCreateOrganizationWide: boolean; heading?: string }

export function LearningPathManager({ organizationId, cohorts, canCreateOrganizationWide, heading = "Learning paths" }: Props) {
  const router = useRouter();
  const [paths, setPaths] = useState<PathSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cohortId, setCohortId] = useState(cohorts.length === 1 ? cohorts[0].id : "");
  const [milestones, setMilestones] = useState([{ title: "", description: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadPaths = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/learning/paths?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Could not load learning paths.");
      setPaths(data.paths || []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load learning paths."); }
    finally { setLoading(false); }
  }, [organizationId]);
  useEffect(() => { void loadPaths(); }, [loadPaths]);

  const createPath = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/learning/paths", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, title, description, cohortId: cohortId || null, milestones }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Could not publish learning path.");
      setTitle(""); setDescription(""); setMilestones([{ title: "", description: "" }]);
      setNotice(`Published “${data.path.title}” with ${data.path.milestones.length} milestones.`);
      await loadPaths(); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not publish learning path."); }
    finally { setSaving(false); }
  };

  return <div className="mx-auto max-w-5xl space-y-7">
    <header><p className="page-eyebrow"><Award className="h-3.5 w-3.5" /> PROGRAM DESIGN</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{heading}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Create structured learning plans and publish milestones to the whole organization or a specific cohort. Learners submit evidence; mentors approve or request changes.</p></header>
    {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}

    <Card>
      <CardHeader><CardTitle className="text-base">Publish a learning path</CardTitle><CardDescription>Use concrete outcomes. Each milestone becomes an evidence-and-review checkpoint for enrolled mentees.</CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={createPath} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2"><Input label="Path title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. First OpenMRS contribution" minLength={3} maxLength={120} required /><div className="space-y-1.5"><label htmlFor="path-cohort" className="text-xs font-medium">Publish to</label><select id="path-cohort" value={cohortId} onChange={(event) => setCohortId(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" required={!canCreateOrganizationWide}><option value="">{canCreateOrganizationWide ? "Entire organization" : "Choose an assigned cohort"}</option>{cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</select></div></div>
          <Textarea label="Description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain who this path is for and what they should be able to accomplish." />
          <div className="space-y-3"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">Milestones</h3><p className="text-xs text-muted-foreground">Keep each milestone specific and verifiable.</p></div><Badge variant="secondary">{milestones.length} added</Badge></div>
            {milestones.map((milestone, index) => <div key={index} className="grid gap-3 rounded-xl border border-border bg-muted/10 p-3 md:grid-cols-[1fr_1.3fr_auto]"><Input label={`Milestone ${index + 1}`} value={milestone.title} onChange={(event) => setMilestones((current) => current.map((item, i) => i === index ? { ...item, title: event.target.value } : item))} placeholder="e.g. Set up local development environment" required minLength={3} maxLength={160} /><Input label="Completion criteria" value={milestone.description} onChange={(event) => setMilestones((current) => current.map((item, i) => i === index ? { ...item, description: event.target.value } : item))} placeholder="What should the mentee demonstrate?" maxLength={1000} /><div className="flex items-end"><Button type="button" size="icon" variant="ghost" aria-label={`Remove milestone ${index + 1}`} disabled={milestones.length === 1} onClick={() => setMilestones((current) => current.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button></div></div>)}
            <Button type="button" size="sm" variant="outline" onClick={() => setMilestones((current) => current.length < 40 ? [...current, { title: "", description: "" }] : current)} disabled={milestones.length >= 40}><Plus className="mr-1.5 h-3.5 w-3.5" />Add milestone</Button>
          </div>
          <div className="flex justify-end border-t border-border pt-4"><Button type="submit" disabled={saving || !title.trim() || milestones.some((item) => item.title.trim().length < 3)}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookOpen className="mr-2 h-4 w-4" />}Publish learning path</Button></div>
        </form>
      </CardContent>
    </Card>

    <section className="space-y-3"><div><h2 className="text-lg font-semibold">Published learning paths</h2><p className="text-xs text-muted-foreground">Paths currently visible to organization members in their assigned scope.</p></div>
      {loading ? <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading paths…</div> : paths.length === 0 ? <Card className="border-dashed"><CardContent className="py-10 text-center text-sm text-muted-foreground">No learning paths have been published yet.</CardContent></Card> : <div className="grid gap-3 md:grid-cols-2">{paths.map((path) => <Card key={path.id}><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-sm font-semibold">{path.title}</h3><p className="mt-1 text-xs text-muted-foreground">{path.description || "No description provided."}</p></div><Badge variant={path.cohort ? "cyan" : "outline"}>{path.cohort?.name || "Organization"}</Badge></div><p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">{path.milestones.length} milestones</p></CardContent></Card>)}</div>}
    </section>
  </div>;
}
