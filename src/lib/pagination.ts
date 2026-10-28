// 1 … 4 5 6 … 12 처럼 현재 페이지 주변만 보여줌 (siblings: 현재 페이지 양옆에 몇 개씩)
export function pageList(current: number, total: number, siblings = 1): (number | "gap")[] {
  const pages = new Set([1, total]);
  for (let p = current - siblings; p <= current + siblings; p++) pages.add(p);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}
