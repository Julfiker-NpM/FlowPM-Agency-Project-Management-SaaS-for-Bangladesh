"use client";

import { ThemeProvider } from "@/components/flowpm/theme-context";
import { FlowAuthProvider } from "@/context/flowpm-auth-context";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <FlowAuthProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </FlowAuthProvider>
  );
}
