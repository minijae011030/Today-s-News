import { titleOf } from "../../lib/format";
import { href } from "../../lib/route";
import type { NewsItem } from "../../types/news";

/** 기사 제목 링크 (목록마다 크기만 다르게) */
export function HeadlineLink({
  item,
  className = "",
}: {
  item: NewsItem;
  className?: string;
}) {
  return (
    <a
      href={href.article(item.id)}
      className={`block font-serif leading-snug hover:text-ink-soft ${className}`}
    >
      {titleOf(item)}
    </a>
  );
}
