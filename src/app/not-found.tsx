import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="text-6xl font-bold text-brand-700">404</p>
        <p className="mt-3 text-muted">Pagina nu există.</p>
        <div className="mt-6"><ButtonLink href="/">Acasă</ButtonLink></div>
      </div>
    </div>
  );
}
