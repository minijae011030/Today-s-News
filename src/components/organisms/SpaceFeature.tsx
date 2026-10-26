import type { SpacePhoto } from "../../types/news";
import { StoryImage } from "../atoms/StoryImage";

/** 1면 톱: NASA 오늘의 천문 사진 (기사 대신 사진 한 장 + 쉬운 설명) */
export function SpaceFeature({ photo }: { photo: SpacePhoto }) {
  return (
    <article>
      <a href={photo.hdImage ?? photo.image} target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden>
        <StoryImage
          src={photo.image}
          credit={photo.credit}
          ratio="natural"
          maxHeight="max-h-[30rem]"
          className="mb-4"
          priority
        />
      </a>
      <p className="flex gap-3 text-xs">
        <span className="font-semibold">Astronomy Picture of the Day</span>
        <span className="text-muted">{photo.date}</span>
      </p>
      <h2 className="mt-2 font-serif text-[clamp(1.6rem,3.2vw,2.4rem)] leading-tight font-bold">
        {photo.titleKo}
      </h2>
      {photo.titleKo !== photo.title && <p className="mt-1 text-sm text-muted">{photo.title}</p>}
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
