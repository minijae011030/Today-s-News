import type { NewsItem } from "../../types/news";
import { HeadlineLink } from "../atoms/HeadlineLink";

/** 가는 괘선으로 나눈 제목 목록 (섹션 칼럼, 관련 기사 등) */
export function HeadlineList({
  items,
  linkClassName = "py-3",
  className = "",
}: {
  items: NewsItem[];
  linkClassName?: string;
  className?: string;
}) {
  return (
    <ul className={className}>
      {items.map((n, i) => (
        <li key={n.id} className={i > 0 ? "border-t border-rule" : ""}>
          <HeadlineLink item={n} className={linkClassName} />
        </li>
      ))}
    </ul>
  );
}
