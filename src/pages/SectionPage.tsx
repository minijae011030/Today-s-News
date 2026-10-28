import { Notice } from "../components/atoms/Notice";
import { FilterTabs } from "../components/molecules/FilterTabs";
import { Pagination } from "../components/molecules/Pagination";
import { StoryListItem } from "../components/molecules/StoryListItem";
import { SpaceFeature } from "../components/organisms/SpaceFeature";
import { AGENCY_SHORT, PAGE_SIZE, PRESS } from "../lib/constants";
import { href } from "../lib/route";
import type { NewsItem, SpacePhoto } from "../types/news";

export function SectionPage({
  section,
  page,
  filter,
  items,
  space = null,
}: {
  section: string;
  page: number;
  filter?: string;
  items: NewsItem[];
  space?: SpacePhoto | null; // 과학 섹션 맨 위: NASA 오늘의 우주 사진·영상
}) {
  // 보도자료 탭은 기관별, 다른 탭은 라벨 붙은 글이 있을 때만 라벨별로 거르는 탭을 보여줌
  const isPress = section === PRESS;
  const groupOf = (n: NewsItem) => (isPress ? n.source : n.label);
  const groups = [...new Set(items.map(groupOf).filter((g): g is string => !!g))];
  const active = filter && groups.includes(filter) ? filter : undefined;
  const shown = active ? items.filter((n) => groupOf(n) === active) : items;

  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const showTabs = groups.length > 0;

  return (
    <main className="mx-auto max-w-190">
      <h2 className="mt-8 font-serif text-4xl font-bold">{section}</h2>
      <p className="mt-1 text-sm text-muted">
        {shown.length} {shown.length === 1 ? (isPress ? "release" : "story") : isPress ? "releases" : "stories"} from the
        past {isPress ? "two weeks" : "three days"}
      </p>

      {/* 과학 섹션 첫 페이지 맨 위에만 */}
      {space && current === 1 && !active && (
        <div className="mt-6 border-t-2 border-ink pt-5">
          <SpaceFeature photo={space} />
        </div>
      )}

      {showTabs && (
        <FilterTabs
          options={[
            { key: "all", name: "All", count: items.length, href: href.section(section), active: !active },
            ...groups.map((g) => ({
              key: g,
              name: AGENCY_SHORT[g] ?? g,
              count: items.filter((n) => groupOf(n) === g).length,
              href: href.section(section, 1, g),
              active: active === g,
            })),
          ]}
        />
      )}

      {shown.length === 0 && <Notice>No stories in this section yet.</Notice>}

      <ul className={`${showTabs ? "mt-0" : "mt-6"} border-t border-ink`}>
        {visible.map((n) => (
          <StoryListItem key={n.id} item={n} />
        ))}
      </ul>

      <Pagination current={current} total={totalPages} hrefFor={(p) => href.section(section, p, active)} />
    </main>
  );
}
