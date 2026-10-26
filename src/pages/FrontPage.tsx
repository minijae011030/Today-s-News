import { ConceptBox } from "../components/organisms/ConceptBox";
import { LeadStory } from "../components/organisms/LeadStory";
import { SectionColumns } from "../components/organisms/SectionColumns";
import type { Concept, NewsItem } from "../types/news";

// 1면 톱: 사진 있는 우주 기사 우선 → 요약 있는 우주 기사 → (우주가 없으면) 사진 있는 최신 기사 → 최신 기사
function pickLead(items: NewsItem[]): NewsItem {
  const space = items.filter((n) => n.category === "우주" && n.summary);
  return (
    space.find((n) => n.image) ??
    space[0] ??
    items.find((n) => n.summary && n.image) ??
    items.find((n) => n.summary) ??
    items[0]
  );
}

// 오른쪽 주요 기사: 한 섹션이 도배하지 않게 섹션별 최신 1건씩, 공부용 섹션 먼저
const SIDE_ORDER = ["경제", "국제", "사회", "IT", "예술", "책", "엔터", "우주"];
function pickSide(items: NewsItem[], lead: NewsItem): NewsItem[] {
  const out: NewsItem[] = [];
  for (const section of SIDE_ORDER) {
    const n = items.find((x) => x.category === section && x.id !== lead.id && x.summary);
    if (n) out.push(n);
    if (out.length === 5) break;
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
  const lead = pickLead(items);
  const side = pickSide(items, lead);

  return (
    <main>
      <LeadStory lead={lead} side={side} />
      {concept && <ConceptBox concept={concept} items={items} />}
      <SectionColumns items={items} />
    </main>
  );
}
