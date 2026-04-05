import { FlowAuthProvider } from "@/context/flowpm-auth-context";
import { ThemeToggle } from "@/components/flowpm/theme-toggle";

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <FlowAuthProvider>
      <div className="relative min-h-screen bg-flowpm-canvas px-4 py-12">
        <div className="absolute right-4 top-4 md:right-8 md:top-8">
          <ThemeToggle />
        </div>
        {children}
      </div>
    </FlowAuthProvider>
  );
}
