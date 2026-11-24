import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { loadEstimate } from "@/lib/estimate/repo";
import { EstimateEditor } from "./editor";
import { estimateDefaults, todayRo } from "@/lib/rules";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata() {
  return { title: "Editor deviz" };
}

export default async function EstimatePage({ params }: Params) {
  const user = await requireUser();
  const id = Number((await params).id);
  const doc = Number.isInteger(id) ? await loadEstimate(id, user.company?.id ?? 0) : null;
  if (!doc) notFound();
  // Regulile (TVA, CAM) valabile la data devizului, pentru verificări.
  const d = await estimateDefaults(doc.rulesDate ?? todayRo());
  return <EstimateEditor initial={doc} isAdmin={user.role === "admin"} rules={{ vatPct: d.vatPct, camPct: d.camPct }} />;
}
