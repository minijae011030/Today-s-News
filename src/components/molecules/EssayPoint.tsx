import type { ReactNode } from "react";

// 논술 포인트: 색 대신 타이포로 강조 (흑백 화면에서도 그대로 보이게)
// 왼쪽 굵은 세로 괘선 + 걸린 큰따옴표
// "배경: … / 근거(또는 대응): … / 쟁점: …" 형식이면 줄마다 작은 이름표를 붙여서 보여줌 (예전 한 문단짜리도 그대로 보여줌)
const PART = /^(배경|근거|대응|쟁점)\s*[:：]\s*/;

export function EssayPoint({
  text,
  render = (s) => s,
  className = "",
}: {
  text: string;
  render?: (s: string) => ReactNode; // 용어 링크 걸기 등
  className?: string;
}) {
  // 줄바꿈 없이 한 줄로 오는 경우도 있어서 "배경:", "근거:" 같은 이름표 앞에서 나눔
  const lines = text
    .split(/\n+|(?=(?:배경|근거|대응|쟁점)\s*[:：])/)
    .map((l) => l.trim())
    .filter(Boolean);
  const parts = lines.every((l) => PART.test(l)) && lines.length > 1;

  return (
    <figure className={`relative border-l-[3px] border-ink pl-5 ${className}`}>
      <span
        aria-hidden
        className="pointer-events-none absolute -top-5 left-3 font-masthead text-6xl leading-none text-ink select-none"
      >
        &ldquo;
      </span>
      {parts ? (
        <dl className="space-y-3 pt-5 font-serif leading-[1.8] text-ink">
          {lines.map((l) => {
            const [, name] = l.match(PART)!;
            return (
              <div key={l}>
                <dt className="font-sans text-xs font-bold tracking-wide">{name}</dt>
                <dd className="mt-0.5">{render(l.replace(PART, ""))}</dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <blockquote className="pt-5 font-serif leading-[1.85] font-medium text-ink">{render(text)}</blockquote>
      )}
    </figure>
  );
}
