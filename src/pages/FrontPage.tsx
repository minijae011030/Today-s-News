import { ConceptBox } from "../components/organisms/ConceptBox";
import { LeadStory } from "../components/organisms/LeadStory";
import { SectionColumns } from "../components/organisms/SectionColumns";
import type { Concept, NewsItem } from "../types/news";

export function FrontPage({
  items,
  concept,
}: {
  items: NewsItem[];
  concept: Concept | null;
}) {
  const lead = items.find((n) => n.summary) ?? items[0];
  const side = items.filter((n) => n.id !== lead.id).slice(0, 5);

  return (
    <main>
      <LeadStory lead={lead} side={side} />
      {concept && <ConceptBox concept={concept} items={items} />}
      <SectionColumns items={items} />
    </main>
  );
}
