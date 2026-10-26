import { titleOf } from "../../lib/format";
import { href } from "../../lib/route";
import type { NewsItem } from "../../types/news";
import { HeadlineLink } from "../atoms/HeadlineLink";
import { StoryImage } from "../atoms/StoryImage";
import { EssayPoint } from "../molecules/EssayPoint";
import { Kicker } from "../molecules/Kicker";

/** 1면 상단: 왼쪽 톱기사 + 오른쪽 주요 기사 5개 */
export function LeadStory({
  lead,
  side,
}: {
  lead: NewsItem;
  side: NewsItem[];
}) {
  return (
    <section className="grid gap-8 border-b border-rule py-6 md:grid-cols-3 md:gap-0">
      <article className="md:col-span-2 md:border-r md:border-rule md:pr-8">
        <a href={href.article(lead.id)} tabIndex={-1} aria-hidden>
          <StoryImage src={lead.image} credit={lead.source} className="mb-4" priority />
        </a>
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
            <HeadlineLink
              item={n}
              className="mt-1 text-[1.05rem] font-semibold"
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
