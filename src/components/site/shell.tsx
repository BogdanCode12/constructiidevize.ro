import { SiteFooter } from "./footer";
import { SiteHeader } from "./header";

/** Cadrul paginilor publice: antet + conținut pe fundal alb + subsol. */
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
