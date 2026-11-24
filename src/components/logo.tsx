import Link from "next/link";

/** Sigla DevizConstruct.ro (imagine). `light` = varianta albă, pentru fundaluri închise. */
export function Logo({ href = "/", light = false, className = "h-8" }: { href?: string; light?: boolean; className?: string }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center" aria-label="DevizConstruct.ro — acasă">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={light ? "/brand/devizconstruct-logo-white.png" : "/brand/devizconstruct-logo.png"}
        alt="DevizConstruct.ro"
        width={1029}
        height={180}
        className={`w-auto ${className}`}
      />
    </Link>
  );
}
