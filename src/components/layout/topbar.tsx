"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Command, LogOut, Moon, Plus, Search, Sparkles, Sun, X } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { SessionUser } from "@/server/auth/session";
import { NotificationCenter } from "@/components/layout/notification-center";

interface TopbarProps { user: SessionUser; orgSlug: string }

export function Topbar({ user, orgSlug }: TopbarProps) {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const commandInputRef = useRef<HTMLInputElement>(null);
  const commandDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setCommandOpen((open) => !open);
      }
      if (event.key === "Escape") setCommandOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!commandOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    commandInputRef.current?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = commandDialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", trapFocus);
    return () => {
      window.removeEventListener("keydown", trapFocus);
      previouslyFocused?.focus();
    };
  }, [commandOpen]);

  const isMentee = user.activeOrgRole === "MENTEE" || (!user.activeOrgRole && !user.isPlatformSuperAdmin);
  const quickAction = isMentee
    ? { href: `/org/${orgSlug}/student/daily-log`, label: "Submit daily log", icon: Plus }
    : user.activeOrgRole === "MENTOR"
      ? { href: `/org/${orgSlug}/mentor/reports`, label: "Review reports", icon: Sparkles }
      : user.activeOrgRole === "OBSERVER"
        ? null
        : { href: `/org/${orgSlug}/admin/members`, label: "Manage members", icon: Plus };

  const destinations = useMemo(() => {
    const items = user.activeOrgRole === "MENTOR" ? [
      { href: `/org/${orgSlug}/mentor`, label: "Mentor overview", detail: "Workspace home" },
      { href: `/org/${orgSlug}/mentor/mentees`, label: "Assigned mentees", detail: "People and progress" },
      { href: `/org/${orgSlug}/mentor/reports`, label: "Review reports", detail: "Daily submissions" },
      { href: `/org/${orgSlug}/mentor/tasks`, label: "Manage tasks", detail: "Assignments and reviews" },
    ] : user.activeOrgRole === "ORG_ADMIN" || user.isPlatformSuperAdmin ? [
      { href: `/org/${orgSlug}/admin`, label: "Admin overview", detail: "Program status" },
      { href: `/org/${orgSlug}/admin/members`, label: "Members", detail: "People and access" },
      { href: `/org/${orgSlug}/admin/cohorts`, label: "Cohorts", detail: "Mentorship groups" },
      { href: `/org/${orgSlug}/admin/repositories`, label: "Repositories", detail: "Tracked projects" },
      { href: `/org/${orgSlug}/admin/integrations/github`, label: "GitHub App", detail: "Installation and sync" },
    ] : user.activeOrgRole === "OBSERVER" ? [
      { href: `/org/${orgSlug}/observer`, label: "Program overview", detail: "Read-only organization updates" },
    ] : [
      { href: `/org/${orgSlug}/student`, label: "Overview", detail: "Your program" },
      { href: `/org/${orgSlug}/student/daily-log`, label: "Submit daily log", detail: "Record today's work" },
      { href: `/org/${orgSlug}/student/tasks`, label: "My tasks", detail: "Assignments and evidence" },
      { href: `/org/${orgSlug}/student/repositories`, label: "Repositories", detail: "Open-source projects" },
      { href: `/org/${orgSlug}/student/github`, label: "GitHub activity", detail: "Commits and pull requests" },
    ];
    const q = commandQuery.trim().toLowerCase();
    return q ? items.filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(q)) : items;
  }, [commandQuery, orgSlug, user.activeOrgRole, user.isPlatformSuperAdmin]);

  const signOut = async () => {
    setLoggingOut(true);
    try { await fetch("/api/auth/logout", { method: "POST" }); }
    finally { router.push("/login"); router.refresh(); }
  };

  return <>
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/95 px-3 backdrop-blur-md md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="hidden min-w-0 items-center gap-2 sm:flex">
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 beacon-live" />
          <span className="truncate text-xs font-semibold text-foreground font-mono">{user.activeOrgName || orgSlug}</span>
        </div>
        <button
          type="button"
          onClick={() => { setCommandOpen(true); setCommandQuery(""); }}
          className="flex h-8 w-[min(42vw,280px)] items-center gap-2 rounded border border-border bg-secondary/60 px-3 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground md:w-72"
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">Search workspace…</span>
          <kbd className="hidden rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">⌘ K</kbd>
        </button>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        {quickAction && (
          <Link
            href={quickAction.href}
            className={`hidden h-8 items-center gap-1.5 rounded border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:inline-flex ${
              isMentee
                ? "border-primary/20 bg-primary text-primary-foreground hover:bg-primary/90"
                : "border-border bg-secondary/60 text-foreground hover:bg-secondary"
            }`}
          >
            <quickAction.icon className="h-3.5 w-3.5" />
            {quickAction.label}
          </Link>
        )}
        <NotificationCenter />
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Toggle theme">{mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
        <span className="hidden h-5 border-l border-border sm:block" />
        <Button variant="ghost" size="sm" onClick={signOut} disabled={loggingOut} className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-destructive"><LogOut className="h-3.5 w-3.5" /><span className="hidden md:inline">Sign out</span></Button>
      </div>
    </header>

    {commandOpen && <div className="command-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommandOpen(false); }}>
      <div ref={commandDialogRef} className="command-dialog" role="dialog" aria-modal="true" aria-label="Search workspace">
        <div className="flex items-center gap-3 border-b border-border px-4"><Search className="h-4 w-4 text-muted-foreground" /><input ref={commandInputRef} value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} aria-label="Search pages and actions" placeholder="Search pages and actions…" className="h-14 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /><button type="button" aria-label="Close search" onClick={() => setCommandOpen(false)} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button></div>
        <div className="max-h-[min(60vh,460px)] overflow-y-auto p-2">{destinations.length ? destinations.map((item) => <Link key={item.href} href={item.href} onClick={() => setCommandOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted ${pathname === item.href ? "bg-primary/10" : ""}`}><div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card"><Command className="h-4 w-4 text-muted-foreground" /></div><div className="min-w-0"><p className="text-sm font-medium">{item.label}</p><p className="text-xs text-muted-foreground">{item.detail}</p></div><span className="ml-auto text-xs text-muted-foreground">↵</span></Link>) : <p className="px-3 py-8 text-center text-sm text-muted-foreground">No matching pages.</p>}</div>
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground"><span>Navigate your workspace</span><span>ESC to close</span></div>
      </div>
    </div>}
  </>;
}
