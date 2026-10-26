import { Notice } from "../components/atoms/Notice";
import { Pagination } from "../components/molecules/Pagination";
import { StoryListItem } from "../components/molecules/StoryListItem";
import { PAGE_SIZE } from "../lib/constants";
import { href } from "../lib/route";
import type { NewsItem } from "../types/news";

export function SectionPage({
  section,
  page,
  items,
}: {
  section: string;
  page: number;
  items: NewsItem[];
}) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = items.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <main className="mx-auto max-w-190">
      <h2 className="mt-8 font-serif text-4xl font-bold">{section}</h2>
      <p className="mt-1 text-sm text-muted">최근 3일, {items.length}건</p>

      {items.length === 0 && <Notice>이 섹션에는 아직 기사가 없어요.</Notice>}

      <ul className="mt-6 border-t border-ink">
        {visible.map((n) => (
          <StoryListItem key={n.id} item={n} />
        ))}
      </ul>

      <Pagination
        current={current}
        total={totalPages}
        hrefFor={(p) => href.section(section, p)}
      />
    </main>
  );
}
