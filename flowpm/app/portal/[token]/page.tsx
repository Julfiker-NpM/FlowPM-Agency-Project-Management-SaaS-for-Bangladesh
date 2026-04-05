import { PortalPublicClient } from "./portal-public-client";

export default function PortalPage({ params }: { params: { token: string } }) {
  const token = typeof params.token === "string" ? params.token : "";
  if (!token) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-flowpm-muted">Invalid link.</div>
    );
  }
  return <PortalPublicClient token={token} />;
}
