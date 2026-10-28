import { AGENCY_SHORT } from "../../lib/constants";

/** 출처 구분 딱지: 테두리만 있는 작은 라벨 (흑백에서도 보이게). 보도자료는 기관 이름으로 */
export function LabelBadge({ label, source }: { label?: string; source?: string }) {
  if (!label) return null;
  const text = label === "보도자료" && source ? (AGENCY_SHORT[source] ?? source) : label;
  return (
    <span className="inline-flex h-[1.15rem] items-center border border-ink px-1.5 align-middle text-[0.7rem] leading-none font-semibold text-ink">
      {text}
    </span>
  );
}
