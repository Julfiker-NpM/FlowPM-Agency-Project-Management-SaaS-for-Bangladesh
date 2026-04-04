"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { mainNav } from "@/lib/nav";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useUiStore } from "@/lib/store/ui-store";
import { Menu } from "lucide-react";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {mainNav.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
              active
                ? "bg-[#EEEDFE] text-[#534AB7]"
                : "text-flowpm-muted hover:bg-flowpm-canvas hover:text-flowpm-body",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

type AppSidebarProps = {
  userDisplayName: string;
  userEmail: string;
  organizationName: string;
  onSignOut: () => void;
};

export function AppSidebar({ userDisplayName, userEmail, organizationName, onSignOut }: AppSidebarProps) {
  const { mobileNavOpen, setMobileNavOpen } = useUiStore();

  return (
    <>
      {/* Desktop */}
      <aside className="hidden h-screen w-[220px] shrink-0 flex-col border-r border-flowpm-border bg-flowpm-surface md:flex">
        <div className="border-b border-flowpm-border px-4 py-5">
          <Link href="/dashboard" className="font-heading text-lg font-bold text-flowpm-dark">
            FlowPM
          </Link>
          <p className="mt-0.5 text-xs text-flowpm-muted">{organizationName}</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <div className="border-t border-flowpm-border p-3">
          <div className="mb-2 rounded-xl bg-flowpm-canvas/80 px-3 py-2">
            <p className="truncate text-sm font-medium text-flowpm-body">{userDisplayName}</p>
            <p className="truncate text-xs text-flowpm-muted">{userEmail}</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-flowpm-muted transition-colors hover:bg-flowpm-canvas hover:text-flowpm-body"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile trigger */}
      <div className="fixed left-4 top-3 z-40 md:hidden">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-lg border border-flowpm-border bg-flowpm-surface shadow-card",
            )}
          >
            <Menu className="size-4" />
            <span className="sr-only">Open menu</span>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-[240px] flex-col p-0">
            <div className="border-b border-flowpm-border px-4 py-5">
              <span className="font-heading text-lg font-bold text-flowpm-dark">FlowPM</span>
              <p className="mt-0.5 text-xs text-flowpm-muted">{organizationName}</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavLinks onNavigate={() => setMobileNavOpen(false)} />
            </div>
            <div className="border-t border-flowpm-border p-3">
              <div className="mb-2 rounded-xl bg-flowpm-canvas/80 px-3 py-2">
                <p className="truncate text-sm font-medium text-flowpm-body">{userDisplayName}</p>
                <p className="truncate text-xs text-flowpm-muted">{userEmail}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSignOut();
                  setMobileNavOpen(false);
                }}
                className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-flowpm-muted transition-colors hover:bg-flowpm-canvas hover:text-flowpm-body"
              >
                Sign out
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
