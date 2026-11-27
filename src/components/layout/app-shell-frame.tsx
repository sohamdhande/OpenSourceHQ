"use client";

import React from "react";
import { usePathname } from "next/navigation";

export function AppShellFrame({
  orgSlug,
  children,
}: {
  orgSlug: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isSelfView = pathname.startsWith(`/org/${orgSlug}/self`);

  return (
    <div
      className={
        isSelfView
          ? "self-glass-theme relative min-h-screen overflow-x-hidden"
          : "min-h-screen bg-background bg-grid-mesh"
      }
    >
      {isSelfView && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden bg-[#020306]">
          <div
            className="absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255, 255, 255, 0.18) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="absolute -top-28 left-[15%] h-[28rem] w-[38rem] rounded-full bg-emerald-500/30 blur-[100px]" />
          <div className="absolute top-[22%] right-[8%] h-[26rem] w-[32rem] rounded-full bg-cyan-400/22 blur-[100px]" />
          <div className="absolute bottom-[-8%] left-[35%] h-[26rem] w-[38rem] rounded-full bg-indigo-500/25 blur-[110px]" />
          <div className="absolute top-[55%] left-[5%] h-[18rem] w-[22rem] rounded-full bg-teal-400/18 blur-[90px]" />
        </div>
      )}
      {children}
    </div>
  );
}

