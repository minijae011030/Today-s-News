import { AGENCY_SHORT } from "./constants";
import type { NewsItem } from "../types/news";

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * 띄어쓴 단어가 모두 들어간 기사만 (제목·요약·태그·출처·주요 내용 등에서)
 * 제목에 걸린 기사를 먼저, 그다음은 최신순
 */
export function searchItems(items: NewsItem[], query: string): NewsItem[] {
  const terms = norm(query).split(" ").filter(Boolean);
  if (terms.length === 0) return [];
  const scored: { n: NewsItem; inTitle: number }[] = [];
  for (const n of items) {
    const title = norm(`${n.title} ${n.titleKo ?? ""}`);
    const body = norm(
      [
        n.summary,
        n.snippet,
        n.essayPoint,
        n.spaceFact,
        n.source,
        AGENCY_SHORT[n.source],
        n.category,
        n.label,
        ...(n.tags ?? []),
        ...(n.keyPoints ?? []),
      ]
        .filter(Boolean)
        .join(" "),
    );
    if (!terms.every((t) => title.includes(t) || body.includes(t))) continue;
    scored.push({ n, inTitle: terms.filter((t) => title.includes(t)).length });
  }
  return scored
    .sort((a, b) => b.inTitle - a.inTitle || b.n.publishedAt.localeCompare(a.n.publishedAt))
    .map((s) => s.n);
}
