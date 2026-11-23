import { getCurrentUser } from "@/lib/auth/session";
import { HeaderNav } from "./header-nav";

/** Antetul site-ului public. Știe dacă vizitatorul e autentificat, ca să arate „Contul meu”. */
export async function SiteHeader() {
  const user = await getCurrentUser();
  return <HeaderNav user={user ? { name: user.name } : null} />;
}
