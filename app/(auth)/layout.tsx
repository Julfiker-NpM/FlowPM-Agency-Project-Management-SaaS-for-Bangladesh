import { ThemeToggle } from "@/components/flowpm/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-flowpm-canvas px-4 py-12">
      <div className="absolute right-4 top-4 md:right-8 md:top-8">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
