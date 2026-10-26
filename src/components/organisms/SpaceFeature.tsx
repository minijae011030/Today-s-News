import type { SpacePhoto } from "../../types/news";
import { StoryImage } from "../atoms/StoryImage";

// 메뉴 제목 같은 게 잘못 잡힌 경우 대비
const BAD_TITLE = /suggested searches|featured|keep exploring/i;

/** 1면 톱: NASA 오늘의 천문 사진 (사진 꽉 차게 + 원제 + 쉬운 한국어 설명) */
export function SpaceFeature({ photo }: { photo: SpacePhoto }) {
  const title = BAD_TITLE.test(photo.title) ? null : photo.title;
  return (
    <article>
      <a href={photo.hdImage ?? photo.image} target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden>
        <StoryImage
          src={photo.image}
          credit={photo.credit}
          ratio="aspect-[3/2]"
          position="object-center"
          className="mb-4"
          priority
        />
      </a>
      <p className="flex gap-3 text-xs">
        <span className="font-semibold">Today&rsquo;s Space Photo</span>
        <span className="text-muted">{photo.date}</span>
      </p>
      {title && (
        <h2 className="mt-2 font-serif text-[clamp(1.6rem,3.2vw,2.4rem)] leading-tight font-bold">{title}</h2>
      )}
      {photo.story && (
        <p className="mt-4 max-w-[60ch] font-serif text-lg leading-[1.8] text-ink-soft">{photo.story}</p>
      )}
      <a
        href={photo.link}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-block text-sm font-semibold underline underline-offset-4 hover:text-ink-soft"
      >
        View on NASA APOD
      </a>
    </article>
  );
}
