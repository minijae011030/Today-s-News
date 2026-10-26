import { Label } from "../components/atoms/Label";
import { Notice } from "../components/atoms/Notice";
import { StoryImage } from "../components/atoms/StoryImage";
import { Tag } from "../components/atoms/Tag";
import { EssayPoint } from "../components/molecules/EssayPoint";
import { HeadlineList } from "../components/molecules/HeadlineList";
import { formatPublished, titleOf } from "../lib/format";
import { href } from "../lib/route";
import type { NewsItem } from "../types/news";

/** 기사 상세 (내가 정리한 버전) */
export function ArticlePage({
  item,
  items,
}: {
  item?: NewsItem;
  items: NewsItem[];
}) {
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
    <main className="mx-auto max-w-170 pt-8">
      <a
        href={href.section(item.category)}
        className="text-sm font-semibold hover:underline"
      >
        {item.category}
      </a>

      <h2 className="mt-3 font-serif text-[clamp(1.8rem,4.5vw,2.6rem)] leading-tight font-bold">
        {titleOf(item)}
      </h2>

      <StoryImage src={item.image} credit={item.source} className="mt-6" priority />

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
          {formatPublished(item.publishedAt)}
        </time>
      </div>

      {item.essayPoint && (
        <section className="mt-8">
          <Label>생각해볼 점</Label>
          <EssayPoint text={item.essayPoint} className="mt-6 text-lg" />
        </section>
      )}

      {item.spaceFact && (
        <section className="mt-8 border-y border-ink py-5">
          <Label>알고 보면 재밌는 우주 이야기</Label>
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
          <Label>원문 발췌</Label>
          <p className="mt-2 border-l-2 border-rule pl-4 font-serif leading-[1.8] text-ink-soft">
            {item.snippet}
          </p>
        </section>
      )}

      {item.tags && item.tags.length > 0 && (
        <ul className="mt-8 flex flex-wrap gap-2">
          {item.tags.map((t) => (
            <Tag key={t}>{t}</Tag>
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
          <HeadlineList items={related} />
        </aside>
      )}
    </main>
  );
}
