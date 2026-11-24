import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "glow";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-md transition-all duration-150 select-none cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60 disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed active:scale-[0.98]";

    const variants = {
      primary:
        "bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs border border-primary/20",
      secondary:
        "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border",
      outline:
        "border border-border bg-transparent hover:bg-muted text-foreground hover:border-border/80",
      ghost:
        "text-muted-foreground hover:bg-muted hover:text-foreground",
      destructive:
        "bg-red-600 text-white hover:bg-red-500 shadow-xs border border-red-500/30",
      glow:
        "bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow font-medium border border-primary/30",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-9 px-4 text-xs sm:text-sm gap-2",
      lg: "h-10 px-5 text-sm sm:text-base gap-2.5",
      icon: "h-8 w-8 p-0",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-0.5 mr-2 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
