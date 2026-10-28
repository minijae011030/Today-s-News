import { ConceptBox } from "../components/organisms/ConceptBox";
import { LeadStory } from "../components/organisms/LeadStory";
import { SectionColumns } from "../components/organisms/SectionColumns";
import type { Concept, NewsItem } from "../types/news";

// 많이 보도된 소식 먼저: 최근 하루 안의 기사는 다룬 매체 수 순, 같으면 최신순 (그 외엔 원래 순서)
const DAY = 24 * 3600_000;
function byImportance(items: NewsItem[]): NewsItem[] {
  const now = Date.now();
  const recent = (n: NewsItem) => now - Date.parse(n.publishedAt) < DAY;
  return [...items].sort(
    (a, b) =>
      Number(recent(b)) - Number(recent(a)) ||
      (recent(a) ? (b.coverage ?? 1) - (a.coverage ?? 1) : 0) ||
      b.publishedAt.localeCompare(a.publishedAt),
  );
}

// 1면 톱: 공부용 섹션에서 많이 보도된 사진 있는 기사 → 요약 있는 기사
const LEAD_SECTIONS = ["경제", "정치", "IT"];
function pickLead(items: NewsItem[]): NewsItem {
  const study = byImportance(items.filter((n) => LEAD_SECTIONS.includes(n.category) && n.summary));
  return study.find((n) => n.image) ?? study[0] ?? items.find((n) => n.summary) ?? items[0];
}

// 오른쪽 주요 기사: 한 섹션이 도배하지 않게 섹션별 1건씩(많이 보도된 소식 먼저), 공부용 섹션 먼저
const SIDE_ORDER = ["보도자료", "경제", "정치", "IT", "과학", "문화"];
function pickSide(items: NewsItem[], lead: NewsItem | null, count: number): NewsItem[] {
  const out: NewsItem[] = [];
  // 섹션별 1건씩 돌고, 자리가 남으면 섹션별 2번째 기사로 한 바퀴 더
  for (let round = 0; round < 3 && out.length < count; round++) {
    for (const section of SIDE_ORDER) {
      const n = items.filter((x) => x.category === section && x.id !== lead?.id && x.summary)[round];
      if (n) out.push(n);
      if (out.length === count) break;
    }
  }
  return out;
}

export function FrontPage({
  items,
  concept,
}: {
  items: NewsItem[];
  concept: Concept | null;
}) {
  const ranked = byImportance(items);
  const lead = pickLead(items);
  const side = pickSide(ranked, lead, 5);

  return (
    <main>
      <LeadStory lead={lead} side={side} />
      {concept && <ConceptBox concept={concept} items={items} />}
      <SectionColumns items={items} />
    </main>
  );
}
