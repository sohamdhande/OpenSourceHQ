"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { formatDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Check,
  ChevronDown,
  ExternalLink,
  Eye,
  Filter,
  Github,
  GraduationCap,
  Layers,
  Loader2,
  Mail,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";

interface Member {
  id: string;
  role: string;
  status: string;
  joinedAt?: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    status: string;
    githubAccounts: Array<{ username: string; profileUrl: string }>;
  };
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  cohortId?: string | null;
  expiresAt: string;
  createdAt: string;
  inviter?: { name: string } | null;
  cohort?: { name: string } | null;
}

interface Cohort {
  id: string;
  name: string;
}

interface AdminMembersClientProps {
  members: Member[];
  invitations: Invitation[];
  cohorts: Cohort[];
  orgId: string;
  orgSlug: string;
}

interface RoleConfig {
  value: string;
  label: string;
  shortLabel: string;
  description: string;
  badgeClass: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ROLES: Record<string, RoleConfig> = {
  ORG_ADMIN: {
    value: "ORG_ADMIN",
    label: "Organization Admin",
    shortLabel: "Admin",
    description: "Full administrative governance, billing & member controls",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 hover:bg-purple-500/20",
    icon: ShieldCheck,
  },
  MENTOR: {
    value: "MENTOR",
    label: "Mentor",
    shortLabel: "Mentor",
    description: "Supervises cohorts, reviews progress reports & unblocks fellows",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20",
    icon: GraduationCap,
  },
  MENTEE: {
    value: "MENTEE",
    label: "Fellow / Mentee",
    shortLabel: "Mentee",
    description: "Submits daily engineering logs, milestones & tasks",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/20",
    icon: User,
  },
  OBSERVER: {
    value: "OBSERVER",
    label: "Observer",
    shortLabel: "Observer",
    description: "Read-only visibility across public cohorts and activity",
    badgeClass: "bg-secondary text-secondary-foreground border-border hover:bg-muted",
    icon: Eye,
  },
};

export function AdminMembersClient({
  members: initialMembers,
  invitations: initialInvitations,
  cohorts,
  orgId,
  orgSlug,
}: AdminMembersClientProps) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [invitations, setInvitations] = useState<Invitation[]>(initialInvitations);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Search & Role filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MENTEE");
  const [inviteCohortId, setInviteCohortId] = useState("");
  const [submittingInvite, setSubmittingInvite] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Close dropdown on outside click or escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdownId(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveDropdownId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const refreshData = () => {
    window.location.reload();
  };

  // Role metrics
  const counts = useMemo(() => {
    return {
      total: members.length,
      admins: members.filter((m) => m.role === "ORG_ADMIN").length,
      mentors: members.filter((m) => m.role === "MENTOR").length,
      mentees: members.filter((m) => m.role === "MENTEE").length,
      active: members.filter((m) => m.status === "ACTIVE").length,
    };
  }, [members]);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (roleFilter !== "ALL" && m.role !== roleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const gh = m.user.githubAccounts?.[0]?.username?.toLowerCase() || "";
        return (
          m.user.name.toLowerCase().includes(q) ||
          m.user.email.toLowerCase().includes(q) ||
          gh.includes(q)
        );
      }
      return true;
    });
  }, [members, roleFilter, searchQuery]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setSubmittingInvite(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/members/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          cohortId: inviteCohortId || undefined,
        }),
      });

      if (res.ok) {
        setShowInviteModal(false);
        setInviteEmail("");
        refreshData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingInvite(false);
    }
  };

  const handleRoleChange = async (membershipId: string, newRole: string) => {
    setActionLoadingId(membershipId);
    try {
      const res = await fetch(`/api/orgs/${orgId}/members/${membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        setMembers((prev) =>
          prev.map((m) => (m.id === membershipId ? { ...m, role: newRole } : m))
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleSuspend = async (membershipId: string, currentStatus: string) => {
    setActionLoadingId(membershipId);
    const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      const res = await fetch(`/api/orgs/${orgId}/members/${membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setMembers((prev) =>
          prev.map((m) => (m.id === membershipId ? { ...m, status: newStatus } : m))
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    setActionLoadingId(invitationId);
    try {
      const res = await fetch(`/api/orgs/${orgId}/invitations/${invitationId}`, {
        method: "POST",
      });
      if (res.ok) {
        refreshData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    setActionLoadingId(invitationId);
    try {
      const res = await fetch(`/api/orgs/${orgId}/invitations/${invitationId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="page-eyebrow">
            <Users className="h-3.5 w-3.5" />
            ORGANIZATION GOVERNANCE · ACCESS CONTROL & DIRECTORY
          </div>
          <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Organization Members
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Manage organization members, assign roles, enforce suspension policies, and invite collaborators.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-1.5 h-8 text-xs font-mono"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Invite Member</span>
        </Button>
      </section>

      {/* KPI Workstation Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-3">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Total Members</div>
          <div className="text-xl font-bold font-mono tabular-nums text-foreground mt-1">
            {counts.total}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{counts.active} active</div>
        </Card>

        <Card className="p-3">
          <div className="text-[10px] font-mono uppercase text-purple-600 dark:text-purple-400 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Admins
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-foreground mt-1">
            {counts.admins}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Full governance</div>
        </Card>

        <Card className="p-3">
          <div className="text-[10px] font-mono uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <GraduationCap className="w-3 h-3" /> Mentors
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-foreground mt-1">
            {counts.mentors}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Supervisors</div>
        </Card>

        <Card className="p-3">
          <div className="text-[10px] font-mono uppercase text-blue-600 dark:text-blue-400 flex items-center gap-1">
            <User className="w-3 h-3" /> Mentees
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-foreground mt-1">
            {counts.mentees}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Enrolled fellows</div>
        </Card>

        <Card className="p-3">
          <div className="text-[10px] font-mono uppercase text-muted-foreground flex items-center gap-1">
            <Mail className="w-3 h-3" /> Invitations
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-foreground mt-1">
            {invitations.length}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Pending accept</div>
        </Card>
      </section>

      {/* Control & Filter Toolbar */}
      <section className="p-3 bg-card border border-border rounded-md space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          {/* Role Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: "ALL", label: "All Members", count: counts.total },
              { id: "ORG_ADMIN", label: "Admins", count: counts.admins },
              { id: "MENTOR", label: "Mentors", count: counts.mentors },
              { id: "MENTEE", label: "Mentees", count: counts.mentees },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRoleFilter(tab.id)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  roleFilter === tab.id
                    ? "bg-secondary text-foreground font-semibold border border-border shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <span>{tab.label}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-background border border-border">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search bar with proper padding-left so icon never overlaps */}
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members by name, email, GitHub..."
              className="w-full h-8 pl-9 pr-7 bg-background border border-border rounded text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Member Directory Workstation Table */}
      <Card className="overflow-hidden border-border/80">
        <CardHeader className="p-4 border-b border-border/60 bg-muted/10 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Member Directory ({filteredMembers.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Role permissions, account statuses, and linked developer identities.
            </p>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            {filteredMembers.length} displayed
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-muted/30 border-b border-border text-muted-foreground uppercase text-[10px] font-mono tracking-wider">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">User</th>
                  <th className="py-2.5 px-4 font-semibold">Role Tier</th>
                  <th className="py-2.5 px-4 font-semibold">Status</th>
                  <th className="py-2.5 px-4 font-semibold">GitHub Identity</th>
                  <th className="py-2.5 px-4 font-semibold">Joined Date</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Users className="w-6 h-6 text-muted-foreground/40" />
                        <p className="text-xs">No members found matching &ldquo;{searchQuery}&rdquo;</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSearchQuery("");
                            setRoleFilter("ALL");
                          }}
                          className="text-xs h-7 mt-1 font-sans"
                        >
                          Reset Filters
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m) => {
                    const gh = m.user.githubAccounts?.[0];
                    const isLoading = actionLoadingId === m.id;
                    const roleConfig = ROLES[m.role] || ROLES.MENTEE;
                    const RoleIcon = roleConfig.icon;
                    const isDropdownOpen = activeDropdownId === m.id;

                    return (
                      <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                        {/* User Info */}
                        <td className="py-3 px-4 font-sans">
                          <div className="font-semibold text-foreground text-xs">{m.user.name}</div>
                          <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            {m.user.email}
                          </div>
                        </td>

                        {/* Interactive Role Dropdown Pill */}
                        <td className="py-3 px-4">
                          <div
                            className="relative inline-block text-left"
                            ref={isDropdownOpen ? dropdownRef : null}
                          >
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() =>
                                setActiveDropdownId(isDropdownOpen ? null : m.id)
                              }
                              className={cn(
                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium border transition-all cursor-pointer select-none",
                                roleConfig.badgeClass,
                                isLoading && "opacity-50 cursor-not-allowed"
                              )}
                              title={`Assigned: ${roleConfig.label}. Click to reassign role.`}
                            >
                              {isLoading ? (
                                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                              ) : (
                                <RoleIcon className="w-3 h-3 flex-shrink-0" />
                              )}
                              <span className="font-semibold">{roleConfig.shortLabel}</span>
                              <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
                            </button>

                            {/* Precision Floating Role Menu */}
                            {isDropdownOpen && (
                              <div
                                className="absolute left-0 mt-1.5 w-64 rounded-md border border-border bg-popover text-popover-foreground shadow-2xl z-50 p-1.5 divide-y divide-border/40 animate-in fade-in-50 zoom-in-95"
                                role="menu"
                                aria-orientation="vertical"
                              >
                                <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                                  Assign Member Role
                                </div>
                                <div className="py-1 space-y-0.5">
                                  {Object.values(ROLES).map((r) => {
                                    const isCurrent = m.role === r.value;
                                    const OptionIcon = r.icon;
                                    return (
                                      <button
                                        key={r.value}
                                        type="button"
                                        disabled={isLoading || isCurrent}
                                        onClick={() => {
                                          handleRoleChange(m.id, r.value);
                                          setActiveDropdownId(null);
                                        }}
                                        className={cn(
                                          "w-full text-left p-2 rounded flex items-start gap-2.5 transition-colors text-xs font-sans",
                                          isCurrent
                                            ? "bg-secondary/80 text-foreground cursor-default"
                                            : "hover:bg-muted text-foreground/90 cursor-pointer"
                                        )}
                                      >
                                        <div
                                          className={cn(
                                            "p-1 rounded border flex-shrink-0 mt-0.5",
                                            r.badgeClass
                                          )}
                                        >
                                          <OptionIcon className="w-3 h-3" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between">
                                            <span className="font-semibold text-xs text-foreground">
                                              {r.label}
                                            </span>
                                            {isCurrent && (
                                              <Check className="w-3.5 h-3.5 text-primary stroke-[2.5]" />
                                            )}
                                          </div>
                                          <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2 mt-0.5">
                                            {r.description}
                                          </p>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <Badge
                            variant={m.status === "ACTIVE" ? "success" : "destructive"}
                            className="text-[10px] px-2 py-0.5"
                          >
                            {m.status === "ACTIVE" ? "Active" : "Suspended"}
                          </Badge>
                        </td>

                        {/* GitHub Identity */}
                        <td className="py-3 px-4">
                          {gh ? (
                            <a
                              href={gh.profileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-primary hover:underline inline-flex items-center gap-1.5 text-xs font-semibold"
                            >
                              <Github className="w-3.5 h-3.5 text-foreground" />
                              <span>@{gh.username}</span>
                              <ExternalLink className="w-3 h-3 text-muted-foreground" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-[11px] font-mono">
                              Unlinked
                            </span>
                          )}
                        </td>

                        {/* Joined Date */}
                        <td className="py-3 px-4 text-muted-foreground tabular-nums text-xs">
                          {formatDate(m.joinedAt || m.createdAt)}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant={m.status === "ACTIVE" ? "outline" : "secondary"}
                            disabled={isLoading}
                            onClick={() => handleToggleSuspend(m.id, m.status)}
                            className={cn(
                              "text-[11px] h-7 px-2.5 font-sans gap-1",
                              m.status === "ACTIVE"
                                ? "hover:border-destructive/40 hover:text-destructive"
                                : "text-emerald-600 dark:text-emerald-400"
                            )}
                          >
                            {isLoading ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : m.status === "ACTIVE" ? (
                              <>
                                <UserX className="w-3 h-3" />
                                <span>Suspend</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3 h-3" />
                                <span>Reactivate</span>
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      <Card className="overflow-hidden border-border/80">
        <CardHeader className="p-4 border-b border-border/60 bg-muted/10 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              Pending Invitations ({invitations.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Active invitations awaiting user acceptance.
            </p>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            {invitations.length} pending
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {invitations.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No pending invitations for this organization.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-muted/30 border-b border-border text-muted-foreground uppercase text-[10px] font-mono tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Invited Email</th>
                    <th className="py-2.5 px-4 font-semibold">Role Tier</th>
                    <th className="py-2.5 px-4 font-semibold">Target Cohort</th>
                    <th className="py-2.5 px-4 font-semibold">Expires</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {invitations.map((inv) => {
                    const isLoading = actionLoadingId === inv.id;
                    const rConfig = ROLES[inv.role] || ROLES.MENTEE;
                    return (
                      <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 font-medium text-foreground">{inv.email}</td>
                        <td className="py-3 px-4">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] border font-semibold",
                              rConfig.badgeClass
                            )}
                          >
                            {rConfig.shortLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground font-sans">
                          {inv.cohort?.name || "Org-wide Access"}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground tabular-nums">
                          {formatDate(inv.expiresAt)}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2 font-sans">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => handleResendInvitation(inv.id)}
                            className="text-[11px] h-7 px-2"
                          >
                            Resend
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isLoading}
                            onClick={() => handleRevokeInvitation(inv.id)}
                            className="text-destructive hover:bg-destructive/10 text-[11px] h-7 px-2"
                          >
                            Revoke
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50">
          <Card className="w-full max-w-md shadow-2xl border-border">
            <CardHeader className="pb-3 border-b border-border/80 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-primary" />
                  Invite Member to Organization
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Send an email invitation with an assigned role tier.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleInviteSubmit} className="space-y-4 text-xs">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="collaborator@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />

                <div className="space-y-1.5">
                  <label className="font-medium text-foreground block">Organization Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.values(ROLES).map((r) => {
                      const isSelected = inviteRole === r.value;
                      const Icon = r.icon;
                      return (
                        <div
                          key={r.value}
                          onClick={() => setInviteRole(r.value)}
                          className={cn(
                            "p-2.5 rounded-md border cursor-pointer transition-all flex flex-col justify-between gap-1 select-none",
                            isSelected
                              ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30"
                              : "border-border bg-card hover:bg-muted/40"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                              <Icon className="w-3.5 h-3.5 text-primary" />
                              {r.shortLabel}
                            </span>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-primary stroke-[2.5]" />
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground line-clamp-1">
                            {r.description}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-medium text-foreground block">Assign to Cohort (Optional)</label>
                  <select
                    className="w-full bg-background border border-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/50 font-mono"
                    value={inviteCohortId}
                    onChange={(e) => setInviteCohortId(e.target.value)}
                  >
                    <option value="">None (Org-wide access)</option>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowInviteModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" loading={submittingInvite}>
                    Send Invitation
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
