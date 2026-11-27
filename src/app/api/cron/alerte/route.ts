import { runAlerts } from "@/lib/alerts";

export const dynamic = "force-dynamic";

/**
 * Rulare manuală a alertelor (rulează oricum zilnic din aplicație, după ora 8):
 *   curl -s "https://devizconstruct.ro/api/cron/alerte?key=CRON_SECRET"
 */
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) return new Response("Interzis", { status: 403 });
  return Response.json({ ok: true, ...(await runAlerts()) });
}
