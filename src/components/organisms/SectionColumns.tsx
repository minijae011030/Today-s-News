import { SECTIONS } from "../../lib/constants";
import { href } from "../../lib/route";
import type { NewsItem } from "../../types/news";
import { HeadlineList } from "../molecules/HeadlineList";

/** 1면 하단: 섹션별 최신 5개 칼럼 */
export function SectionColumns({ items }: { items: NewsItem[] }) {
  return (
    <div className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
      {SECTIONS.map((s) => {
        const list = items.filter((n) => n.category === s).slice(0, 5);
        if (list.length === 0) return null;
        return (
          <section key={s} className="border-t-2 border-ink pt-3 mt-8">
            <a
              href={href.section(s)}
              className="font-serif text-xl font-bold hover:text-ink-soft"
            >
              {s}
            </a>
            <HeadlineList
              items={list}
              className="mt-2"
              linkClassName="py-3 text-[0.97rem]"
            />
          </section>
        );
      })}
    </div>
  );
}
