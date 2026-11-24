"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { formatDate } from "@/lib/date";
import {
  Plus,
  Calendar,
  Users,
  GraduationCap,
  Award,
  FolderGit2,
  Edit3,
  Archive,
  Check,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  Clock,
  Sparkles,
} from "lucide-react";

interface UserSummary {
  id: string;
  name: string;
  email: string;
}

interface CohortItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  status: string;
  startDate: string;
  endDate: string;
  timezone: string;
  mentors: Array<{ id: string; mentorId: string; mentor: UserSummary }>;
  enrollments: Array<{ id: string; menteeId: string; mentee: UserSummary }>;
  cohortRepositories: Array<{ id: string; repository: { fullName: string } }>;
  _count: { dailyReports: number; tasks: number };
}

interface AdminCohortsClientProps {
  cohorts: CohortItem[];
  availableMentors: UserSummary[];
  availableMentees: UserSummary[];
  orgId: string;
  orgSlug: string;
}

export function AdminCohortsClient({
  cohorts: initialCohorts,
  availableMentors,
  availableMentees,
  orgId,
  orgSlug,
}: AdminCohortsClientProps) {
  const [cohorts, setCohorts] = useState<CohortItem[]>(initialCohorts);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCohort, setEditingCohort] = useState<CohortItem | null>(null);

  // Create form states
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createStartDate, setCreateStartDate] = useState("");
  const [createEndDate, setCreateEndDate] = useState("");
  const [createTimezone, setCreateTimezone] = useState("UTC");
  const [createMentorIds, setCreateMentorIds] = useState<string[]>([]);
  const [createMenteeIds, setCreateMenteeIds] = useState<string[]>([]);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Edit form states
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editTimezone, setEditTimezone] = useState("UTC");
  const [editMentorIds, setEditMentorIds] = useState<string[]>([]);
  const [editMenteeIds, setEditMenteeIds] = useState<string[]>([]);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editTab, setEditTab] = useState<"general" | "mentors" | "mentees">("general");

  // Search filter states inside modals
  const [mentorSearch, setMentorSearch] = useState("");
  const [menteeSearch, setMenteeSearch] = useState("");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Open Edit Modal
  const openEditModal = (cohort: CohortItem) => {
    setEditingCohort(cohort);
    setEditName(cohort.name);
    setEditDescription(cohort.description || "");
    setEditStatus(cohort.status);
    setEditStartDate(cohort.startDate.split("T")[0]);
    setEditEndDate(cohort.endDate.split("T")[0]);
    setEditTimezone(cohort.timezone || "UTC");
    setEditMentorIds(cohort.mentors.map((m) => m.mentorId));
    setEditMenteeIds(cohort.enrollments.map((e) => e.menteeId));
    setEditTab("general");
    setMentorSearch("");
    setMenteeSearch("");
    setErrorMsg(null);
  };

  // Toggle Mentor in Edit Form
  const toggleEditMentor = (mentorId: string) => {
    setEditMentorIds((prev) =>
      prev.includes(mentorId) ? prev.filter((id) => id !== mentorId) : [...prev, mentorId]
    );
  };

  // Toggle Mentee in Edit Form
  const toggleEditMentee = (menteeId: string) => {
    setEditMenteeIds((prev) =>
      prev.includes(menteeId) ? prev.filter((id) => id !== menteeId) : [...prev, menteeId]
    );
  };

  // Toggle Mentor in Create Form
  const toggleCreateMentor = (mentorId: string) => {
    setCreateMentorIds((prev) =>
      prev.includes(mentorId) ? prev.filter((id) => id !== mentorId) : [...prev, mentorId]
    );
  };

  // Toggle Mentee in Create Form
  const toggleCreateMentee = (menteeId: string) => {
    setCreateMenteeIds((prev) =>
      prev.includes(menteeId) ? prev.filter((id) => id !== menteeId) : [...prev, menteeId]
    );
  };

  // Submit Edit Cohort
  const handleSaveCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCohort) return;
    setEditSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        name: editName.trim(),
        description: editDescription.trim() || null,
        status: editStatus,
        startDate: new Date(editStartDate).toISOString(),
        endDate: new Date(editEndDate).toISOString(),
        timezone: editTimezone.trim() || "UTC",
        mentorIds: editMentorIds,
        menteeIds: editMenteeIds,
      };

      const res = await fetch(`/api/orgs/${orgId}/cohorts/${editingCohort.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to update cohort");
      }

      // Update local cohort state
      const updated = data.cohort;
      setCohorts((prev) =>
        prev.map((c) =>
          c.id === editingCohort.id
            ? {
                ...c,
                name: updated.name,
                description: updated.description,
                status: updated.status,
                startDate: updated.startDate,
                endDate: updated.endDate,
                timezone: updated.timezone,
                mentors: updated.mentors.map((m: any) => ({
                  id: m.id,
                  mentorId: m.mentor.id,
                  mentor: m.mentor,
                })),
                enrollments: updated.enrollments.map((e: any) => ({
                  id: e.id,
                  menteeId: e.mentee.id,
                  mentee: e.mentee,
                })),
              }
            : c
        )
      );

      setEditingCohort(null);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error saving cohort");
    } finally {
      setEditSubmitting(false);
    }
  };

  // Submit Create Cohort
  const handleCreateCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || !createSlug.trim()) return;

    setCreateSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/orgs/${orgId}/cohorts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          slug: createSlug.trim(),
          description: createDescription.trim() || undefined,
          startDate: new Date(createStartDate).toISOString(),
          endDate: new Date(createEndDate).toISOString(),
          timezone: createTimezone,
          mentorIds: createMentorIds,
          menteeIds: createMenteeIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to create cohort");
      }

      setShowCreateModal(false);
      window.location.reload();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error creating cohort");
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Quick Archive / Activate toggle
  const handleToggleArchive = async (cohortId: string, currentStatus: string) => {
    setActionLoadingId(cohortId);
    const newStatus = currentStatus === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
    try {
      const res = await fetch(`/api/orgs/${orgId}/cohorts/${cohortId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setCohorts((prev) =>
          prev.map((c) => (c.id === cohortId ? { ...c, status: newStatus } : c))
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtered mentors and mentees based on search query
  const filteredAvailableMentors = availableMentors.filter(
    (m) =>
      m.name.toLowerCase().includes(mentorSearch.toLowerCase()) ||
      m.email.toLowerCase().includes(mentorSearch.toLowerCase())
  );

  const filteredAvailableMentees = availableMentees.filter(
    (m) =>
      m.name.toLowerCase().includes(menteeSearch.toLowerCase()) ||
      m.email.toLowerCase().includes(menteeSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Cohort Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage mentorship cohorts, assign multiple technical mentors, enroll fellows, and configure scopes.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setShowCreateModal(true);
            setErrorMsg(null);
          }}
          className="flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Create Cohort</span>
        </Button>
      </div>

      {/* Cohort Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cohorts.map((cohort) => {
          const isLoading = actionLoadingId === cohort.id;
          return (
            <Card key={cohort.id} className="hover:border-primary/40 transition-colors flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3 border-b border-border/40">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-bold text-foreground">{cohort.name}</CardTitle>
                        <Badge
                          variant={
                            cohort.status === "ACTIVE"
                              ? "success"
                              : cohort.status === "COMPLETED"
                              ? "cyan"
                              : "secondary"
                          }
                          className="font-mono text-[10px]"
                        >
                          {cohort.status}
                        </Badge>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground block mt-0.5">
                        slug: /{cohort.slug}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(cohort)}
                        className="text-xs h-8 px-2.5 gap-1 font-semibold hover:border-primary"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-primary" />
                        <span>Edit Cohort</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isLoading}
                        onClick={() => handleToggleArchive(cohort.id, cohort.status)}
                        className="text-[11px] h-8 px-2 text-muted-foreground hover:text-foreground"
                      >
                        {cohort.status === "ACTIVE" ? "Archive" : "Activate"}
                      </Button>
                    </div>
                  </div>
                  {cohort.description && (
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{cohort.description}</p>
                  )}
                </CardHeader>

                <CardContent className="space-y-4 pt-4">
                  {/* Timeline Ribbon */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 p-2 rounded-lg border border-border/40">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span>
                      {formatDate(cohort.startDate)} &mdash; {formatDate(cohort.endDate)}
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground/80">
                      ({cohort.timezone})
                    </span>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs py-2.5 bg-muted/30 rounded-xl border border-border/40">
                    <div>
                      <div className="font-extrabold text-base text-foreground">
                        {cohort.enrollments.length}
                      </div>
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center justify-center gap-1 mt-0.5">
                        <GraduationCap className="w-3 h-3" />
                        <span>Mentees</span>
                      </div>
                    </div>
                    <div>
                      <div className="font-extrabold text-base text-foreground">
                        {cohort.mentors.length}
                      </div>
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center justify-center gap-1 mt-0.5">
                        <Award className="w-3 h-3 text-emerald-500" />
                        <span>Mentors</span>
                      </div>
                    </div>
                    <div>
                      <div className="font-extrabold text-base text-foreground">
                        {cohort._count.dailyReports}
                      </div>
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center justify-center gap-1 mt-0.5">
                        <Layers className="w-3 h-3 text-cyan-500" />
                        <span>Reports</span>
                      </div>
                    </div>
                  </div>

                  {/* Assigned Mentors Section */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Assigned Mentors ({cohort.mentors.length})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          openEditModal(cohort);
                          setEditTab("mentors");
                        }}
                        className="text-[10px] text-primary hover:underline font-medium"
                      >
                        + Manage
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {cohort.mentors.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground italic">
                          No mentors assigned yet. Click Edit to assign mentors.
                        </span>
                      ) : (
                        cohort.mentors.map((m) => (
                          <span
                            key={m.id}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>{m.mentor.name}</span>
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Enrolled Mentees Section */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5 text-cyan-500" />
                        <span>Enrolled Mentees ({cohort.enrollments.length})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          openEditModal(cohort);
                          setEditTab("mentees");
                        }}
                        className="text-[10px] text-primary hover:underline font-medium"
                      >
                        + Manage
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {cohort.enrollments.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground italic">
                          No mentees enrolled yet. Click Edit to enroll fellows.
                        </span>
                      ) : (
                        cohort.enrollments.map((e) => (
                          <span
                            key={e.id}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-muted text-[11px] font-medium text-foreground border border-border/60"
                          >
                            <span>{e.mentee.name}</span>
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Tracked Repositories */}
                  <div>
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                      Tracked Repositories
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {cohort.cohortRepositories.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground italic">
                          No repositories explicitly scoped.
                        </span>
                      ) : (
                        cohort.cohortRepositories.map((cr) => (
                          <Badge key={cr.id} variant="secondary" className="font-mono text-[10px]">
                            {cr.repository.fullName}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ================= EDIT COHORT MODAL ================= */}
      {editingCohort && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <Card className="w-full max-w-2xl shadow-2xl border-border/80 my-8">
            <CardHeader className="pb-3 border-b border-border/60 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  Edit Cohort: {editingCohort.name}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Update cohort details, assign multiple mentors, and manage fellow enrollments.
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setEditingCohort(null)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-border/60 bg-muted/20 px-4 pt-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setEditTab("general")}
                className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                  editTab === "general"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>General Settings</span>
              </button>

              <button
                type="button"
                onClick={() => setEditTab("mentors")}
                className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                  editTab === "mentors"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Award className="w-3.5 h-3.5 text-emerald-500" />
                <span>Mentors ({editMentorIds.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setEditTab("mentees")}
                className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                  editTab === "mentees"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5 text-cyan-500" />
                <span>Mentees ({editMenteeIds.length})</span>
              </button>
            </div>

            {errorMsg && (
              <div className="mx-5 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveCohort}>
              <CardContent className="p-5 max-h-[60vh] overflow-y-auto">
                {/* TAB 1: General Settings */}
                {editTab === "general" && (
                  <div className="space-y-4 text-xs">
                    <Input
                      label="Cohort Name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />

                    <Textarea
                      label="Description / Curriculum Objectives"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                      placeholder="Low-level kernel architecture, telemetry modules, and asynchronous runtime..."
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1.5">Status</label>
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="ARCHIVED">ARCHIVED</option>
                          <option value="COMPLETED">COMPLETED</option>
                        </select>
                      </div>

                      <Input
                        label="Start Date"
                        type="date"
                        value={editStartDate}
                        onChange={(e) => setEditStartDate(e.target.value)}
                        required
                      />

                      <Input
                        label="End Date"
                        type="date"
                        value={editEndDate}
                        onChange={(e) => setEditEndDate(e.target.value)}
                        required
                      />
                    </div>

                    <Input
                      label="Operating Timezone"
                      value={editTimezone}
                      onChange={(e) => setEditTimezone(e.target.value)}
                      placeholder="UTC or America/New_York"
                      required
                    />
                  </div>
                )}

                {/* TAB 2: Multiple Mentors Assignment */}
                {editTab === "mentors" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search organization mentors..."
                          value={mentorSearch}
                          onChange={(e) => setMentorSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="flex items-center gap-1 text-[11px]">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditMentorIds(availableMentors.map((m) => m.id))}
                          className="text-[11px] h-7 px-2"
                        >
                          Select All
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditMentorIds([])}
                          className="text-[11px] h-7 px-2 text-muted-foreground"
                        >
                          Clear
                        </Button>
                      </div>
                    </div>

                    <div className="border border-border/60 rounded-xl divide-y divide-border/40 max-h-64 overflow-y-auto">
                      {filteredAvailableMentors.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                          No mentors found matching your search.
                        </div>
                      ) : (
                        filteredAvailableMentors.map((mentor) => {
                          const isAssigned = editMentorIds.includes(mentor.id);
                          return (
                            <div
                              key={mentor.id}
                              onClick={() => toggleEditMentor(mentor.id)}
                              className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                                isAssigned ? "bg-emerald-500/10 dark:bg-emerald-500/15" : "hover:bg-muted/40"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                                    isAssigned
                                      ? "bg-emerald-500 border-emerald-500 text-white"
                                      : "border-border bg-background"
                                  }`}
                                >
                                  {isAssigned && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </div>
                                <div>
                                  <span className="font-semibold text-xs text-foreground block">
                                    {mentor.name}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground font-mono">
                                    {mentor.email}
                                  </span>
                                </div>
                              </div>

                              <Badge
                                variant={isAssigned ? "success" : "secondary"}
                                className="text-[10px]"
                              >
                                {isAssigned ? "Assigned" : "Unassigned"}
                              </Badge>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Mentors assigned to this cohort have access to all fellow daily logs, task submissions, and blocker reviews within this cohort.
                    </p>
                  </div>
                )}

                {/* TAB 3: Multiple Mentees Enrollment */}
                {editTab === "mentees" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search enrolled fellows..."
                          value={menteeSearch}
                          onChange={(e) => setMenteeSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="flex items-center gap-1 text-[11px]">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditMenteeIds(availableMentees.map((m) => m.id))}
                          className="text-[11px] h-7 px-2"
                        >
                          Select All
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditMenteeIds([])}
                          className="text-[11px] h-7 px-2 text-muted-foreground"
                        >
                          Clear
                        </Button>
                      </div>
                    </div>

                    <div className="border border-border/60 rounded-xl divide-y divide-border/40 max-h-64 overflow-y-auto">
                      {filteredAvailableMentees.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                          No mentees found matching your search.
                        </div>
                      ) : (
                        filteredAvailableMentees.map((mentee) => {
                          const isEnrolled = editMenteeIds.includes(mentee.id);
                          return (
                            <div
                              key={mentee.id}
                              onClick={() => toggleEditMentee(mentee.id)}
                              className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                                isEnrolled ? "bg-primary/10 dark:bg-primary/15" : "hover:bg-muted/40"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                                    isEnrolled
                                      ? "bg-primary border-primary text-primary-foreground"
                                      : "border-border bg-background"
                                  }`}
                                >
                                  {isEnrolled && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </div>
                                <div>
                                  <span className="font-semibold text-xs text-foreground block">
                                    {mentee.name}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground font-mono">
                                    {mentee.email}
                                  </span>
                                </div>
                              </div>

                              <Badge
                                variant={isEnrolled ? "cyan" : "secondary"}
                                className="text-[10px]"
                              >
                                {isEnrolled ? "Enrolled" : "Not Enrolled"}
                              </Badge>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Mentees enrolled in this cohort will submit their daily reports, complete assigned sprint tasks, and attend cohort syncs under this cohort scope.
                    </p>
                  </div>
                )}
              </CardContent>

              {/* Modal Footer */}
              <div className="flex items-center justify-between p-4 border-t border-border/60 bg-muted/20">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Summary:</span>
                  <span>{editMentorIds.length} Mentor(s)</span>
                  <span>&bull;</span>
                  <span>{editMenteeIds.length} Mentee(s)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingCohort(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" loading={editSubmitting}>
                    Save Changes
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ================= CREATE COHORT MODAL ================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <Card className="w-full max-w-xl shadow-2xl border-border/80 my-8">
            <CardHeader className="pb-3 border-b border-border/60 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-foreground">Create New Cohort</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Launch a new mentorship fellowship cohort and assign initial mentors and mentees.
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setShowCreateModal(false)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            {errorMsg && (
              <div className="mx-5 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateCohort}>
              <CardContent className="p-5 space-y-4 max-h-[60vh] overflow-y-auto text-xs">
                <Input
                  label="Cohort Name"
                  placeholder="e.g. Winter 2026 Cloud & Tooling"
                  value={createName}
                  onChange={(e) => {
                    setCreateName(e.target.value);
                    if (!createSlug) {
                      setCreateSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                    }
                  }}
                  required
                />

                <Input
                  label="URL Slug"
                  placeholder="e.g. winter-2026-tooling"
                  value={createSlug}
                  onChange={(e) => setCreateSlug(e.target.value)}
                  required
                />

                <Textarea
                  label="Description"
                  placeholder="Goals, target skillsets, and scope for this cohort..."
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  rows={2}
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Start Date"
                    type="date"
                    value={createStartDate}
                    onChange={(e) => setCreateStartDate(e.target.value)}
                    required
                  />
                  <Input
                    label="End Date"
                    type="date"
                    value={createEndDate}
                    onChange={(e) => setCreateEndDate(e.target.value)}
                    required
                  />
                </div>

                <Input
                  label="Timezone"
                  value={createTimezone}
                  onChange={(e) => setCreateTimezone(e.target.value)}
                  placeholder="UTC"
                  required
                />

                {/* Initial Mentor Assignment */}
                <div>
                  <span className="font-semibold text-foreground block mb-1">
                    Assign Mentors ({createMentorIds.length} selected)
                  </span>
                  <div className="border border-border/60 rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
                    {availableMentors.map((m) => {
                      const isSel = createMentorIds.includes(m.id);
                      return (
                        <div
                          key={m.id}
                          onClick={() => toggleCreateMentor(m.id)}
                          className={`p-1.5 rounded flex items-center justify-between cursor-pointer text-xs ${
                            isSel ? "bg-emerald-500/10 font-semibold text-emerald-600 dark:text-emerald-400" : "hover:bg-muted/40"
                          }`}
                        >
                          <span>{m.name} ({m.email})</span>
                          {isSel && <Check className="w-3.5 h-3.5" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Initial Mentee Enrollment */}
                <div>
                  <span className="font-semibold text-foreground block mb-1">
                    Enroll Mentees ({createMenteeIds.length} selected)
                  </span>
                  <div className="border border-border/60 rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
                    {availableMentees.map((m) => {
                      const isSel = createMenteeIds.includes(m.id);
                      return (
                        <div
                          key={m.id}
                          onClick={() => toggleCreateMentee(m.id)}
                          className={`p-1.5 rounded flex items-center justify-between cursor-pointer text-xs ${
                            isSel ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted/40"
                          }`}
                        >
                          <span>{m.name} ({m.email})</span>
                          {isSel && <Check className="w-3.5 h-3.5" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>

              <div className="flex items-center justify-end gap-2 p-4 border-t border-border/60 bg-muted/20">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={createSubmitting}>
                  Create Cohort
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
