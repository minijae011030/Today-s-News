import { useEffect, useState } from "react";
import { Label } from "../components/atoms/Label";
import { LabelBadge } from "../components/atoms/LabelBadge";
import { Notice } from "../components/atoms/Notice";
import { StoryImage } from "../components/atoms/StoryImage";
import { Tag } from "../components/atoms/Tag";
import { ArticleNav } from "../components/molecules/ArticleNav";
import { EssayPoint } from "../components/molecules/EssayPoint";
import { HeadlineList } from "../components/molecules/HeadlineList";
import { makeTermLinker } from "../components/molecules/TermText";
import { TermPopup } from "../components/organisms/TermPopup";
import { termKey, type TermInfo } from "../lib/glossary";
import { searchItems } from "../lib/search";
import { formatPublished, titleOf } from "../lib/format";
import { href } from "../lib/route";
import type { NewsItem } from "../types/news";

/** 기사 상세 (내가 정리한 버전) */
export function ArticlePage({
  item,
  items,
  lookup,
}: {
  item?: NewsItem;
  items: NewsItem[];
  lookup: Map<string, TermInfo>;
}) {
  const [open, setOpen] = useState<{ info: TermInfo; anchor: HTMLElement } | null>(null);
  useEffect(() => setOpen(null), [item?.id]); // 다른 기사로 가면 팝업 닫기

  if (!item) {
    return (
      <Notice>
        This story is no longer available.{" "}
        <a className="underline" href={href.front}>
          Back to the front page
        </a>
      </Notice>
    );
  }

  // 같은 섹션 글 (최신순). 목록에서 바로 아래가 이전(더 오래된) 글, 바로 위가 다음(더 최근) 글
  const sameSection = items.filter((n) => n.category === item.category);
  const index = sameSection.findIndex((n) => n.id === item.id);
  const prev = sameSection[index + 1];
  const next = index > 0 ? sameSection[index - 1] : undefined;
  const related = sameSection.filter((n) => n.id !== item.id && n !== prev && n !== next).slice(0, 4);
  // 용어 풀이: 이 기사에서 뽑힌 용어 중 사전에 있는 것만, 처음 나온 곳에 링크
  const linkTerms = makeTermLinker(
    (item.terms ?? []).flatMap((t) => {
      const info = lookup.get(termKey(t));
      return info ? [{ text: t, info }] : [];
    }),
    (info, anchor) => setOpen((cur) => (cur?.anchor === anchor ? null : { info, anchor })),
  );
  const showSnippet =
    item.snippet && !item.snippet.startsWith(item.title.slice(0, 15));

  return (
    <main className="mx-auto max-w-170 pt-8">
      <div className="flex items-center gap-3">
        <a
          href={href.section(item.category)}
          className="text-sm font-semibold hover:underline"
        >
          {item.category}
        </a>
        <LabelBadge label={item.label} source={item.source} />
      </div>

      <h2 className="mt-3 font-serif text-[clamp(1.8rem,4.5vw,2.6rem)] leading-tight font-bold">
        {titleOf(item)}
      </h2>

      <StoryImage src={item.image} credit={item.source} ratio="natural" className="mt-6" priority />

      {item.summary ? (
        <p className="mt-5 font-serif text-xl leading-[1.7] text-ink-soft">
          {linkTerms(item.summary)}
        </p>
      ) : (
        <p className="mt-5 text-sm text-muted">
          Summary in progress.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-x-4 gap-y-1 border-y border-rule py-3 text-sm text-ink-soft">
        <span className="font-semibold text-ink">{item.source}</span>
        {(item.coverage ?? 1) > 1 && <span>{item.coverage}개 매체 보도</span>}
        <time dateTime={item.publishedAt}>
          {formatPublished(item.publishedAt)}
        </time>
      </div>

      {item.keyPoints && item.keyPoints.length > 0 && (
        <section className="mt-8">
          <Label>주요 내용</Label>
          <ul className="mt-2 space-y-2">
            {item.keyPoints.map((p) => (
              <li key={p} className="flex gap-3 font-serif leading-[1.75]">
                <span aria-hidden className="mt-[0.75em] h-px w-3 shrink-0 bg-ink" />
                <span>{linkTerms(p)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {item.essayPoint && (
        <section className="mt-8">
          <Label>논점</Label>
          <EssayPoint text={linkTerms(item.essayPoint)} className="mt-6 text-lg" />
        </section>
      )}

      {item.spaceFact && (
        <section className="mt-8 border-y border-ink py-5">
          <Label>과학 노트</Label>
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
          <Label>원문에서</Label>
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
        Read the original article
      </a>

      {item.attachment && (
        <a
          href={item.attachment}
          target="_blank"
          rel="noreferrer"
          className="mt-10 ml-2 inline-block border border-ink px-5 py-3 text-sm font-semibold hover:bg-ink hover:text-paper"
        >
          Press release PDF
        </a>
      )}

      {related.length > 0 && (
        <aside className="mt-16 border-t-2 border-ink pt-3">
          <h3 className="font-serif text-lg font-bold">
            More in {item.category}
          </h3>
          <HeadlineList items={related} />
        </aside>
      )}

      <ArticleNav prev={prev} next={next} />

      {open && (
        <TermPopup
          info={open.info}
          anchor={open.anchor}
          relatedCount={searchItems(items, open.info.term).length}
          onClose={() => setOpen(null)}
        />
      )}
    </main>
  );
}
