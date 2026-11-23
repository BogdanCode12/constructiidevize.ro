import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { requireUser } from "@/lib/auth/session";
import { loadSituation } from "@/lib/site/situations";
import { deleteSituationAction } from "../../actions";
import { SituationEditor } from "./editor";

export const metadata = { title: "Situație de lucrări" };

export default async function SituationPage({ params }: { params: Promise<{ id: string; sid: string }> }) {
  const user = await requireUser();
  const { id, sid } = await params;
  const s = await loadSituation(Number(sid), user.company?.id ?? 0);
  if (!s || s.projectId !== Number(id)) notFound();
  return (
    <>
      <Link href={`/panou/proiecte/${id}/santier`} className="text-sm text-muted hover:text-ink">← Șantier · {s.projectName}</Link>
      <div className="mt-1 mb-5 flex items-end justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">Situația de lucrări nr. {s.number}</h1>
        <form action={deleteSituationAction}>
          <input type="hidden" name="project_id" value={id} />
          <input type="hidden" name="id" value={s.id} />
          <ConfirmSubmit message="Ștergi situația? Cantitățile ei nu vor mai apărea la situațiile următoare.">Șterge</ConfirmSubmit>
        </form>
      </div>
      <SituationEditor s={s} />
    </>
  );
}
