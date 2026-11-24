"use client";

import React, { useState, useEffect } from "react";
import { GitCommit, GitPullRequest, GitMerge, AlertCircle, MessageSquare, ExternalLink, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { formatDate } from "@/lib/date";

export interface ActivityItem {
  id: string;
  title: string;
  summary?: string | null;
  url?: string | null;
  activityType: string;
  isFixture?: boolean;
  occurredAt: Date | string;
}

export function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (items.length === 0) {
    return (
      <div className="text-center py-8 px-4 rounded-lg border border-dashed border-border/80 bg-muted/20">
        <GitBranch className="w-6 h-6 text-muted-foreground/60 mx-auto mb-2" />
        <p className="text-xs font-semibold text-foreground">No recent GitHub activity</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Commits, pull requests, and issues will stream here automatically.
        </p>
      </div>
    );
  }

  const getActivityMeta = (type: string) => {
    switch (type) {
      case "COMMIT":
        return {
          icon: <GitCommit className="w-3.5 h-3.5 text-cyan-500" />,
          badgeVariant: "cyan" as const,
          bgGlow: "bg-cyan-500/10 border-cyan-500/20",
          label: "Commit",
        };
      case "PULL_REQUEST_OPENED":
        return {
          icon: <GitPullRequest className="w-3.5 h-3.5 text-emerald-500" />,
          badgeVariant: "success" as const,
          bgGlow: "bg-emerald-500/10 border-emerald-500/20",
          label: "PR Opened",
        };
      case "PULL_REQUEST_MERGED":
        return {
          icon: <GitMerge className="w-3.5 h-3.5 text-purple-500" />,
          badgeVariant: "purple" as const,
          bgGlow: "bg-purple-500/10 border-purple-500/20",
          label: "PR Merged",
        };
      case "ISSUE_OPENED":
        return {
          icon: <AlertCircle className="w-3.5 h-3.5 text-amber-500" />,
          badgeVariant: "warning" as const,
          bgGlow: "bg-amber-500/10 border-amber-500/20",
          label: "Issue",
        };
      default:
        return {
          icon: <MessageSquare className="w-3.5 h-3.5 text-blue-500" />,
          badgeVariant: "default" as const,
          bgGlow: "bg-primary/10 border-primary/20",
          label: "Event",
        };
    }
  };

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const meta = getActivityMeta(item.activityType);
        return (
          <div
            key={item.id}
            className="group relative flex items-start gap-3 p-2.5 rounded-lg border border-border/40 hover:border-border hover:bg-muted/40 transition-all duration-150"
          >
            {/* Glowing Activity Icon Node */}
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 mt-0.5 ${meta.bgGlow}`}
            >
              {meta.icon}
            </div>

            {/* Content Body */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-xs text-foreground truncate block">
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                    >
                      <span className="truncate">{item.title}</span>
                      <ExternalLink className="w-3 h-3 text-muted-foreground opacity-60 group-hover:opacity-100 shrink-0" />
                    </a>
                  ) : (
                    item.title
                  )}
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  {item.isFixture && (
                    <Badge
                      variant="secondary"
                      className="text-[9px] py-0 px-1 font-normal text-muted-foreground"
                    >
                      Fixture
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {mounted
                      ? formatDistanceToNow(new Date(item.occurredAt), { addSuffix: true })
                      : formatDate(item.occurredAt)}
                  </span>
                </div>
              </div>

              {item.summary && (
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {item.summary}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
