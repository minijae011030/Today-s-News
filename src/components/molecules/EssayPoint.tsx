// 논술 포인트: 색 대신 타이포로 강조 (흑백 화면에서도 그대로 보이게)
// 왼쪽 굵은 세로 괘선 + 걸린 큰따옴표
export function EssayPoint({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <figure className={`relative border-l-[3px] border-ink pl-5 ${className}`}>
      <span
        aria-hidden
        className="pointer-events-none absolute -top-5 left-3 font-masthead text-6xl leading-none text-ink select-none"
      >
        &ldquo;
      </span>
      <blockquote className="pt-5 font-serif leading-[1.85] font-medium text-ink">
        {text}
      </blockquote>
    </figure>
  );
}
