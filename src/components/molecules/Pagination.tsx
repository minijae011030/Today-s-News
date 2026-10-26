import { pageList } from "../../lib/pagination";

/** 신문 하단 쪽번호 느낌의 페이지네이션 */
export function Pagination({
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
      aria-label="Pagination"
      className="mt-10 flex items-center justify-between gap-4 font-sans"
    >
      {current > 1 ? (
        <a href={hrefFor(current - 1)} className={`${edge} hover:underline`}>
          Previous
        </a>
      ) : (
        <span className={`${edge} text-rule`} aria-hidden>
          Previous
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
          Next
        </a>
      ) : (
        <span className={`${edge} text-rule`} aria-hidden>
          Next
        </span>
      )}
    </nav>
  );
}
