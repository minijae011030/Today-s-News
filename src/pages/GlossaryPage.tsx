import { useEffect, useMemo, useState } from "react";
import { Notice } from "../components/atoms/Notice";
import { SearchIcon } from "../components/atoms/SearchIcon";
import { initialOf, termKey, type TermInfo } from "../lib/glossary";
import { href } from "../lib/route";
import { searchItems } from "../lib/search";
import type { NewsItem } from "../types/news";

/** 용어 사전: 기사에서 모인 경제·금융 용어를 가나다순으로 */
export function GlossaryPage({
  lookup,
  items,
  focus,
}: {
  lookup: Map<string, TermInfo>;
  items: NewsItem[];
  focus?: string; // #/glossary?t=DSR 처럼 들어오면 그 용어로 스크롤
}) {
  const [filter, setFilter] = useState("");
  const entries = useMemo(
    () => [...new Set(lookup.values())].sort((a, b) => a.term.localeCompare(b.term, "ko")),
    [lookup],
  );

  const shown = useMemo(() => {
    const f = termKey(filter);
    if (!f) return entries;
    return entries.filter((e) =>
      [e.term, ...(e.aliases ?? [])].some((t) => termKey(t).includes(f)) || e.definition.includes(filter.trim()),
    );
  }, [entries, filter]);

  // 초성/알파벳별 묶음
  const groups = useMemo(() => {
    const map = new Map<string, TermInfo[]>();
    for (const e of shown) {
      const g = initialOf(e.term);
      map.set(g, [...(map.get(g) ?? []), e]);
    }
    return [...map.entries()];
  }, [shown]);

  const focusId = focus ? `term-${termKey(lookup.get(termKey(focus))?.term ?? focus)}` : undefined;
  useEffect(() => {
    if (!focusId) return;
    document.getElementById(focusId)?.scrollIntoView({ block: "center" });
  }, [focusId, entries.length]);

  return (
    // 용어가 적어도 화면을 채워서 푸터가 바로 올라오지 않게 (검색 화면과 같은 방식)
    <main className="min-h-[calc(100svh-14rem)]">
      <h2 className="mt-8 font-serif text-4xl font-bold">용어 사전</h2>
      <p className="mt-1 text-sm text-muted">
        {entries.length} terms from press releases, economy and politics stories. Definitions are written by AI.
      </p>

      {entries.length === 0 ? (
        <Notice>The glossary will fill up as new stories come in.</Notice>
      ) : (
        <>
          <div className="mt-6 flex items-center gap-3 border-b-2 border-ink pb-2">
            <SearchIcon className="size-5 shrink-0" />
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Find a term"
              aria-label="Find a term"
              className="min-w-0 flex-1 bg-transparent font-serif text-xl outline-none placeholder:text-muted"
            />
          </div>

          {/* 초성 바로가기 */}
          {!filter && (
            <nav aria-label="Index" className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {groups.map(([g]) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => document.getElementById(`group-${g}`)?.scrollIntoView({ behavior: "smooth" })}
                  className="font-semibold text-ink-soft hover:text-ink"
                >
                  {g}
                </button>
              ))}
            </nav>
          )}

          {shown.length === 0 && <Notice>No terms match &ldquo;{filter.trim()}&rdquo;.</Notice>}

          {groups.map(([g, list]) => (
            <section key={g} id={`group-${g}`} className="mt-10 scroll-mt-4">
              <h3 className="border-b-2 border-ink pb-1 font-serif text-2xl font-bold">{g}</h3>
              <dl className="lg:grid lg:grid-cols-2 lg:gap-x-12">
                {list.map((e) => {
                  const id = `term-${termKey(e.term)}`;
                  const related = searchItems(items, e.term).length;
                  return (
                    <div
                      key={e.term}
                      id={id}
                      className={`border-b border-rule py-5 ${id === focusId ? "border-l-[3px] border-l-ink pl-4" : ""}`}
                    >
                      <dt className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-serif text-lg font-bold">{e.term}</span>
                        {e.aliases && e.aliases.length > 0 && (
                          <span className="text-sm text-muted">{e.aliases.join(" · ")}</span>
                        )}
                      </dt>
                      <dd className="mt-1.5 font-serif leading-[1.75] text-ink-soft">{e.definition}</dd>
                      {e.concept && (
                        <dd className="mt-2 text-sm text-muted">오늘의 개념 · {e.concept.date}</dd>
                      )}
                      {related > 0 && (
                        <dd className="mt-2 text-sm">
                          <a href={href.search(e.term)} className="font-semibold hover:underline">
                            관련 기사 {related} &rarr;
                          </a>
                        </dd>
                      )}
                    </div>
                  );
                })}
              </dl>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
