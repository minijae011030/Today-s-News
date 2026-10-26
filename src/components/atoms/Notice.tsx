import type { ReactNode } from "react";

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="mx-auto mt-16 max-w-[60ch] text-center text-ink-soft">
      {children}
    </p>
  );
}
