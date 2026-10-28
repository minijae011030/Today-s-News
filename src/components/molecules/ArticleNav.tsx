import { titleOf } from "../../lib/format";
import { href } from "../../lib/route";
import type { NewsItem } from "../../types/news";

/** 기사 끝 이전글/다음글: 두 줄로 위는 ← 이전(더 오래된) 글 왼쪽 정렬, 아래는 다음(더 최근) 글 → 오른쪽 정렬 */
export function ArticleNav({ prev, next }: { prev?: NewsItem; next?: NewsItem }) {
  if (!prev && !next) return null;
  return (
    <nav aria-label="Previous and next stories" className="mt-12 border-y border-ink">
      <NavCell item={prev} dir="prev" />
      <NavCell item={next} dir="next" divider={!!prev} />
    </nav>
  );
}

function NavCell({ item, dir, divider = false }: { item?: NewsItem; dir: "prev" | "next"; divider?: boolean }) {
  const isNext = dir === "next";
  // 다음 글은 오른쪽 정렬, 이전 글과 같이 있으면 사이에 얇은 선
  const side = `${isNext ? "items-end text-right" : "items-start"} ${divider ? "border-t border-rule" : ""}`;
  if (!item) return null;
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
      <span className="line-clamp-2 font-serif text-[0.97rem] leading-snug font-bold group-hover:text-ink-soft sm:text-lg">
        {titleOf(item)}
      </span>
    </a>
  );
}
