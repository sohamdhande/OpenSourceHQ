import React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { SessionUser } from "@/server/auth/session";

interface AppShellProps {
  user: SessionUser;
  orgSlug: string;
  children: React.ReactNode;
}

export function AppShell({ user, orgSlug, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background bg-grid-mesh">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Sidebar user={user} orgSlug={orgSlug} />
      <div className="min-h-screen min-w-0 pl-16 md:pl-64 flex flex-col">
        <Topbar user={user} orgSlug={orgSlug} />
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1440px] flex-1 overflow-y-auto p-4 md:p-7 xl:p-9">{children}</main>
      </div>
    </div>
  );
}
