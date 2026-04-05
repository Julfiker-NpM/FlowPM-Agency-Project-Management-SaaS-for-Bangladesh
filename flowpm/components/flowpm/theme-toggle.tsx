"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFlowTheme } from "@/components/flowpm/theme-context";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, mounted } = useFlowTheme();

  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-flowpm-border bg-flowpm-surface p-0.5 shadow-sm",
        className,
      )}
      role="group"
      aria-label="Theme"
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
          !mounted || theme === "light"
            ? "bg-flowpm-primary-light text-flowpm-primary"
            : "text-flowpm-muted hover:text-flowpm-body",
        )}
        title="Day mode"
      >
        <Sun className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">Day</span>
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
          mounted && theme === "dark"
            ? "bg-flowpm-primary-light text-flowpm-primary"
            : "text-flowpm-muted hover:text-flowpm-body",
        )}
        title="Night mode"
      >
        <Moon className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">Night</span>
      </button>
    </div>
  );
}
