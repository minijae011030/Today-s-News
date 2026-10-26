import type { ReactNode } from "react";

/** 블록 위에 붙는 작은 제목 (예: 쟁점, 원문 발췌) */
export function Label({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3 className={`font-sans text-sm font-semibold ${className}`}>
      {children}
    </h3>
  );
}
