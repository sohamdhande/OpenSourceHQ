"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
  FolderGit2,
  Plus,
  ExternalLink,
  Edit2,
  Trash2,
  Play,
  Pause,
  AlertCircle,
  CheckCircle2,
  GitBranch,
} from "lucide-react";

interface RepositoryItem {
  id: string;
  ownerLogin: string;
  name: string;
  fullName: string;
  url: string;
  description?: string | null;
  defaultBranch: string;
  syncStatus: string;
  cohortRepositories: Array<{ id: string; cohort: { id: string; name: string } }>;
  _count: { activities: number; tasks: number };
}

interface Cohort {
  id: string;
  name: string;
}

interface AdminRepositoriesClientProps {
  repositories: RepositoryItem[];
  cohorts: Cohort[];
  orgId: string;
  orgSlug: string;
}

export function AdminRepositoriesClient({
  repositories: initialRepos,
  cohorts,
  orgId,
  orgSlug,
}: AdminRepositoriesClientProps) {
  const [repositories, setRepositories] = useState<RepositoryItem[]>(initialRepos);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRepo, setEditingRepo] = useState<RepositoryItem | null>(null);
  const [deletingRepoId, setDeletingRepoId] = useState<string | null>(null);
  const [togglingRepoId, setTogglingRepoId] = useState<string | null>(null);

  // Add Form states
  const [ownerLogin, setOwnerLogin] = useState("");
  const [repoName, setRepoName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCohortIds, setSelectedCohortIds] = useState<string[]>([]);
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Form states
  const [editDescription, setEditDescription] = useState("");
  const [editSyncStatus, setEditSyncStatus] = useState<"ACTIVE" | "PAUSED">("ACTIVE");
  const [editCohortIds, setEditCohortIds] = useState<string[]>([]);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const openEditModal = (repo: RepositoryItem) => {
    setEditingRepo(repo);
    setEditDescription(repo.description || "");
    setEditSyncStatus(repo.syncStatus === "PAUSED" ? "PAUSED" : "ACTIVE");
    setEditCohortIds(repo.cohortRepositories.map((cr) => cr.cohort.id));
    setEditError(null);
  };

  const handleAddRepository = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerLogin.trim() || !repoName.trim() || !url.trim()) return;

    setSubmittingAdd(true);
    setAddError(null);
    const fullName = `${ownerLogin.trim()}/${repoName.trim()}`;
    try {
      const res = await fetch(`/api/orgs/${orgId}/repositories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          ownerLogin: ownerLogin.trim(),
          name: repoName.trim(),
          fullName,
          url: url.trim(),
          description: description.trim() || undefined,
          cohortIds: selectedCohortIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to add repository");
      }

      setShowAddModal(false);
      window.location.reload();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Failed to add repository");
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleToggleTracking = async (repo: RepositoryItem) => {
    const nextStatus = repo.syncStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setTogglingRepoId(repo.id);

    try {
      const res = await fetch(`/api/orgs/${orgId}/repositories/${repo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncStatus: nextStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to update tracking status");
      }

      setRepositories((prev) =>
        prev.map((r) => (r.id === repo.id ? { ...r, syncStatus: nextStatus } : r))
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setTogglingRepoId(null);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRepo) return;

    setSubmittingEdit(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/orgs/${orgId}/repositories/${editingRepo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: editDescription.trim() || null,
          syncStatus: editSyncStatus,
          cohortIds: editCohortIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to save repository updates");
      }

      setRepositories((prev) =>
        prev.map((r) =>
          r.id === editingRepo.id
            ? {
                ...r,
                description: editDescription.trim() || null,
                syncStatus: editSyncStatus,
                cohortRepositories: editCohortIds.map((cId) => {
                  const match = cohorts.find((c) => c.id === cId);
                  return { id: `cr_${cId}`, cohort: { id: cId, name: match?.name || cId } };
                }),
              }
            : r
        )
      );

      setEditingRepo(null);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Failed to update repository");
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeleteRepository = async (repo: RepositoryItem) => {
    if (
      !confirm(
        `Are you sure you want to untrack and delete "${repo.fullName}"? This will remove all cohort associations and stop telemetry ingestion for this repository.`
      )
    ) {
      return;
    }

    setDeletingRepoId(repo.id);
    try {
      const res = await fetch(`/api/orgs/${orgId}/repositories/${repo.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to remove repository");
      }

      setRepositories((prev) => prev.filter((r) => r.id !== repo.id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete repository");
    } finally {
      setDeletingRepoId(null);
    }
  };

  const handleCohortToggleInAdd = (cohortId: string) => {
    setSelectedCohortIds((prev) =>
      prev.includes(cohortId) ? prev.filter((id) => id !== cohortId) : [...prev, cohortId]
    );
  };

  const handleCohortToggleInEdit = (cohortId: string) => {
    setEditCohortIds((prev) =>
      prev.includes(cohortId) ? prev.filter((id) => id !== cohortId) : [...prev, cohortId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-primary" />
            Repository Management
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure tracked open-source repositories, map them to cohorts, or pause and resume webhook telemetry.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setAddError(null);
            setShowAddModal(true);
          }}
          className="flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Track New Repository
        </Button>
      </div>

      {repositories.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-border/80 bg-card/40">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3 text-primary">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-foreground">No Repositories Configured</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            You haven&apos;t tracked any open-source repositories for this organization yet. Click below to add an official or contributor repository.
          </p>
          <Button
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="mt-4 inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Track Repository
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {repositories.map((repo) => {
            const isTracking = repo.syncStatus === "ACTIVE";
            const isToggling = togglingRepoId === repo.id;
            const isDeleting = deletingRepoId === repo.id;

            return (
              <Card
                key={repo.id}
                className={`transition-all border-border/80 ${
                  isTracking ? "bg-card shadow-sm" : "bg-card/40 opacity-80"
                }`}
              >
                <CardHeader className="pb-3 border-b border-border/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={repo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-sm text-primary hover:underline font-mono inline-flex items-center gap-1"
                        >
                          {repo.fullName} <ExternalLink className="w-3 h-3 opacity-70" />
                        </a>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {repo.description || "No description provided."}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isTracking ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Tracking
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Pause className="w-2.5 h-2.5" />
                          Paused
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-3.5 space-y-4 text-xs">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-muted/30 rounded-lg border border-border/40">
                    <div>
                      <span className="text-[10px] font-medium text-muted-foreground block uppercase tracking-wider">
                        Verified Activities
                      </span>
                      <span className="font-bold text-sm text-foreground">
                        {repo._count.activities}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-muted-foreground block uppercase tracking-wider">
                        Linked Tasks
                      </span>
                      <span className="font-bold text-sm text-foreground">
                        {repo._count.tasks}
                      </span>
                    </div>
                  </div>

                  {/* Cohort Scoping */}
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block mb-1.5">
                      Associated Cohorts
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {repo.cohortRepositories.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground italic">
                          Org-wide (All Cohorts)
                        </span>
                      ) : (
                        repo.cohortRepositories.map((cr) => (
                          <Badge
                            key={cr.id}
                            variant="secondary"
                            className="text-[10px] font-medium px-2 py-0.5"
                          >
                            {cr.cohort.name}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/60">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={isTracking ? "outline" : "primary"}
                        onClick={() => handleToggleTracking(repo)}
                        disabled={isToggling}
                        className="h-7 text-[11px] px-2.5 gap-1.5"
                      >
                        {isTracking ? (
                          <>
                            <Pause className="w-3 h-3 text-amber-400" />
                            Pause Tracking
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 text-emerald-400" />
                            Resume Tracking
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openEditModal(repo)}
                        className="h-7 text-[11px] px-2.5 gap-1.5"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </Button>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteRepository(repo)}
                      disabled={isDeleting}
                      className="h-7 text-[11px] px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      title="Untrack & Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ================= EDIT REPOSITORY MODAL ================= */}
      {editingRepo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <Card className="w-full max-w-md shadow-2xl border-border/80 my-8">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Edit2 className="w-4 h-4 text-primary" />
                    Edit Repository: {editingRepo.name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    {editingRepo.fullName}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
                {editError && (
                  <div className="p-2.5 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[11px] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{editError}</span>
                  </div>
                )}

                {/* Tracking Status Toggle */}
                <div>
                  <label className="font-semibold text-foreground block mb-1.5">
                    Tracking Status:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditSyncStatus("ACTIVE")}
                      className={`p-2.5 rounded-lg border text-left transition-all flex items-center justify-between ${
                        editSyncStatus === "ACTIVE"
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-semibold"
                          : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Tracked (Active)
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditSyncStatus("PAUSED")}
                      className={`p-2.5 rounded-lg border text-left transition-all flex items-center justify-between ${
                        editSyncStatus === "PAUSED"
                          ? "bg-amber-500/10 border-amber-500/40 text-amber-400 font-semibold"
                          : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Pause className="w-3.5 h-3.5 text-amber-400" />
                        Paused (Untracked)
                      </span>
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    When active, commits, PRs, and reviews are synced automatically. When paused, polling and webhook ingestion are stopped.
                  </p>
                </div>

                {/* Description */}
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Description
                  </label>
                  <Textarea
                    placeholder="Brief description of this repository's purpose..."
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                </div>

                {/* Associated Cohorts */}
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Associated Cohorts:
                  </label>
                  <p className="text-[10px] text-muted-foreground mb-2">
                    Leave unselected for an organization-wide repository visible to all cohorts.
                  </p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto p-2 bg-muted/20 border border-border/60 rounded-lg">
                    {cohorts.map((cohort) => (
                      <label
                        key={cohort.id}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/40 cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={editCohortIds.includes(cohort.id)}
                          onChange={() => handleCohortToggleInEdit(cohort.id)}
                          className="rounded border-input text-primary focus:ring-primary w-3.5 h-3.5"
                        />
                        <span className="font-medium text-foreground">{cohort.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingRepo(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" loading={submittingEdit}>
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ================= TRACK REPOSITORY MODAL ================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <Card className="w-full max-w-md shadow-2xl border-border/80 my-8">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-primary" />
                Track GitHub Repository
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleAddRepository} className="space-y-3.5 text-xs">
                {addError && (
                  <div className="p-2.5 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[11px] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{addError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Owner / Org Login"
                    placeholder="e.g. facebook"
                    value={ownerLogin}
                    onChange={(e) => {
                      setOwnerLogin(e.target.value);
                      if (repoName) {
                        setUrl(`https://github.com/${e.target.value}/${repoName}`);
                      }
                    }}
                    required
                  />
                  <Input
                    label="Repository Name"
                    placeholder="e.g. react"
                    value={repoName}
                    onChange={(e) => {
                      setRepoName(e.target.value);
                      if (ownerLogin) {
                        setUrl(`https://github.com/${ownerLogin}/${e.target.value}`);
                      }
                    }}
                    required
                  />
                </div>

                <Input
                  label="GitHub URL"
                  placeholder="https://github.com/facebook/react"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />

                <Textarea
                  label="Description (Optional)"
                  placeholder="Repository scope and focus..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />

                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Associate with Cohorts:
                  </label>
                  <p className="text-[10px] text-muted-foreground mb-1.5">
                    Optional. Leave unselected to track across all cohorts.
                  </p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto p-2 bg-muted/20 border border-border/60 rounded-lg">
                    {cohorts.map((cohort) => (
                      <label
                        key={cohort.id}
                        className="flex items-center gap-2 p-1 rounded hover:bg-muted/40 cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCohortIds.includes(cohort.id)}
                          onChange={() => handleCohortToggleInAdd(cohort.id)}
                          className="rounded border-input text-primary w-3.5 h-3.5"
                        />
                        <span>{cohort.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" loading={submittingAdd}>
                    Track Repository
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
