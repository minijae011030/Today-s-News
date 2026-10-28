/** 섹션 안 필터: 신문 목차처럼 밑줄로 현재 항목 표시 */
export function FilterTabs({
  options,
}: {
  options: { key: string; name: string; count: number; href: string; active: boolean }[];
}) {
  return (
    <nav aria-label="Filter" className="mt-5 flex gap-5 text-sm">
      {options.map((o) => (
        <a
          key={o.key}
          href={o.href}
          aria-current={o.active ? "true" : undefined}
          className={`border-b-2 pb-2 ${
            o.active ? "border-ink font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          {o.name} <span className="tabular-nums">{o.count}</span>
        </a>
      ))}
    </nav>
  );
}
