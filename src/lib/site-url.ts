/** Adresa publică a site-ului (APP_URL), folosită la canonical, sitemap, Open Graph. */
export const siteUrl = () => (process.env.APP_URL || "https://devizconstruct.ro").replace(/\/$/, "");
