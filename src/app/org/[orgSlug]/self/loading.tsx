import React from "react";

export default function SelfTrackingLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading personal workspace">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="space-y-2">
          <div className="h-3 w-44 rounded bg-white/10" />
          <div className="h-7 w-64 rounded bg-white/15" />
          <div className="h-3 w-80 max-w-full rounded bg-white/10" />
        </div>
        <div className="flex gap-2.5">
          <div className="h-8 w-32 rounded-md bg-white/10" />
          <div className="h-8 w-36 rounded-md bg-emerald-500/20" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="self-glass-surface rounded-xl p-4 space-y-3">
            <div className="h-3 w-24 rounded bg-white/10" />
            <div className="h-7 w-20 rounded bg-white/15" />
            <div className="h-3 w-32 rounded bg-white/10" />
          </div>
        ))}
      </div>

      <div className="self-glass-surface rounded-xl p-4 space-y-3">
        <div className="h-3 w-36 rounded bg-white/10" />
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-white/[0.04] border border-white/10" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="self-glass-surface rounded-xl p-5 space-y-3">
            <div className="h-4 w-48 rounded bg-white/15" />
            <div className="h-24 rounded-lg bg-white/[0.04]" />
          </div>
        ))}
      </div>
    </div>
  );
}

