"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Layers,
  FolderGit2,
  CheckSquare,
  FileText,
  BarChart3,
  Megaphone,
  Calendar,
  Github,
  ShieldAlert,
  Settings,
  MessageSquare,
  Award,
  HeartHandshake,
  AlertCircle,
  Terminal,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SessionUser } from "@/server/auth/session";

interface SidebarProps {
  user: SessionUser;
  orgSlug: string;
}

interface NavSection {
  title: string;
  links: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[];
}

export function Sidebar({ user, orgSlug }: SidebarProps) {
  const pathname = usePathname();
  const role = user.activeOrgRole;
  const isMentee = role === "MENTEE" || (!role && !user.isPlatformSuperAdmin) || pathname.includes("/student");

  let sections: NavSection[] = [];

  if (role === "ORG_ADMIN" || user.isPlatformSuperAdmin) {
    sections = [
      {
        title: "OVERVIEW",
        links: [
          { href: `/org/${orgSlug}/admin`, label: "Admin Overview", icon: LayoutDashboard },
          { href: `/org/${orgSlug}/admin/analytics`, label: "Program Analytics", icon: BarChart3 },
        ],
      },
      {
        title: "PEOPLE & COHORTS",
        links: [
          { href: `/org/${orgSlug}/admin/cohorts`, label: "Cohorts", icon: Layers },
          { href: `/org/${orgSlug}/admin/mentees`, label: "Mentees", icon: GraduationCap },
          { href: `/org/${orgSlug}/admin/mentors`, label: "Mentors", icon: Award },
          { href: `/org/${orgSlug}/admin/members`, label: "Members", icon: Users },
        ],
      },
      {
        title: "ENGINEERING",
        links: [
          { href: `/org/${orgSlug}/admin/repositories`, label: "Repositories", icon: FolderGit2 },
          { href: `/org/${orgSlug}/admin/tasks`, label: "Tasks", icon: CheckSquare },
          { href: `/org/${orgSlug}/admin/reports`, label: "Daily Reports", icon: FileText },
          { href: `/org/${orgSlug}/admin/learning`, label: "Learning Paths", icon: Award },
          { href: `/org/${orgSlug}/admin/events`, label: "Events & Syncs", icon: Calendar },
          { href: `/org/${orgSlug}/admin/announcements`, label: "Announcements", icon: Megaphone },
        ],
      },
      {
        title: "GOVERNANCE",
        links: [
          { href: `/org/${orgSlug}/admin/integrations/github`, label: "GitHub App", icon: Github },
          { href: `/org/${orgSlug}/admin/integrations/gmail`, label: "Gmail Integration", icon: Mail },
          { href: `/org/${orgSlug}/admin/audit`, label: "Audit Logs", icon: ShieldAlert },
          { href: `/org/${orgSlug}/admin/settings`, label: "Settings", icon: Settings },
        ],
      },
    ];
  } else if (role === "MENTOR") {
    sections = [
      {
        title: "OVERVIEW",
        links: [
          { href: `/org/${orgSlug}/mentor`, label: "Workspace Overview", icon: LayoutDashboard },
          { href: `/org/${orgSlug}/mentor/cohorts`, label: "My Cohorts", icon: Layers },
          { href: `/org/${orgSlug}/mentor/mentees`, label: "Assigned Mentees", icon: GraduationCap },
          { href: `/org/${orgSlug}/mentor/learning`, label: "Learning Paths", icon: Award },
        ],
      },
      {
        title: "REVIEWS & TRIAGE",
        links: [
          { href: `/org/${orgSlug}/mentor/reports`, label: "Review Reports", icon: FileText },
          { href: `/org/${orgSlug}/mentor/blockers`, label: "Blocker Triage", icon: AlertCircle },
          { href: `/org/${orgSlug}/mentor/tasks`, label: "Manage Tasks", icon: CheckSquare },
          { href: `/org/${orgSlug}/mentor/reviews`, label: "Feedback & Reviews", icon: HeartHandshake },
        ],
      },
      {
        title: "TELEMETRY",
        links: [
          { href: `/org/${orgSlug}/mentor/analytics`, label: "Cohort Analytics", icon: BarChart3 },
          { href: `/org/${orgSlug}/mentor/events`, label: "Syncs & Events", icon: Calendar },
        ],
      },
    ];
  } else if (role === "OBSERVER") {
    sections = [
      {
        title: "PROGRAM OVERVIEW",
        links: [
          { href: `/org/${orgSlug}/observer`, label: "Overview & updates", icon: LayoutDashboard },
        ],
      },
    ];
  } else {
    // Mentee / Student
    sections = [
      {
        title: "COMMAND CENTER",
        links: [
          { href: `/org/${orgSlug}/student`, label: "Overview", icon: LayoutDashboard },
          { href: `/org/${orgSlug}/student/daily-log`, label: "Submit Daily Log", icon: FileText },
          { href: `/org/${orgSlug}/student/reports`, label: "Report History", icon: Layers },
        ],
      },
      {
        title: "CODE & EXECUTION",
        links: [
          { href: `/org/${orgSlug}/student/tasks`, label: "My Tasks", icon: CheckSquare },
          { href: `/org/${orgSlug}/student/blockers`, label: "My Blockers", icon: AlertCircle },
          { href: `/org/${orgSlug}/student/learning`, label: "Learning Paths", icon: Award },
          { href: `/org/${orgSlug}/student/github`, label: "GitHub Telemetry", icon: Github },
          { href: `/org/${orgSlug}/student/repositories`, label: "Repositories", icon: FolderGit2 },
        ],
      },
      {
        title: "COMMUNITY & SYNC",
        links: [
          { href: `/org/${orgSlug}/student/community`, label: "Cohort Community", icon: MessageSquare },
          { href: `/org/${orgSlug}/student/feedback`, label: "Mentor Feedback", icon: HeartHandshake },
          { href: `/org/${orgSlug}/student/events`, label: "Events & Attendance", icon: Calendar },
          { href: `/org/${orgSlug}/student/profile`, label: "Settings & Profile", icon: Settings },
        ],
      },
    ];
  }

  const roleLabels = {
    ORG_ADMIN: "Admin",
    MENTOR: "Mentor",
    MENTEE: "Fellow",
    OBSERVER: "Observer",
  };

  const roleColors = {
    ORG_ADMIN: "bg-purple-500/15 text-purple-900 dark:text-purple-300 border-purple-500/30",
    MENTOR: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-300 border-emerald-500/30",
    MENTEE: "bg-blue-500/15 text-blue-900 dark:text-blue-300 border-blue-500/30",
    OBSERVER: "bg-zinc-500/15 text-zinc-900 dark:text-zinc-300 border-border",
  };

  return (
    <aside aria-label="Primary navigation" className="app-sidebar fixed inset-y-0 left-0 z-40 flex h-screen w-16 shrink-0 select-none flex-col border-r border-border bg-card md:w-64">
      {/* Brand Header */}
      <div className="flex h-14 items-center gap-3 border-b border-border px-3 md:px-4">
        <div className="relative w-8 h-8 rounded-md bg-secondary border border-border flex items-center justify-center text-foreground font-bold text-xs shadow-xs shrink-0">
          <Terminal className="w-4 h-4 text-primary" />
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-500 ring-2 ring-card" />
        </div>
        <div className="sidebar-brand-copy min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm tracking-tight text-foreground">OpenSourceHQ</span>
          </div>
          <span className="block text-[10px] text-muted-foreground font-mono truncate">
            {user.activeOrgName || orgSlug}
          </span>
        </div>
      </div>

      {/* Nav List with Sections */}
      <nav aria-label="Workspace" className="flex-1 space-y-4 overflow-y-auto px-2 py-3 md:px-3">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-0.5">
            <h4 className="sidebar-section-label px-2.5 text-[10px] font-bold tracking-wider text-muted-foreground/90 dark:text-zinc-400 font-mono uppercase">
              {section.title}
            </h4>
            <div className="space-y-0.5 pt-0.5">
              {section.links.map((link) => {
                const Icon = link.icon;
                const baseRoutes = [
                  `/org/${orgSlug}/admin`,
                  `/org/${orgSlug}/mentor`,
                  `/org/${orgSlug}/student`,
                ];
                const isBaseRoute = baseRoutes.includes(link.href);
                const isActive = pathname === link.href || (!isBaseRoute && pathname.startsWith(link.href));

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-label={link.label}
                    aria-current={isActive ? "page" : undefined}
                    title={link.label}
                    className={cn("sidebar-link",
                      "group flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-all duration-150 relative",
                      isActive
                        ? "bg-muted text-foreground font-semibold shadow-xs"
                        : "text-zinc-700 dark:text-zinc-200 hover:text-foreground dark:hover:text-white hover:bg-muted/60 font-medium"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={cn(
                          "w-3.5 h-3.5 transition-colors",
                          isActive
                            ? "text-primary"
                            : "text-zinc-500 dark:text-zinc-300 group-hover:text-foreground dark:group-hover:text-white"
                        )}
                      />
                      <span className="sidebar-link-label truncate">{link.label}</span>
                    </div>

                    {link.badge && (
                      <span
                        className={cn(
                          "text-[10px] font-mono px-1.5 py-0.2 rounded font-medium",
                          isActive
                            ? "bg-primary/15 text-primary border border-primary/25"
                            : "bg-muted text-zinc-600 dark:text-zinc-200 border border-border"
                        )}
                      >
                        {link.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer User Profile Card */}
      <div className="sidebar-footer border-t border-border p-2.5">
        <div className="flex items-center justify-between gap-2.5 p-2 rounded-md border border-border bg-card shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative">
              <div className="w-7 h-7 rounded bg-secondary border border-border flex items-center justify-center text-foreground text-xs font-semibold shrink-0">
                {(user?.name || "U").charAt(0).toUpperCase()}
              </div>
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-card" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-semibold text-foreground truncate block leading-tight">
                {user?.name || "User"}
              </span>
              <span
                className={cn(
                  "inline-block px-1.5 py-0.2 rounded text-[9px] font-mono uppercase border mt-0.5 font-medium",
                  roleColors[role as keyof typeof roleColors] || "bg-muted text-muted-foreground border-border"
                )}
              >
                {roleLabels[role as keyof typeof roleLabels] || "GUEST"}
              </span>
            </div>
          </div>
        </div>

        {/* Mentee branding: Made by nst sdc with GitHub logo */}
        {isMentee && (
          <a
            href="https://github.com/nst-sdc"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2.5 flex items-center justify-center gap-1.5 py-0.5 text-[11px] text-zinc-600 dark:text-zinc-300 hover:text-foreground dark:hover:text-white transition-colors font-mono"
            title="Open NST SDC on GitHub"
          >
            <Github className="w-3.5 h-3.5 shrink-0" />
            <span>made by <span className="font-semibold text-foreground dark:text-white hover:underline">nst sdc.</span></span>
          </a>
        )}
      </div>
    </aside>
  );
}
