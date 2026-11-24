/*
 * Ilustrația din panou: blocul din imaginea aleasă de proprietar se „construiește” o singură dată, la încărcare:
 * 1) se vede conturul șters (schița), 2) structura gri se ridică de jos în sus, 3) apar finisajele în culori.
 * Cu „reduce motion” se afișează direct imaginea finală.
 */
const SRC = "/brand/bloc-santier.webp";

export function BuildingAnim({ className = "" }: { className?: string }) {
  return (
    <div
      className={`building-anim pointer-events-none relative aspect-[1100/728] select-none ${className}`}
      role="img"
      aria-label="Bloc în construcție: structura de beton, fierul, schela și materialele de pe șantier"
    >
      <img src={SRC} alt="" draggable={false} className="b-ghost absolute inset-0 h-full w-full" />
      <img src={SRC} alt="" draggable={false} className="b-structure absolute inset-0 h-full w-full" />
      <img src={SRC} alt="" draggable={false} className="b-finish absolute inset-0 h-full w-full" />
      <span className="b-scan absolute inset-x-[6%] h-px bg-brand-700/70" />
    </div>
  );
}
