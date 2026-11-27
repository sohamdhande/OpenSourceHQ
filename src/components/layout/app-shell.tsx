import React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { AppShellFrame } from "@/components/layout/app-shell-frame";
import { SessionUser } from "@/server/auth/session";

interface AppShellProps {
  user: SessionUser;
  orgSlug: string;
  children: React.ReactNode;
}

export function AppShell({ user, orgSlug, children }: AppShellProps) {
  return (
    <AppShellFrame orgSlug={orgSlug}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Sidebar user={user} orgSlug={orgSlug} />
      <div className="relative z-10 min-h-screen min-w-0 pl-16 md:pl-64 flex flex-col">
        <Topbar user={user} orgSlug={orgSlug} />
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1440px] flex-1 overflow-y-auto p-4 md:p-7 xl:p-9">{children}</main>
      </div>
    </AppShellFrame>
  );
}
