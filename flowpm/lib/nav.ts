import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Clock,
  BarChart3,
  FileText,
  Settings,
} from "lucide-react";

export const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/team", label: "Team", icon: Users },
  { href: "/time", label: "Time", icon: Clock },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function titleForPath(pathname: string): string {
  if (pathname.startsWith("/projects/") && pathname !== "/projects")
    return "Project";
  const map: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/projects": "Projects",
    "/team": "Team",
    "/time": "Time & billing",
    "/reports": "Reports",
    "/invoices": "Invoices",
    "/settings": "Settings",
  };
  return map[pathname] ?? "FlowPM";
}
