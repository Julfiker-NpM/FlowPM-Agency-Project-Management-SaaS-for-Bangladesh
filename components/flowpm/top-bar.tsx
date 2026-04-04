"use client";

import { usePathname } from "next/navigation";
import { titleForPath } from "@/lib/nav";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { Plus, ChevronDown, LogOut } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

function initials(name: string | null, email: string) {
  const n = name?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return parts[0][0]?.toUpperCase() ?? "?";
  }
  return email[0]?.toUpperCase() ?? "?";
}

export type TopBarUser = {
  name: string | null;
  email: string;
};

export function TopBar(props: {
  user: TopBarUser;
  organizationName: string;
  onSignOut: () => void;
}) {
  const { user, organizationName, onSignOut } = props;
  const pathname = usePathname();
  const title = titleForPath(pathname);
  const displayName = user.name?.trim() || user.email.split("@")[0] || "Account";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-flowpm-border bg-flowpm-surface/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-flowpm-surface/80 md:px-8">
      <h1 className="font-heading text-xl font-semibold text-flowpm-dark md:pl-0 pl-12">
        {title}
      </h1>
      <div className="flex items-center gap-2">
        {pathname === "/projects" && (
          <Link
            href="/projects/new"
            className={cn(
              buttonVariants({ variant: "default" }),
              "inline-flex h-9 items-center bg-flowpm-primary text-white hover:bg-flowpm-primary-hover",
            )}
          >
            <Plus className="mr-1.5 size-4" />
            New project
          </Link>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex h-9 max-w-[min(100vw-8rem,16rem)] items-center gap-2 rounded-lg border border-flowpm-border bg-flowpm-surface px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-flowpm-canvas focus-visible:ring-2 focus-visible:ring-flowpm-primary/30",
            )}
          >
            <Avatar size="sm" className="size-7">
              <AvatarFallback className="bg-[#EEEDFE] text-[10px] font-medium text-[#534AB7]">
                {initials(user.name, user.email)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden min-w-0 flex-1 truncate font-medium text-flowpm-body sm:block">
              {displayName}
            </span>
            <ChevronDown className="size-4 shrink-0 text-flowpm-muted" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="min-w-[14rem] border border-flowpm-border bg-flowpm-surface p-0 shadow-lg"
          >
            <div className="border-b border-flowpm-border px-3 py-3">
              <p className="truncate text-sm font-semibold text-flowpm-dark">{displayName}</p>
              <p className="truncate text-xs text-flowpm-muted">{user.email}</p>
              <p className="mt-2 truncate text-xs text-flowpm-muted">{organizationName}</p>
            </div>
            <div className="p-1">
              <button
                type="button"
                onClick={onSignOut}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-flowpm-danger transition-colors hover:bg-red-50"
              >
                <LogOut className="size-4 shrink-0" aria-hidden />
                Sign out
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
