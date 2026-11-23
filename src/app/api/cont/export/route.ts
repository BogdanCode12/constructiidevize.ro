import { getCurrentUser } from "@/lib/auth/session";
import { query, queryOne } from "@/lib/db";
import { loadEstimate } from "@/lib/estimate/repo";

export const dynamic = "force-dynamic";

/** Exportul datelor utilizatorului (portabilitate, GDPR): JSON cu contul și firmele lui. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Neautorizat", { status: 401 });
  const account = await queryOne("SELECT id, email, name, role, email_verified_at, last_login_at, created_at FROM users WHERE id = ?", [user.id]);
  const memberships = await query<{ company_id: number; role: string }>("SELECT company_id, role FROM company_members WHERE user_id = ?", [user.id]);
  const companies = [];
  for (const m of memberships) {
    const id = m.company_id;
    const projects = await query<{ id: number }>("SELECT * FROM projects WHERE company_id = ?", [id]);
    const estimateIds = await query<{ id: number }>("SELECT id FROM estimates WHERE company_id = ?", [id]);
    companies.push({
      role: m.role,
      company: await queryOne("SELECT * FROM companies WHERE id = ?", [id]),
      subscription: await queryOne("SELECT plan, status, billing_interval, trial_ends_at, current_period_end FROM subscriptions WHERE company_id = ?", [id]),
      projects,
      deadlines: await query("SELECT d.* FROM project_deadlines d JOIN projects p ON p.id = d.project_id WHERE p.company_id = ?", [id]),
      estimates: await Promise.all(estimateIds.map((e) => loadEstimate(e.id, id))),
      resources: await query("SELECT type, code, name, unit, price, notes FROM resources WHERE company_id = ?", [id]),
      recipes: await query("SELECT id, code, name, unit, source, uses FROM recipes WHERE company_id = ?", [id]),
      documents: await query("SELECT category, title, issuer, doc_number, issued_at, expires_at, notes, file_name FROM company_documents WHERE company_id = ?", [id]),
      projectFiles: await query("SELECT project_id, label, file_name, file_size, created_at FROM project_files WHERE company_id = ?", [id]),
      situations: await query("SELECT * FROM work_situations WHERE company_id = ?", [id]),
      transactions: await query("SELECT * FROM project_transactions WHERE company_id = ?", [id]),
      subcontractors: await query("SELECT * FROM subcontractors WHERE company_id = ?", [id]),
      journal: await query("SELECT * FROM site_journal WHERE company_id = ?", [id]),
      aiAnalyses: await query("SELECT project_id, task_name, status, output, created_at FROM ai_jobs WHERE company_id = ?", [id]),
      aiChat: await query("SELECT project_id, role, content, created_at FROM ai_chat_messages WHERE company_id = ?", [id]),
    });
  }
  const activity = await query("SELECT action, details, ip, created_at FROM activity_log WHERE user_id = ? ORDER BY id DESC LIMIT 5000", [user.id]);
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), account, companies, activity }, null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="datele-mele-constructiidevize.json"`,
      "Cache-Control": "no-store",
    },
  });
}
