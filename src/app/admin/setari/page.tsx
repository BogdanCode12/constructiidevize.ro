import { ActionForm } from "@/components/action-form";
import { Card, Field, PageHeader } from "@/components/ui";
import { getSettings, SETTING_LABELS, type Settings } from "@/lib/settings";
import { updateSettingsAction } from "../actions";

export const metadata = { title: "Setări · Admin" };

export default async function AdminSettingsPage() {
  const settings = await getSettings();
  return (
    <>
      <PageHeader title="Setări" subtitle="Valorile implicite ale platformei. Devizele existente își păstrează procentele." />
      <Card className="max-w-xl">
        <ActionForm action={updateSettingsAction} submitLabel="Salvează setările">
          {(Object.keys(SETTING_LABELS) as (keyof Settings)[]).map((k) => (
            <Field key={k} label={SETTING_LABELS[k]} name={k} defaultValue={String(settings[k])} />
          ))}
        </ActionForm>
      </Card>
    </>
  );
}
