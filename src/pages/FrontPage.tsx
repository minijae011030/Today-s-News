import { ConceptBox } from "../components/organisms/ConceptBox";
import { LeadStory } from "../components/organisms/LeadStory";
import { SectionColumns } from "../components/organisms/SectionColumns";
import { SpaceFeature } from "../components/organisms/SpaceFeature";
import type { Concept, NewsItem, SpacePhoto } from "../types/news";

// 1면 톱 (우주 사진이 없을 때만): 공부용 섹션의 사진 있는 최신 기사 → 요약 있는 최신 기사
const LEAD_SECTIONS = ["경제", "정치", "IT"];
function pickLead(items: NewsItem[]): NewsItem {
  const study = items.filter((n) => LEAD_SECTIONS.includes(n.category) && n.summary);
  return study.find((n) => n.image) ?? study[0] ?? items.find((n) => n.summary) ?? items[0];
}

// 오른쪽 주요 기사: 한 섹션이 도배하지 않게 섹션별 최신 1건씩, 공부용 섹션 먼저
const SIDE_ORDER = ["경제", "정치", "IT", "과학", "문화"];
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
  space,
}: {
  items: NewsItem[];
  concept: Concept | null;
  space: SpacePhoto | null;
}) {
  const lead = pickLead(items);
  // 우주 사진이 톱이면 오른쪽 목록에 톱기사 자리가 비니까 lead도 목록 후보에 넣음
  // 우주 사진이 크니까 옆 목록도 길게 채움
  const side = pickSide(items, space ? null : lead, space ? 8 : 5);

  return (
    <main>
      <LeadStory lead={lead} side={side} feature={space ? <SpaceFeature photo={space} /> : undefined} />
      {concept && <ConceptBox concept={concept} items={items} />}
      <SectionColumns items={items} />
    </main>
  );
}
