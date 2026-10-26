import { ConceptBox } from "../components/organisms/ConceptBox";
import { LeadStory } from "../components/organisms/LeadStory";
import { SectionColumns } from "../components/organisms/SectionColumns";
import { SpaceFeature } from "../components/organisms/SpaceFeature";
import type { Concept, NewsItem, SpacePhoto } from "../types/news";

// 1면 톱 (우주 사진이 없을 때만): 공부용 섹션의 사진 있는 최신 기사 → 요약 있는 최신 기사
const LEAD_SECTIONS = ["경제", "국제", "사회", "IT"];
function pickLead(items: NewsItem[]): NewsItem {
  const study = items.filter((n) => LEAD_SECTIONS.includes(n.category) && n.summary);
  return study.find((n) => n.image) ?? study[0] ?? items.find((n) => n.summary) ?? items[0];
}

// 오른쪽 주요 기사: 한 섹션이 도배하지 않게 섹션별 최신 1건씩, 공부용 섹션 먼저
const SIDE_ORDER = ["경제", "국제", "사회", "IT", "예술", "책", "엔터", "우주"];
function pickSide(items: NewsItem[], lead: NewsItem | null): NewsItem[] {
  const out: NewsItem[] = [];
  for (const section of SIDE_ORDER) {
    const n = items.find((x) => x.category === section && x.id !== lead?.id && x.summary);
    if (n) out.push(n);
    if (out.length === 5) break;
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
  const side = pickSide(items, space ? null : lead);

  return (
    <main>
      <LeadStory lead={lead} side={side} feature={space ? <SpaceFeature photo={space} /> : undefined} />
      {concept && <ConceptBox concept={concept} items={items} />}
      <SectionColumns items={items} />
    </main>
  );
}
