import { Notice } from "../components/atoms/Notice";
import { FilterTabs } from "../components/molecules/FilterTabs";
import { Pagination } from "../components/molecules/Pagination";
import { StoryListItem } from "../components/molecules/StoryListItem";
import { PAGE_SIZE } from "../lib/constants";
import { href } from "../lib/route";
import type { NewsItem } from "../types/news";

export function SectionPage({
  section,
  page,
  label,
  items,
}: {
  section: string;
  page: number;
  label?: string;
  items: NewsItem[];
}) {
  // 섹션에 라벨 붙은 글(보도자료 등)이 있으면 필터 탭을 보여줌
  const labels = [...new Set(items.map((n) => n.label).filter((l): l is string => !!l))];
  const active = label && labels.includes(label) ? label : undefined;
  const shown = active ? items.filter((n) => n.label === active) : items;

  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <main className="mx-auto max-w-190">
      <h2 className="mt-8 font-serif text-4xl font-bold">{section}</h2>
      <p className="mt-1 text-sm text-muted">
        {shown.length} {shown.length === 1 ? "story" : "stories"} from the past {active ? "week" : "three days"}
      </p>

      {labels.length > 0 && (
        <FilterTabs
          options={[
            { key: "all", name: "All", count: items.length, href: href.section(section), active: !active },
            ...labels.map((l) => ({
              key: l,
              name: l,
              count: items.filter((n) => n.label === l).length,
              href: href.section(section, 1, l),
              active: active === l,
            })),
          ]}
        />
      )}

      {shown.length === 0 && <Notice>No stories in this section yet.</Notice>}

      <ul className={`${labels.length > 0 ? "mt-0" : "mt-6"} border-t border-ink`}>
        {visible.map((n) => (
          <StoryListItem key={n.id} item={n} />
        ))}
      </ul>

      <Pagination current={current} total={totalPages} hrefFor={(p) => href.section(section, p, active)} />
    </main>
  );
}
