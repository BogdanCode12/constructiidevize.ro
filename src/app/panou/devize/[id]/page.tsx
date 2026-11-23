import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { loadEstimate } from "@/lib/estimate/repo";
import { EstimateEditor } from "./editor";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata() {
  return { title: "Editor deviz" };
}

export default async function EstimatePage({ params }: Params) {
  const user = await requireUser();
  const id = Number((await params).id);
  const doc = Number.isInteger(id) ? await loadEstimate(id, user.company?.id ?? 0) : null;
  if (!doc) notFound();
  return <EstimateEditor initial={doc} />;
}
