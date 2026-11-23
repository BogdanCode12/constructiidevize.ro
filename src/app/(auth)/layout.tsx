import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10">
      <Logo />
      <div className="mt-8 w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">{children}</div>
    </div>
  );
}
