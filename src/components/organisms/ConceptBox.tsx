import type { Concept, NewsItem } from "../../types/news";
import { Label } from "../atoms/Label";
import { EssayPoint } from "../molecules/EssayPoint";
import { HeadlineList } from "../molecules/HeadlineList";

// 신문의 "오늘의 용어" 박스: 굵은 괘선 + 큰 제목, 색 없이 타이포로만
export function ConceptBox({
  concept,
  items,
}: {
  concept: Concept;
  items: NewsItem[];
}) {
  const related = concept.relatedIds
    .map((id) => items.find((n) => n.id === id))
    .filter((n): n is NewsItem => !!n);

  return (
    <section
      aria-labelledby="concept-term"
      className="mt-8 border-y-4 border-double border-ink py-6"
    >
      <div className="grid gap-8 md:grid-cols-[1fr_2fr] md:gap-10">
        <div>
          <p className="font-sans text-sm font-semibold">오늘의 개념</p>
          <h2
            id="concept-term"
            className="mt-2 font-serif text-[clamp(1.6rem,3vw,2.2rem)] leading-tight font-bold"
          >
            {concept.term}
          </h2>
          <p className="mt-4 font-serif leading-[1.8] text-ink-soft">
            {concept.definition}
          </p>
        </div>

        <div className="md:border-l md:border-rule md:pl-10">
          {concept.issues.length > 0 && (
            <>
              <Label>쟁점</Label>
              <ul className="mt-2 space-y-2">
                {concept.issues.map((issue) => (
                  <li
                    key={issue}
                    className="flex gap-3 font-serif leading-[1.75]"
                  >
                    <span
                      aria-hidden
                      className="mt-[0.7em] h-px w-3 shrink-0 bg-ink"
                    />
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {concept.essayAngle && (
            <EssayPoint text={concept.essayAngle} className="mt-8" />
          )}

          {related.length > 0 && (
            <>
              <Label className="mt-6">관련 기사</Label>
              <HeadlineList
                items={related}
                className="mt-1"
                linkClassName="py-2.5"
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
