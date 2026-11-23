import { SiteShell } from "@/components/site/shell";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteShell>
      <div className="relative flex min-h-[70vh] items-start justify-center overflow-hidden bg-canvas px-4 py-14">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#0c0c0d0a_1px,transparent_1px),linear-gradient(to_bottom,#0c0c0d0a_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="relative w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-[0_30px_80px_-50px_rgba(0,0,0,.4)] sm:p-8">{children}</div>
      </div>
    </SiteShell>
  );
}
