import { timeAgo } from "../../lib/format";
import { LabelBadge } from "../atoms/LabelBadge";

/** 제목 위 한 줄: 섹션 + 몇 분 전 */
export function Kicker({
  category,
  publishedAt,
  label,
}: {
  category: string;
  publishedAt: string;
  label?: string;
}) {
  return (
    <p className="flex items-center gap-3 text-xs">
      <span className="font-semibold">{category}</span>
      <LabelBadge label={label} />
      <span className="text-muted">{timeAgo(publishedAt)}</span>
    </p>
  );
}
