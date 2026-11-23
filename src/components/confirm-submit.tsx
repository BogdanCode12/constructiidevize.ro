"use client";

/** Buton de submit care cere confirmare înainte (ex: ștergeri). */
export function ConfirmSubmit({ message, children, className = "text-red-700 hover:underline" }: {
  message: string; children: React.ReactNode; className?: string;
}) {
  return (
    <button className={className} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
