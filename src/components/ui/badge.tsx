import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "default"
    | "success"
    | "warning"
    | "destructive"
    | "secondary"
    | "outline"
    | "cyan"
    | "purple"
    | "flame";
  dot?: boolean;
}

export function Badge({ className, variant = "default", dot, children, ...props }: BadgeProps) {
  const variants = {
    default: "bg-blue-500/15 text-blue-900 dark:text-blue-300 border-blue-500/30",
    secondary: "bg-secondary text-secondary-foreground border-border",
    success: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-300 border-emerald-500/30",
    warning: "bg-amber-500/15 text-amber-900 dark:text-amber-300 border-amber-500/30",
    destructive: "bg-red-500/15 text-red-900 dark:text-red-300 border-red-500/30",
    outline: "text-foreground border-border bg-secondary/40 font-medium",
    cyan: "bg-cyan-500/15 text-cyan-900 dark:text-cyan-300 border-cyan-500/30",
    purple: "bg-purple-500/15 text-purple-900 dark:text-purple-300 border-purple-500/30",
    flame: "bg-orange-500/15 text-orange-900 dark:text-orange-300 border-orange-500/30",
  };

  const dotColors = {
    default: "bg-blue-500",
    secondary: "bg-zinc-400",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    destructive: "bg-red-500",
    outline: "bg-zinc-200",
    cyan: "bg-cyan-500",
    purple: "bg-purple-500",
    flame: "bg-orange-500",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition-colors leading-none tracking-tight font-mono tabular-nums",
        variants[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn("w-1.5 h-1.5 rounded-full animate-pulse", dotColors[variant])}
        />
      )}
      {children}
    </div>
  );
}
