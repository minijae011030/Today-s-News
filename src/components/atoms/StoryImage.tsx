import { useState } from "react";

/**
 * 기사 사진 (원문 사이트 이미지를 그대로 불러옴)
 * - 다른 사이트 이미지를 막는 곳이 있어서 referrer를 안 보냄
 * - 못 불러오면 자리 차지하지 않고 통째로 숨김
 * - ratio="natural": 원본 비율 그대로 (안 잘림). 너무 긴 사진은 maxHeight까지만 보여주고 양옆 여백
 * - 그 외: 정해진 비율로 잘라서 채움 (목록 썸네일용). 세로로 긴 사진은 위쪽 기준으로 잘림
 */
export function StoryImage({
  src,
  credit,
  ratio = "aspect-[3/2]",
  className = "",
  priority = false,
  maxHeight = "max-h-[70vh]",
  position = "object-top",
}: {
  src?: string;
  credit?: string;
  ratio?: string;
  className?: string;
  priority?: boolean;
  maxHeight?: string;
  position?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;

  return (
    <figure className={className}>
      {ratio === "natural" ? (
        <div className="flex justify-center border-y border-rule bg-paper">
          <img
            src={src}
            alt=""
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className={`h-auto w-auto max-w-full ${maxHeight} object-contain`}
          />
        </div>
      ) : (
        <div className={`${ratio} overflow-hidden bg-rule`}>
          <img
            src={src}
            alt=""
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className={`size-full object-cover ${position}`}
          />
        </div>
      )}
      {credit && (
        <figcaption className="mt-1.5 text-right text-[0.7rem] text-muted">
          Photo: {credit}
        </figcaption>
      )}
    </figure>
  );
}
