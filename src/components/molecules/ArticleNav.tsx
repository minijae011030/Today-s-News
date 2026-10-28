import { titleOf } from "../../lib/format";
import { href } from "../../lib/route";
import type { NewsItem } from "../../types/news";

/** 기사 끝 이전글/다음글: 같은 섹션 안에서 ← 이전(더 오래된) 글 | 다음(더 최근) 글 → */
export function ArticleNav({ prev, next }: { prev?: NewsItem; next?: NewsItem }) {
  if (!prev && !next) return null;
  return (
    <nav aria-label="Previous and next stories" className="mt-12 grid grid-cols-2 border-y border-ink">
      <NavCell item={prev} dir="prev" />
      <NavCell item={next} dir="next" />
    </nav>
  );
}

function NavCell({ item, dir }: { item?: NewsItem; dir: "prev" | "next" }) {
  const isNext = dir === "next";
  const side = isNext ? "border-l border-rule pl-4 text-right sm:pl-6" : "pr-4 sm:pr-6";
  if (!item) return <div className={side} aria-hidden />;
  return (
    <a
      href={href.article(item.id)}
      rel={dir}
      className={`group flex flex-col gap-1.5 py-5 ${side}`}
    >
      <span className="text-xs font-semibold tracking-wider text-muted uppercase">
        {isNext ? (
          <>
            Next <span aria-hidden className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
          </>
        ) : (
          <>
            <span aria-hidden className="inline-block transition-transform group-hover:-translate-x-0.5">←</span> Previous
          </>
        )}
      </span>
      <span className="line-clamp-3 font-serif text-[0.97rem] leading-snug font-bold group-hover:text-ink-soft sm:text-lg">
        {titleOf(item)}
      </span>
    </a>
  );
}
