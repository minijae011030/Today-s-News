/** "보도자료" 같은 출처 구분 라벨: 테두리만 있는 작은 딱지 (흑백에서도 보이게) */
export function LabelBadge({ label }: { label?: string }) {
  if (!label) return null;
  return (
    <span className="border border-ink px-1.5 py-px text-[0.7rem] leading-none font-semibold">{label}</span>
  );
}
