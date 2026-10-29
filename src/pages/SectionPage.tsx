import { Fragment, useEffect, useMemo, useState } from "react";
import { SearchIcon } from "../components/atoms/SearchIcon";
import { Notice } from "../components/atoms/Notice";
import { FilterTabs } from "../components/molecules/FilterTabs";
import { Pagination } from "../components/molecules/Pagination";
import { StoryListItem } from "../components/molecules/StoryListItem";
import { SpaceFeature } from "../components/organisms/SpaceFeature";
import { AGENCY_SHORT, PAGE_SIZE, PRESS } from "../lib/constants";
import { href } from "../lib/route";
import { searchItems } from "../lib/search";
import type { NewsItem, SpacePhoto } from "../types/news";

// 보도자료 기간 필터 (KST 기준). 전체 = 보관 중인 3달치
const PERIODS = [
  { key: "", name: "전체" },
  { key: "today", name: "오늘" },
  { key: "week", name: "1주" },
  { key: "month", name: "1개월" },
] as const;
const kstDate = (t: number) => new Date(t + 9 * 3600_000).toISOString().slice(0, 10);
function inPeriod(iso: string, period?: string): boolean {
  const t = Date.parse(iso);
  if (period === "today") return kstDate(t) === kstDate(Date.now());
  if (period === "week") return Date.now() - t <= 7 * 86_400_000;
  if (period === "month") return Date.now() - t <= 30 * 86_400_000;
  return true;
}

const kstDay = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long", timeZone: "Asia/Seoul" });

export function SectionPage({
  section,
  page,
  filter,
  period,
  q = "",
  items,
  space = null,
}: {
  section: string;
  page: number;
  filter?: string;
  period?: string; // 보도자료: today | week | month
  q?: string; // 보도자료 안에서 검색
  items: NewsItem[];
  space?: SpacePhoto | null; // 과학 섹션 맨 위: NASA 오늘의 우주 사진·영상
}) {
  // 보도자료 탭은 기관별, 다른 탭은 라벨 붙은 글이 있을 때만 라벨별로 거르는 탭을 보여줌
  const isPress = section === PRESS;
  const groupOf = (n: NewsItem) => (isPress ? n.source : n.label);
  const groups = [...new Set(items.map(groupOf).filter((g): g is string => !!g))];
  const active = filter && groups.includes(filter) ? filter : undefined;

  // 보도자료 검색어: 치는 대로 바로 거르지 않고 0.3초 멈추면 (한글 조합 중 깜빡임 방지), 주소에도 남김
  const [query, setQuery] = useState(q);
  const [searched, setSearched] = useState(q);
  useEffect(() => {
    setQuery(q);
    setSearched(q);
  }, [q]);
  useEffect(() => {
    const t = setTimeout(() => setSearched(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);
  const opts = { period, q: searched || undefined };
  useEffect(() => {
    if (!isPress) return;
    const next = href.section(section, 1, active, { period, q: searched || undefined });
    if (searched !== q && window.location.hash !== next) history.replaceState(null, "", next);
  }, [isPress, section, active, period, searched, q]);

  const inRange = useMemo(
    () => (isPress ? items.filter((n) => inPeriod(n.publishedAt, period)) : items),
    [isPress, items, period],
  );
  const matched = useMemo(() => {
    if (!isPress || !searched) return inRange;
    const hit = new Set(searchItems(inRange, searched).map((n) => n.id));
    return inRange.filter((n) => hit.has(n.id)); // 날짜순 그대로
  }, [isPress, inRange, searched]);
  const shown = active ? matched.filter((n) => groupOf(n) === active) : matched;
  const filtering = isPress && (!!period || !!searched);

  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const showTabs = groups.length > 0;

  return (
    <main>
      <h2 className="mt-8 font-serif text-4xl font-bold">{section}</h2>
      <p className="mt-1 text-sm text-muted">
        {shown.length} {shown.length === 1 ? (isPress ? "release" : "story") : isPress ? "releases" : "stories"}
        {filtering ? (searched ? <> matching &ldquo;{searched}&rdquo;</> : null) : <> from the past {isPress ? "three months" : "three days"}</>}
      </p>

      {/* 보도자료: 기간 + 검색 */}
      {isPress && (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Period" className="flex gap-1">
            {PERIODS.map((p) => {
              const on = (period ?? "") === p.key;
              return (
                <a
                  key={p.key}
                  href={href.section(section, 1, active, { period: p.key || undefined, q: searched || undefined })}
                  aria-current={on ? "true" : undefined}
                  className={`border px-3 py-1.5 text-sm ${on ? "border-ink bg-ink font-semibold text-paper" : "border-ink/20 text-ink-soft hover:border-ink"}`}
                >
                  {p.name}
                </a>
              );
            })}
          </nav>
          <label className="flex items-center gap-2 border-b border-ink pb-1 sm:w-72">
            <SearchIcon className="size-4 shrink-0" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="보도자료에서 찾기"
              aria-label="보도자료에서 찾기"
              className="min-w-0 flex-1 bg-transparent font-serif outline-none placeholder:text-muted"
            />
          </label>
        </div>
      )}

      {/* 과학 섹션 첫 페이지 맨 위에만 */}
      {space && current === 1 && !active && (
        <div className="mt-6 border-t-2 border-ink pt-5">
          <SpaceFeature photo={space} />
        </div>
      )}

      {showTabs && (
        <FilterTabs
          options={[
            { key: "all", name: "All", count: matched.length, href: href.section(section, 1, undefined, opts), active: !active },
            ...groups.map((g) => ({
              key: g,
              name: AGENCY_SHORT[g] ?? g,
              count: matched.filter((n) => groupOf(n) === g).length,
              href: href.section(section, 1, g, opts),
              active: active === g,
            })),
          ]}
        />
      )}

      {shown.length === 0 &&
        (filtering ? <Notice>No releases match these filters.</Notice> : <Notice>No stories in this section yet.</Notice>)}

      <ul className={`${showTabs ? "mt-0" : "mt-6"} border-t border-ink`}>
        {visible.map((n, i) => {
          // 보도자료는 2주치라 날짜 머리글로 묶음 (10월 28일 화요일)
          const day = isPress ? kstDay(n.publishedAt) : null;
          const newDay = day && (i === 0 || day !== kstDay(visible[i - 1].publishedAt));
          return (
            <Fragment key={n.id}>
              {newDay && (
                <li className={`border-b border-ink pb-2 text-sm font-bold ${i === 0 ? "pt-4" : "pt-10"}`}>{day}</li>
              )}
              <StoryListItem item={n} />
            </Fragment>
          );
        })}
      </ul>

      <Pagination current={current} total={totalPages} hrefFor={(p) => href.section(section, p, active, opts)} />
    </main>
  );
}
