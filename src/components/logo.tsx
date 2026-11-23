import Link from "next/link";

/** Sigla DevizBuild.ro (imagine). `light` = varianta albă, pentru fundaluri închise. */
export function Logo({ href = "/", light = false, className = "h-8" }: { href?: string; light?: boolean; className?: string }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center" aria-label="DevizBuild.ro — acasă">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={light ? "/brand/devizbuild-logo-white.png" : "/brand/devizbuild-logo.png"}
        alt="DevizBuild.ro"
        width={800}
        height={127}
        className={`w-auto ${className}`}
      />
    </Link>
  );
}
