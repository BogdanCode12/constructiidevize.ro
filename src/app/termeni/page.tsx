import { ContentPageView } from "@/components/content-page";
import { getPage } from "@/lib/pages";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await getPage("termeni"))?.title ?? "Pagină" };
}

export default function Page() {
  return <ContentPageView slug="termeni" />;
}
