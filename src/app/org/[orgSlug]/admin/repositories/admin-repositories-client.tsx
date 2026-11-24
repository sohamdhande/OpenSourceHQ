"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { FolderGit2, Plus, ExternalLink, RefreshCw } from "lucide-react";

interface RepositoryItem {
  id: string;
  ownerLogin: string;
  name: string;
  fullName: string;
  url: string;
  description?: string | null;
  defaultBranch: string;
  syncStatus: string;
  cohortRepositories: Array<{ id: string; cohort: { name: string } }>;
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

  // Form states
  const [ownerLogin, setOwnerLogin] = useState("");
  const [repoName, setRepoName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCohortIds, setSelectedCohortIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleAddRepository = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerLogin.trim() || !repoName.trim() || !url.trim()) return;

    setSubmitting(true);
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
          description: description || undefined,
          cohortIds: selectedCohortIds,
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCohortToggle = (cohortId: string) => {
    setSelectedCohortIds((prev) =>
      prev.includes(cohortId) ? prev.filter((id) => id !== cohortId) : [...prev, cohortId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Repository Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure tracked open-source repositories, map them to cohorts, and observe webhook synchronization.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Track New Repository
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {repositories.map((repo) => (
          <Card key={repo.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-sm text-primary hover:underline font-mono inline-flex items-center gap-1"
                >
                  {repo.fullName} <ExternalLink className="w-3 h-3" />
                </a>
                <Badge variant={repo.syncStatus === "ACTIVE" ? "success" : "secondary"}>
                  {repo.syncStatus}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{repo.description || "No description provided."}</p>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-2.5 bg-muted/20 rounded">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Verified Activities Logged</span>
                  <span className="font-bold text-base text-foreground">{repo._count.activities}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Tasks Linked</span>
                  <span className="font-bold text-base text-foreground">{repo._count.tasks}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1">
                  Associated Cohorts
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {repo.cohortRepositories.length === 0 ? (
                    <span className="text-[11px] text-muted-foreground">Org-wide repository</span>
                  ) : (
                    repo.cohortRepositories.map((cr) => (
                      <Badge key={cr.id} variant="secondary">
                        {cr.cohort.name}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Track Repository Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold">Track GitHub Repository</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleAddRepository} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Owner / Org Login"
                    placeholder="e.g. nstsdc"
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
                    placeholder="e.g. hyper-kernel"
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
                  placeholder="https://github.com/nstsdc/core-platform"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />

                <Textarea
                  label="Description"
                  placeholder="Repository scope and focus..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />

                <div>
                  <label className="font-medium text-foreground block mb-1.5">
                    Associate with Cohorts:
                  </label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto p-2 bg-muted/20 border border-border rounded">
                    {cohorts.map((cohort) => (
                      <label key={cohort.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCohortIds.includes(cohort.id)}
                          onChange={() => handleCohortToggle(cohort.id)}
                          className="rounded border-input text-primary"
                        />
                        <span>{cohort.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" loading={submitting}>
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

