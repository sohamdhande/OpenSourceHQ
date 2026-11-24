import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, id, ...props }, ref) => {
    const { ["aria-describedby"]: externalDescribedBy, ["aria-invalid"]: externalInvalid, ...restProps } = props;
    const generatedId = React.useId();
    const controlId = id || generatedId;
    const describedBy = [externalDescribedBy, error ? `${controlId}-error` : null].filter(Boolean).join(" ") || undefined;
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={controlId} className="text-xs font-medium text-foreground">
            {label}
          </label>
        )}
        <input
          id={controlId}
          type={type}
          aria-invalid={error ? true : externalInvalid}
          aria-describedby={describedBy}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40",
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
          ref={ref}
          {...restProps}
        />
        {error && <p id={`${controlId}-error`} className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const { ["aria-describedby"]: externalDescribedBy, ["aria-invalid"]: externalInvalid, ...restProps } = props;
    const generatedId = React.useId();
    const controlId = id || generatedId;
    const describedBy = [externalDescribedBy, error ? `${controlId}-error` : null].filter(Boolean).join(" ") || undefined;
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={controlId} className="text-xs font-medium text-foreground">
            {label}
          </label>
        )}
        <textarea
          id={controlId}
          aria-invalid={error ? true : externalInvalid}
          aria-describedby={describedBy}
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40",
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
          ref={ref}
          {...restProps}
        />
        {error && <p id={`${controlId}-error`} className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
