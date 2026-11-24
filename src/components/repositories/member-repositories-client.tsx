"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, Check, CircleDot, Code2, ExternalLink, FolderGit2, GitFork, Github, Loader2, RefreshCw, Search, ShieldCheck, Sparkles, Star, Trash2 } from "lucide-react";

type Repository = { providerRepositoryId: string; id: string; name: string; fullName: string; url: string; description: string | null; defaultBranch: string; visibility: string; syncStatus: string; lastSyncedAt?: string | null };
type SelectedRepository = { id: string; organizationId: string; userId: string; repositoryId: string; assignedById: string | null; isPrimary: boolean; notes: string | null; assignedAt: string; repository: Repository; assignedBy?: { id: string; name: string; email: string } | null };
type RemoteRepository = { id: number; name: string; full_name: string; html_url: string; description: string | null; default_branch: string; private: boolean; owner: { login: string; avatar_url?: string }; stargazers_count?: number; forks_count?: number; language?: string | null; open_issues_count?: number };
interface Props { organizationId: string; orgSlug: string; initialSelected: SelectedRepository[]; role: "MENTEE" | "MENTOR"; targetUserId?: string; targetName?: string }

const SHORTCUTS = [
  { label: "OpenMRS", query: "org:openmrs" },
  { label: "Sugar Labs", query: "org:sugarlabs" },
  { label: "Good-first-issue repos", query: "topic:good-first-issue" },
];

export function MemberRepositoriesClient({ organizationId, orgSlug, initialSelected, role, targetUserId, targetName }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState(initialSelected);
  useEffect(() => { setSelected(initialSelected); }, [initialSelected]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RemoteRepository[]>([]);
  const [searching, setSearching] = useState(false);
  const [savingId, setSavingId] = useState<string | number | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const primary = selected.find((item) => item.isPrimary);
  const selectedProviderIds = useMemo(() => new Set(selected.map((item) => item.repository.providerRepositoryId)), [selected]);

  const search = async (value = query) => {
    const q = value.trim();
    if (q.length < 2) { setError("Enter at least two characters, an organization name, owner/repository, or a GitHub URL."); return; }
    setSearching(true); setError(null); setNotice(null);
    try {
      const params = new URLSearchParams({ organizationId, q });
      const response = await fetch(`/api/github/repositories/search?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Repository search failed.");
      setResults(data.repositories || []);
      if (!data.repositories?.length) setNotice("No public repository matched. Check the spelling or paste the exact GitHub repository URL.");
    } catch (e) { setError(e instanceof Error ? e.message : "Repository search failed."); }
    finally { setSearching(false); }
  };

  const addRepository = async (repo: RemoteRepository) => {
    setSavingId(repo.id); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/member-repositories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, userId: targetUserId, repositoryUrl: repo.html_url, isPrimary: selected.length === 0 }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Could not add repository.");
      const record = data.userRepository as SelectedRepository;
      setSelected((current) => {
        const next = current.filter((item) => item.repositoryId !== record.repositoryId);
        return record.isPrimary ? [record, ...next.map((item) => ({ ...item, isPrimary: false }))] : [record, ...next];
      });
      setNotice(`${record.repository.fullName} added to your repository workspace.`);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add repository."); }
    finally { setSavingId(null); }
  };

  const setPrimary = async (record: SelectedRepository) => {
    setSavingId(record.id); setError(null);
    try {
      const response = await fetch("/api/member-repositories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, userId: targetUserId, repositoryId: record.repositoryId, isPrimary: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Could not update primary repository.");
      setSelected((current) => current.map((item) => ({ ...item, isPrimary: item.id === record.id })));
      setNotice(`${record.repository.fullName} is now your primary focus.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update primary repository."); }
    finally { setSavingId(null); }
  };

  const removeRepository = async (record: SelectedRepository) => {
    setRemovingId(record.id); setError(null);
    try {
      const response = await fetch(`/api/member-repositories?id=${encodeURIComponent(record.id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Could not remove repository.");
      setSelected((current) => {
        const next = current.filter((item) => item.id !== record.id);
        if (record.isPrimary && next.length) next[0] = { ...next[0], isPrimary: true };
        return next;
      });
      setNotice(`${record.repository.fullName} removed from your workspace.`); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not remove repository."); }
    finally { setRemovingId(null); }
  };

  const submitSearch = (event: FormEvent) => { event.preventDefault(); void search(); };

  const syncRepository = async (record: SelectedRepository) => {
    setSyncingId(record.id); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/github/repositories/${encodeURIComponent(record.repositoryId)}/sync`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Repository sync failed.");
      setSelected((current) => current.map((item) => item.id === record.id ? { ...item, repository: { ...item.repository, lastSyncedAt: new Date().toISOString(), syncStatus: "ACTIVE" } } : item));
      setNotice(`Synced ${record.repository.fullName}: ${data.result.commits} commits, ${data.result.pullRequests} pull requests and ${data.result.issues} issues checked.`);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Repository sync failed."); }
    finally { setSyncingId(null); }
  };

  return (
    <div className="member-repositories space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <div className="page-eyebrow"><FolderGit2 className="h-3.5 w-3.5" /> OPEN SOURCE WORKSPACE</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{targetName ? `${targetName}'s repositories` : role === "MENTOR" ? "My repositories" : "Your repositories"}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{targetName ? `Choose public open-source projects for ${targetName}.` : "Choose the open-source projects you contribute to."} Choose repositories from any public GitHub organization or user. Your selections are independent of the organization&apos;s shared repository catalogue.</p>
        </div>
        <Badge variant="outline" className="h-8 gap-1.5 self-start px-3 sm:self-auto"><ShieldCheck className="h-3.5 w-3.5" /> No personal access token required</Badge>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="metric-surface"><CardContent className="flex items-center gap-3 p-4"><div className="metric-icon"><FolderGit2 className="h-4 w-4" /></div><div><p className="text-xs text-muted-foreground">Selected repositories</p><p className="mt-0.5 text-2xl font-semibold tabular-nums">{selected.length}</p></div></CardContent></Card>
        <Card className="metric-surface"><CardContent className="flex items-center gap-3 p-4"><div className="metric-icon"><Star className="h-4 w-4" /></div><div><p className="text-xs text-muted-foreground">Primary focus</p><p className="mt-0.5 truncate text-sm font-semibold">{primary?.repository.fullName || "Not set yet"}</p></div></CardContent></Card>
        <Card className="metric-surface"><CardContent className="flex items-center gap-3 p-4"><div className="metric-icon"><Code2 className="h-4 w-4" /></div><div><p className="text-xs text-muted-foreground">Repository source</p><p className="mt-0.5 text-sm font-semibold">GitHub public index</p></div></CardContent></Card>
      </section>

      <section className="search-panel rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-start gap-3"><div className="search-brand"><Github className="h-5 w-5" /></div><div><h2 className="text-base font-semibold">Find an open-source repository</h2><p className="mt-1 text-sm text-muted-foreground">Search by project, organization, owner/repository, or paste a GitHub URL.</p></div></div>
        <form onSubmit={submitSearch} className="mt-5 flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="openmrs / sugarlabs / owner/repository" className="h-11 rounded-xl pl-10 text-sm" aria-label="Search GitHub repositories" /></div>
          <Button type="submit" disabled={searching} className="h-11 rounded-xl px-5">{searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Search GitHub</Button>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-2"><span className="mr-1 text-xs text-muted-foreground">Explore:</span>{SHORTCUTS.map((item) => <button key={item.label} type="button" onClick={() => { setQuery(item.query); void search(item.query); }} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground">{item.label}</button>)}</div>
        {error && <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
      </section>

      {results.length > 0 && <section className="space-y-3"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Search results</h2><p className="text-xs text-muted-foreground">Repositories matching your GitHub query</p></div><Badge variant="secondary">{results.length} shown</Badge></div><div className="grid gap-3 lg:grid-cols-2">{results.map((repo) => {
        const added = selectedProviderIds.has(String(repo.id));
        return <Card key={repo.id} className="repo-result-card"><CardContent className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3">{repo.owner.avatar_url ? <img src={repo.owner.avatar_url} alt="" className="h-9 w-9 rounded-xl border border-border" /> : <div className="metric-icon"><Github className="h-4 w-4" /></div>}<div className="min-w-0"><a className="break-all text-sm font-semibold text-foreground hover:text-primary" href={repo.html_url} target="_blank" rel="noreferrer">{repo.full_name} <ExternalLink className="ml-1 inline h-3 w-3" /></a><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{repo.description || "No description provided by the repository owner."}</p></div></div><Badge variant={repo.private ? "warning" : "outline"}>{repo.private ? "Private" : "Public"}</Badge></div><div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">{repo.language && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />{repo.language}</span>}<span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" />{String(repo.stargazers_count || 0)}</span><span className="flex items-center gap-1"><GitFork className="h-3.5 w-3.5" />{String(repo.forks_count || 0)}</span><span className="flex items-center gap-1"><CircleDot className="h-3.5 w-3.5" />{repo.open_issues_count || 0} open issues</span></div><div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3"><span className="text-[11px] text-muted-foreground">Default branch: <code>{repo.default_branch || "main"}</code></span><Button size="sm" variant={added ? "secondary" : "primary"} disabled={added || savingId === repo.id} onClick={() => void addRepository(repo)}>{savingId === repo.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : added ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}{added ? "Added" : "Add repository"}</Button></div></CardContent></Card>;
      })}</div></section>}

      <section className="space-y-3"><div className="flex items-end justify-between gap-4"><div><h2 className="text-lg font-semibold">Selected repositories</h2><p className="text-xs text-muted-foreground">Your chosen projects and assigned focus areas.</p></div><Badge variant="secondary">{selected.length} total</Badge></div>
        {selected.length === 0 ? <Card className="border-dashed"><CardContent className="flex flex-col items-center px-6 py-12 text-center"><div className="empty-icon"><FolderGit2 className="h-6 w-6" /></div><h3 className="mt-4 text-sm font-semibold">No repositories selected</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">Search GitHub for a project or use one of the organization shortcuts above. Selected repositories will appear here.</p></CardContent></Card> : <div className="overflow-hidden rounded-2xl border border-border bg-card">{selected.map((record, index) => <div key={record.id} className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 ${index ? "border-t border-border/70" : ""}`}><div className="flex min-w-0 items-start gap-3"><div className="repo-avatar"><Github className="h-4 w-4" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><a href={record.repository.url} target="_blank" rel="noreferrer" className="break-all text-sm font-semibold hover:text-primary">{record.repository.fullName} <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></a>{record.isPrimary && <Badge variant="default">Primary focus</Badge>}{record.assignedBy && <Badge variant="secondary">Assigned by {record.assignedBy.name}</Badge>}</div><p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{record.repository.description || "Open-source project repository"}</p><div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground"><span>{record.repository.visibility}</span><span>·</span><span>Default branch: {record.repository.defaultBranch}</span><span>·</span><span>Tracking: {record.repository.syncStatus.toLowerCase()}</span><span>·</span><span>{record.repository.lastSyncedAt ? `Last synced ${formatDateTime(record.repository.lastSyncedAt)}` : "Not synced yet"}</span></div></div></div><div className="flex shrink-0 flex-wrap items-center gap-2 pl-12 sm:pl-0"><Button size="sm" variant="outline" onClick={() => void syncRepository(record)} disabled={syncingId === record.id}>{syncingId === record.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}Sync now</Button>{!record.isPrimary && <Button size="sm" variant="outline" onClick={() => void setPrimary(record)} disabled={savingId === record.id}>{savingId === record.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Star className="mr-1.5 h-3.5 w-3.5" />}Set primary</Button>}<Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => void removeRepository(record)} disabled={removingId === record.id}>{removingId === record.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}<span className="sr-only">Remove {record.repository.fullName}</span></Button></div></div>)}</div>}
      </section>
      <p className="text-xs leading-5 text-muted-foreground">Public repository details are read directly from GitHub. OpenSourceHQ can use the expiring GitHub App authorization from your sign-in, or fall back to public unauthenticated reads; you never create or paste a personal access token. Private repositories require an administrator of the GitHub owner account to install OpenSourceHQ&apos;s GitHub App and grant it access.</p>
    </div>
  );
}
