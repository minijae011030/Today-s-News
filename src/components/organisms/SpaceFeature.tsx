import type { SpacePhoto } from "../../types/news";
import { StoryImage } from "../atoms/StoryImage";

// 메뉴 제목 같은 게 잘못 잡힌 경우 대비
const BAD_TITLE = /suggested searches|featured|keep exploring/i;

/** 1면 톱: NASA 오늘의 천문 사진·영상 (꽉 차게 + 원제 + 쉬운 한국어 설명) */
export function SpaceFeature({ photo }: { photo: SpacePhoto }) {
  const title = BAD_TITLE.test(photo.title) ? null : photo.title;
  const isVideo = !!(photo.video || photo.embed);
  return (
    <article>
      {photo.video ? (
        // NASA가 올린 mp4: 소리 없이 반복 재생 (폰에서도 자동재생되려면 muted + playsInline 필요)
        <figure className="mb-4">
          <video
            src={photo.video}
            poster={photo.image}
            autoPlay
            muted
            loop
            playsInline
            controls
            preload="metadata"
            className="aspect-[3/2] w-full bg-ink object-cover"
          />
          <figcaption className="mt-1 text-right text-[0.7rem] text-muted">{photo.credit}</figcaption>
        </figure>
      ) : photo.embed ? (
        <figure className="mb-4">
          <iframe
            src={photo.embed}
            title={photo.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
            className="aspect-video w-full bg-ink"
          />
          <figcaption className="mt-1 text-right text-[0.7rem] text-muted">{photo.credit}</figcaption>
        </figure>
      ) : (
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
      )}
      <p className="flex gap-3 text-xs">
        <span className="font-semibold">Today&rsquo;s Space {isVideo ? "Video" : "Photo"}</span>
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
