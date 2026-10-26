import type { ReactNode } from "react";

/** 푸터 "이번 호"의 한 줄 (이름 ··· 값) */
export function StatRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt>
      <dd className="tabular-nums text-ink">{children}</dd>
    </div>
  );
}
