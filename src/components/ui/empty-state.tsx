import React from "react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-border bg-card/40 my-4">
      {icon && <div className="p-3 bg-muted rounded-full text-muted-foreground mb-3">{icon}</div>}
      <h4 className="text-sm font-semibold">{title}</h4>
      <p className="text-xs text-muted-foreground max-w-sm mt-1">{description}</p>
      {actionLabel && onAction && (
        <Button size="sm" variant="outline" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

