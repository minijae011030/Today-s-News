import { timeAgo, titleOf } from "../../lib/format";
import { href } from "../../lib/route";
import type { NewsItem } from "../../types/news";

/** 섹션 페이지의 기사 한 줄: 시간 | 제목 + 요약 + 출처 */
export function StoryListItem({ item }: { item: NewsItem }) {
  return (
    <li className="border-b border-rule py-6">
      <a
        href={href.article(item.id)}
        className="group grid gap-1 sm:grid-cols-[7rem_1fr] sm:gap-6"
      >
        <span className="text-xs text-muted sm:pt-1.5">
          {timeAgo(item.publishedAt)}
        </span>
        <span>
          <span className="block font-serif text-xl leading-snug font-bold group-hover:text-ink-soft">
            {titleOf(item)}
          </span>
          {item.summary && (
            <span className="mt-2 block font-serif leading-[1.75] text-ink-soft">
              {item.summary}
            </span>
          )}
          <span className="mt-2 block text-xs text-muted">{item.source}</span>
        </span>
      </a>
    </li>
  );
}
