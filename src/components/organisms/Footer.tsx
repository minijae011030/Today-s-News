import { useUpdatedAt } from "../../hooks/useUpdatedAt";
import { REPO_URL, SECTIONS } from "../../lib/constants";
import { fullDate, stamp } from "../../lib/format";
import { href } from "../../lib/route";
import type { NewsItem } from "../../types/news";
import { GithubIcon } from "../atoms/GithubIcon";
import { NotifyButton } from "../molecules/NotifyButton";
import { StatRow } from "../molecules/StatRow";

export function Footer({
  items,
  version,
}: {
  items: NewsItem[] | null;
  version: number;
}) {
  const updatedAt = useUpdatedAt(version);
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
            경제, 국제, 사회, IT, 우주, 예술, 엔터, 책 소식을 매시간 모아 원문을
            읽고 요약해 두는 개인 신문입니다.
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
              <StatRow label="마지막 수집">
                {stamp.format(new Date(updatedAt))}
              </StatRow>
            )}
            {items && (
              <>
                <StatRow label="보관 중인 기사">{items.length}건</StatRow>
                <StatRow label="요약 완료">{summarized}건</StatRow>
              </>
            )}
            <StatRow label="보관 기간">최근 3일</StatRow>
          </dl>
          <NotifyButton />
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
            <GithubIcon />
            minijae011030/TodaysNews
          </a>
        </div>
      </div>
    </footer>
  );
}
