import { timeAgo } from "../../lib/format";

/** 제목 위 한 줄: 섹션 + 몇 분 전 */
export function Kicker({
  category,
  publishedAt,
}: {
  category: string;
  publishedAt: string;
}) {
  return (
    <p className="flex gap-3 text-xs">
      <span className="font-semibold">{category}</span>
      <span className="text-muted">{timeAgo(publishedAt)}</span>
    </p>
  );
}
