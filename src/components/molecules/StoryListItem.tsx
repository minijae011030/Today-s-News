import { timeAgo, titleOf } from "../../lib/format";
import { href } from "../../lib/route";
import type { NewsItem } from "../../types/news";
import { LabelBadge } from "../atoms/LabelBadge";
import { StoryImage } from "../atoms/StoryImage";

/** 섹션 페이지의 기사 한 줄: 시간 | 제목 + 요약 + 출처 */
export function StoryListItem({ item }: { item: NewsItem }) {
  return (
    <li className="border-b border-rule py-6">
      <a
        href={href.article(item.id)}
        className={`group grid gap-1 sm:gap-6 ${item.image ? "sm:grid-cols-[7rem_1fr_9rem]" : "sm:grid-cols-[7rem_1fr]"}`}
      >
        <span className="flex items-center gap-2 text-xs text-muted sm:block sm:pt-1.5">
          {timeAgo(item.publishedAt)}
          {item.label && (
            <span className="flex sm:mt-2">
              <LabelBadge label={item.label} source={item.source} />
            </span>
          )}
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
          <span className="mt-2 block text-xs text-muted">
            {item.source}
            {(item.coverage ?? 1) > 1 && <> · 외 {item.coverage! - 1}개 매체 보도</>}
          </span>
        </span>
        <StoryImage src={item.image} ratio="aspect-[4/3]" className="hidden sm:block" />
      </a>
    </li>
  );
}
