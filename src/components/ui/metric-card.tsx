import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: string;
  trendType?: "positive" | "negative" | "warning" | "neutral";
  progress?: number; // 0 to 100
  accent?: "default" | "flame" | "emerald" | "cyan" | "purple" | "rose";
}

export function MetricCard({
  title,
  value,
  description,
  icon,
  trend,
  trendType = "neutral",
  progress,
  accent = "default",
}: MetricCardProps) {
  const accentIconStyles = {
    default: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    flame: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    purple: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };

  const accentProgressStyles = {
    default: "bg-blue-500",
    flame: "bg-amber-500",
    emerald: "bg-emerald-500",
    cyan: "bg-cyan-500",
    purple: "bg-blue-500",
    rose: "bg-rose-500",
  };

  return (
    <Card interactive className="group">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider truncate font-mono">
            {title}
          </p>
          {icon && (
            <div
              className={cn(
                "w-7 h-7 rounded flex items-center justify-center border text-xs transition-transform group-hover:scale-105 duration-150 shrink-0",
                accentIconStyles[accent]
              )}
            >
              {icon}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-2">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight font-mono tabular-nums text-foreground">
            {value}
          </div>

          {trend && (
            <div
              className={cn(
                "inline-flex items-center gap-1 text-[10.5px] font-medium font-mono tabular-nums px-2 py-0.5 rounded border",
                trendType === "positive" &&
                  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                trendType === "warning" &&
                  "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                trendType === "negative" &&
                  "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
                trendType === "neutral" &&
                  "bg-secondary text-muted-foreground border-border"
              )}
            >
              {trendType === "positive" && <TrendingUp className="w-3 h-3 text-emerald-400" />}
              {trendType === "negative" && <TrendingDown className="w-3 h-3 text-red-400" />}
              {trendType === "warning" && <TrendingUp className="w-3 h-3 text-amber-400" />}
              {trendType === "neutral" && <Minus className="w-3 h-3 text-zinc-400" />}
              <span>{trend}</span>
            </div>
          )}
        </div>

        {progress !== undefined && (
          <div className="mt-3 w-full bg-secondary border border-border rounded-full h-1 overflow-hidden">
            <div
              className={cn("h-full transition-all duration-300", accentProgressStyles[accent])}
              style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
            />
          </div>
        )}

        {description && (
          <p className="mt-2 text-xs text-muted-foreground leading-normal line-clamp-1">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
