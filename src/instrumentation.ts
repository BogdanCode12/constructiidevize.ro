/** Rulează o dată, la pornirea serverului: aplică migrările SQL noi (după fiecare publicare) și pornește alertele zilnice. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DB_NAME) return;
  try {
    const { runMigrations } = await import("./lib/migrate");
    const applied = await runMigrations();
    if (applied.length) console.log(`[migrari] aplicate: ${applied.join(", ")}`);
  } catch (err) {
    console.error("[migrari] eroare:", err);
  }
  // Alertele zilnice pe e-mail (documente care expiră, termene) rulează din aplicație, nu dintr-un cron extern.
  const { startDailyAlerts } = await import("./lib/alerts");
  startDailyAlerts();
}
