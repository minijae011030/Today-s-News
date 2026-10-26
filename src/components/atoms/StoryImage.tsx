import { useState } from "react";

/**
 * 기사 사진 (원문 사이트 이미지를 그대로 불러옴)
 * - 다른 사이트 이미지를 막는 곳이 있어서 referrer를 안 보냄
 * - 못 불러오면 자리 차지하지 않고 통째로 숨김
 */
export function StoryImage({
  src,
  credit,
  ratio = "aspect-[3/2]",
  className = "",
  priority = false,
}: {
  src?: string;
  credit?: string;
  ratio?: string;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;

  return (
    <figure className={className}>
      <div className={`${ratio} overflow-hidden bg-rule`}>
        <img
          src={src}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      </div>
      {credit && (
        <figcaption className="mt-1.5 text-right text-[0.7rem] text-muted">
          사진: {credit}
        </figcaption>
      )}
    </figure>
  );
}
