import { useCallback, useEffect, useState, type ReactNode } from "react";
import { PullToRefresh } from "./PullToRefresh";

type NewsItem = {
  id: string;
  category: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  snippet: string;
  summary?: string;
  tags?: string[];
  essayPoint?: string;
  spaceFact?: string;
  titleKo?: string;
};

const titleOf = (n: NewsItem) => n.titleKo ?? n.title;

const SECTIONS = ["경제", "우주", "IT", "예술", "엔터", "책"] as const;

/* ---------- 해시 라우팅: #/ , #/section/경제 , #/article/<id> ---------- */
type Route =
  | { name: "front" }
  | { name: "section"; section: string; page: number }
  | { name: "article"; id: string };

function parseHash(): Route {
  const [path, query = ""] = window.location.hash.split("?");
  const [, kind, raw] = path.split("/");
  const value = raw ? decodeURIComponent(raw) : "";
  const page = Math.max(1, Number(new URLSearchParams(query).get("page")) || 1);
  if (kind === "section" && value)
    return { name: "section", section: value, page };
  if (kind === "article" && value) return { name: "article", id: value };
  return { name: "front" };
}

function useRoute(): Route {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

const href = {
  front: "#/",
  section: (s: string, page = 1) =>
    `#/section/${encodeURIComponent(s)}${page > 1 ? `?page=${page}` : ""}`,
  article: (id: string) => `#/article/${encodeURIComponent(id)}`,
};

/* ---------- 데이터 ---------- */
// 로컬 개발 중에는 내가 직접 수집한 data-local을 먼저 보고, 없으면 배포용 data로
function fetchData(name: string): Promise<Response> {
  const base = import.meta.env.BASE_URL;
  const init: RequestInit = { cache: "no-store" }; // 새로고침 때 항상 최신으로
  const shared = () => fetch(`${base}data/${name}`, init);
  if (!import.meta.env.DEV) return shared();
  return fetch(`${base}data-local/${name}`, init)
    .then((r) => (r.ok && r.headers.get("content-type")?.includes("json") ? r : shared()))
    .catch(shared);
}

/* ---------- 포맷 ---------- */
function timeAgo(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.round(h / 24)}일 전`;
}

/* ---------- App ---------- */
export default function App() {
  const route = useRoute();
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0); // 새로고침할 때마다 +1 (푸터도 다시 불러오게)

  const load = useCallback(async (): Promise<NewsItem[]> => {
    const r = await fetchData("news.json");
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }, []);

  useEffect(() => {
    load()
      .then(setItems)
      .catch(() => setError(true));
  }, [load]);

  // 당겨서 새로고침: 새로 들어온 기사 수를 돌려줌
  const refresh = useCallback(async (): Promise<number | null> => {
    try {
      const next = await load();
      const before = new Set(items?.map((n) => n.id));
      setItems(next);
      setError(false);
      setVersion((v) => v + 1);
      return next.filter((n) => !before.has(n.id)).length;
    } catch {
      return null;
    }
  }, [load, items]);

  const activeSection =
    route.name === "section"
      ? route.section
      : route.name === "article"
        ? items?.find((n) => n.id === route.id)?.category
        : undefined;

  return (
    <PullToRefresh onRefresh={refresh}>
    <div className="mx-auto max-w-300 px-4 pb-24 sm:px-6">
      <Masthead active={activeSection} isFront={route.name === "front"} />

      {error && (
        <Notice>
          뉴스 데이터를 불러오지 못했어요. 터미널에서{" "}
          <code>npm run collect</code>를 실행해 주세요.
        </Notice>
      )}
      {items && items.length === 0 && (
        <Notice>
          아직 수집된 기사가 없어요. <code>npm run collect</code>로 첫 수집을
          시작하세요.
        </Notice>
      )}

      {items && items.length > 0 && route.name === "front" && (
        <FrontPage items={items} />
      )}
      {items && route.name === "section" && (
        <SectionPage
          section={route.section}
          page={route.page}
          items={items.filter((n) => n.category === route.section)}
        />
      )}
      {items && route.name === "article" && (
        <ArticlePage
          item={items.find((n) => n.id === route.id)}
          items={items}
        />
      )}

      <Footer items={items} version={version} />
    </div>
    </PullToRefresh>
  );
}

/* ---------- 마스트헤드 ---------- */
function Masthead({ active, isFront }: { active?: string; isFront: boolean }) {
  return (
    <header className="pt-4">
      <a href={href.front} className="block py-3 text-center sm:py-5">
        <h1 className="font-masthead text-[clamp(2.6rem,9vw,5rem)] leading-none font-black tracking-tight">
          Today&rsquo;s News
        </h1>
      </a>

      <nav className="border-y border-ink">
        <ul className="flex justify-center gap-5 overflow-x-auto py-2.5 text-sm sm:gap-8">
          <NavLink href={href.front} current={isFront}>
            1면
          </NavLink>
          {SECTIONS.map((s) => (
            <NavLink key={s} href={href.section(s)} current={active === s}>
              {s}
            </NavLink>
          ))}
        </ul>
      </nav>
      <div className="mt-0.75 border-t border-ink" />
    </header>
  );
}

function NavLink({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: ReactNode;
}) {
  return (
    <li className="shrink-0">
      <a
        href={href}
        aria-current={current ? "page" : undefined}
        className={`pb-0.5 ${current ? "font-semibold border-b-2 border-ink" : "text-ink-soft hover:text-ink"}`}
      >
        {children}
      </a>
    </li>
  );
}

/* ---------- 1면 ---------- */
function FrontPage({ items }: { items: NewsItem[] }) {
  const lead = items.find((n) => n.summary) ?? items[0];
  const side = items.filter((n) => n.id !== lead.id).slice(0, 5);

  return (
    <main>
      <section className="grid gap-8 border-b border-rule py-6 md:grid-cols-3 md:gap-0">
        <article className="md:col-span-2 md:border-r md:border-rule md:pr-8">
          <Kicker category={lead.category} publishedAt={lead.publishedAt} />
          <a href={href.article(lead.id)} className="group block">
            <h2 className="mt-2 font-serif text-[clamp(1.6rem,3.2vw,2.4rem)] leading-tight font-bold group-hover:text-ink-soft">
              {titleOf(lead)}
            </h2>
            {lead.summary && (
              <p className="mt-4 max-w-[60ch] font-serif text-lg leading-[1.8] text-ink-soft">
                {lead.summary}
              </p>
            )}
          </a>
          {lead.essayPoint && (
            <EssayPoint text={lead.essayPoint} className="mt-8" />
          )}
        </article>

        <ol className="md:pl-8">
          {side.map((n, i) => (
            <li
              key={n.id}
              className={i > 0 ? "mt-4 border-t border-rule pt-4" : ""}
            >
              <Kicker category={n.category} publishedAt={n.publishedAt} />
              <a
                href={href.article(n.id)}
                className="mt-1 block font-serif text-[1.05rem] leading-snug font-semibold hover:text-ink-soft"
              >
                {titleOf(n)}
              </a>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => {
          const list = items.filter((n) => n.category === s).slice(0, 5);
          if (list.length === 0) return null;
          return (
            <section key={s} className="border-t-2 border-ink pt-3 mt-8">
              <a
                href={href.section(s)}
                className="font-serif text-xl font-bold hover:text-ink-soft"
              >
                {s}
              </a>
              <ul className="mt-2">
                {list.map((n, i) => (
                  <li
                    key={n.id}
                    className={i > 0 ? "border-t border-rule" : ""}
                  >
                    <a
                      href={href.article(n.id)}
                      className="block py-3 font-serif text-[0.97rem] leading-snug hover:text-ink-soft"
                    >
                      {titleOf(n)}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}

/* ---------- 섹션 ---------- */
const PAGE_SIZE = 10;

function SectionPage({
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
          <li key={n.id} className="border-b border-rule py-6">
            <a
              href={href.article(n.id)}
              className="group grid gap-1 sm:grid-cols-[7rem_1fr] sm:gap-6"
            >
              <span className="text-xs text-muted sm:pt-1.5">
                {timeAgo(n.publishedAt)}
              </span>
              <span>
                <span className="block font-serif text-xl leading-snug font-bold group-hover:text-ink-soft">
                  {titleOf(n)}
                </span>
                {n.summary && (
                  <span className="mt-2 block font-serif leading-[1.75] text-ink-soft">
                    {n.summary}
                  </span>
                )}
                <span className="mt-2 block text-xs text-muted">
                  {n.source}
                </span>
              </span>
            </a>
          </li>
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

/* ---------- 페이지네이션 (신문 하단 쪽번호 느낌) ---------- */
// 1 … 4 5 6 … 12 처럼 현재 페이지 주변만 보여줌
function pageList(current: number, total: number): (number | "gap")[] {
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

function Pagination({
  current,
  total,
  hrefFor,
}: {
  current: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  if (total <= 1) return null;
  const edge = "px-2 py-1 text-sm";
  return (
    <nav
      aria-label="페이지"
      className="mt-10 flex items-center justify-between gap-4 font-sans"
    >
      {current > 1 ? (
        <a href={hrefFor(current - 1)} className={`${edge} hover:underline`}>
          이전
        </a>
      ) : (
        <span className={`${edge} text-rule`} aria-hidden>
          이전
        </span>
      )}

      <ol className="flex items-center gap-1">
        {pageList(current, total).map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`} className="px-1 text-muted" aria-hidden>
              …
            </li>
          ) : (
            <li key={p}>
              <a
                href={hrefFor(p)}
                aria-current={p === current ? "page" : undefined}
                className={`inline-block min-w-9 py-1.5 text-center font-serif tabular-nums ${
                  p === current
                    ? "border-b-2 border-ink font-bold text-ink"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {p}
              </a>
            </li>
          ),
        )}
      </ol>

      {current < total ? (
        <a href={hrefFor(current + 1)} className={`${edge} hover:underline`}>
          다음
        </a>
      ) : (
        <span className={`${edge} text-rule`} aria-hidden>
          다음
        </span>
      )}
    </nav>
  );
}

/* ---------- 기사 상세 (내가 정리한 버전) ---------- */
function ArticlePage({ item, items }: { item?: NewsItem; items: NewsItem[] }) {
  if (!item) {
    return (
      <Notice>
        이 기사는 보관 기간(3일)이 지나 목록에서 빠졌어요.{" "}
        <a className="underline" href={href.front}>
          1면으로 가기
        </a>
      </Notice>
    );
  }

  const related = items
    .filter((n) => n.category === item.category && n.id !== item.id)
    .slice(0, 4);
  const showSnippet =
    item.snippet && !item.snippet.startsWith(item.title.slice(0, 15));

  return (
    <main className="mx-auto max-w-[680px] pt-8">
      <a
        href={href.section(item.category)}
        className="text-sm font-semibold hover:underline"
      >
        {item.category}
      </a>

      <h2 className="mt-3 font-serif text-[clamp(1.8rem,4.5vw,2.6rem)] leading-[1.25] font-bold">
        {titleOf(item)}
      </h2>

      {item.summary ? (
        <p className="mt-5 font-serif text-xl leading-[1.7] text-ink-soft">
          {item.summary}
        </p>
      ) : (
        <p className="mt-5 text-sm text-muted">
          아직 요약되지 않은 기사예요. 다음 수집 때 요약이 붙어요.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-x-4 gap-y-1 border-y border-rule py-3 text-sm text-ink-soft">
        <span className="font-semibold text-ink">{item.source}</span>
        <time dateTime={item.publishedAt}>
          {new Date(item.publishedAt).toLocaleString("ko-KR", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </time>
      </div>

      {item.essayPoint && (
        <section className="mt-8">
          <h3 className="font-sans text-sm font-semibold">생각해볼 점</h3>
          <EssayPoint text={item.essayPoint} className="mt-6 text-lg" />
        </section>
      )}

      {item.spaceFact && (
        <section className="mt-8 border-y border-ink py-5">
          <h3 className="font-sans text-sm font-semibold">
            알고 보면 재밌는 우주 이야기
          </h3>
          <p className="mt-2 font-serif text-lg leading-[1.85]">
            {item.spaceFact}
          </p>
        </section>
      )}

      {item.titleKo && (
        <p className="mt-6 text-sm text-muted">원제: {item.title}</p>
      )}

      {showSnippet && (
        <section className="mt-8">
          <h3 className="font-sans text-sm font-semibold">원문 발췌</h3>
          <p className="mt-2 border-l-2 border-rule pl-4 font-serif leading-[1.8] text-ink-soft">
            {item.snippet}
          </p>
        </section>
      )}

      {item.tags && item.tags.length > 0 && (
        <ul className="mt-8 flex flex-wrap gap-2">
          {item.tags.map((t) => (
            <li
              key={t}
              className="border border-rule px-2.5 py-1 text-xs text-ink-soft"
            >
              {t}
            </li>
          ))}
        </ul>
      )}

      <a
        href={item.link}
        target="_blank"
        rel="noreferrer"
        className="mt-10 inline-block bg-ink px-5 py-3 text-sm font-semibold text-paper hover:bg-ink-soft"
      >
        원문 기사 읽기
      </a>

      {related.length > 0 && (
        <aside className="mt-16 border-t-2 border-ink pt-3">
          <h3 className="font-serif text-lg font-bold">
            {item.category}의 다른 기사
          </h3>
          <ul>
            {related.map((n, i) => (
              <li key={n.id} className={i > 0 ? "border-t border-rule" : ""}>
                <a
                  href={href.article(n.id)}
                  className="block py-3 font-serif leading-snug hover:text-ink-soft"
                >
                  {titleOf(n)}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </main>
  );
}

/* ---------- 작은 조각들 ---------- */
function Kicker({
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

// 논술 포인트: 색 대신 타이포로 강조 (흑백 화면에서도 그대로 보이게)
// 왼쪽 굵은 세로 괘선 + 걸린 큰따옴표
function EssayPoint({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <figure className={`relative border-l-[3px] border-ink pl-5 ${className}`}>
      <span
        aria-hidden
        className="pointer-events-none absolute -top-5 left-3 font-masthead text-6xl leading-none text-ink select-none"
      >
        &ldquo;
      </span>
      <blockquote className="pt-5 font-serif leading-[1.85] font-medium text-ink">
        {text}
      </blockquote>
    </figure>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="mx-auto mt-16 max-w-[60ch] text-center text-ink-soft">
      {children}
    </p>
  );
}

/* ---------- 푸터 ---------- */
const REPO_URL = "https://github.com/minijae011030/TodaysNews";

const fullDate = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
const stamp = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function Footer({ items, version }: { items: NewsItem[] | null; version: number }) {
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    fetchData("meta.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => m?.updatedAt && setUpdatedAt(m.updatedAt))
      .catch(() => {});
  }, [version]);

  const summarized = items?.filter((n) => n.summary).length ?? 0;

  return (
    <footer className="mt-24 border-t-4 border-double border-ink pt-8 text-sm text-ink-soft">
      <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <a
            href={href.front}
            className="font-masthead text-3xl font-black text-ink"
          >
            Today&rsquo;s News
          </a>
          <p className="mt-3 max-w-[42ch] font-serif leading-[1.75]">
            경제, 우주, IT, 예술, 엔터, 책 소식을 매시간 모아 원문을 읽고 요약해
            두는 개인 신문입니다.
          </p>
        </div>

        <nav aria-label="섹션">
          <h2 className="font-semibold text-ink">섹션</h2>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2">
            <li>
              <a href={href.front} className="hover:text-ink hover:underline">
                1면
              </a>
            </li>
            {SECTIONS.map((s) => (
              <li key={s}>
                <a
                  href={href.section(s)}
                  className="hover:text-ink hover:underline"
                >
                  {s}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="font-semibold text-ink">이번 호</h2>
          <dl className="mt-3 space-y-2">
            {updatedAt && (
              <div className="flex justify-between gap-4">
                <dt>마지막 수집</dt>
                <dd className="tabular-nums text-ink">
                  {stamp.format(new Date(updatedAt))}
                </dd>
              </div>
            )}
            {items && (
              <>
                <div className="flex justify-between gap-4">
                  <dt>보관 중인 기사</dt>
                  <dd className="tabular-nums text-ink">{items.length}건</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>요약 완료</dt>
                  <dd className="tabular-nums text-ink">{summarized}건</dd>
                </div>
              </>
            )}
            <div className="flex justify-between gap-4">
              <dt>보관 기간</dt>
              <dd className="text-ink">최근 3일</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-10 border-t border-rule pt-5 text-xs leading-[1.8] text-muted">
        <p>
          기사 출처는 네이버 뉴스 검색, NASA, 각 언론사 RSS입니다. 기사의
          저작권은 각 언론사에 있습니다.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span>{fullDate.format(new Date())}</span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-ink-soft hover:text-ink hover:underline"
          >
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="size-4 fill-current"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            minijae011030/TodaysNews
          </a>
        </div>
      </div>
    </footer>
  );
}
