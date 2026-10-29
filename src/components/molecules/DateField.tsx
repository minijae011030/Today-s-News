/**
 * 날짜 하나 고르는 칸: 작은 이름표 + 브라우저 날짜 입력 (테두리 없이 신문 글씨로)
 * - 입력창을 투명하게 덮어씌우는 방식은 사파리(PC)처럼 달력이 안 뜨는 브라우저에서 안 보이는 채로 입력돼서,
 *   입력창을 그대로 보여주고 모양만 다듬음
 * - 날짜는 고르는 즉시가 아니라 입력이 끝났을 때(blur/완성된 값) 반영
 */
export function DateField({
  label,
  value,
  min,
  max,
  onChange,
  className = "",
}: {
  label: string;
  value?: string;
  min?: string;
  max?: string;
  onChange: (v?: string) => void;
  className?: string;
}) {
  return (
    <label className={`relative block min-w-0 py-2.5 pr-8 ${className}`}>
      <span className="block text-[0.65rem] font-semibold tracking-[0.12em] text-muted uppercase">{label}</span>
      <input
        type="date"
        value={value ?? ""}
        min={min}
        max={max}
        onChange={(e) => {
          const v = e.target.value;
          // 연·월·일이 다 채워졌을 때만 (입력 중간값 무시), 비우면 해제
          if (!v || /^\d{4}-\d{2}-\d{2}$/.test(v)) onChange(v || undefined);
        }}
        className={`date-field mt-0.5 w-full bg-transparent font-serif text-[1.05rem] ${value ? "text-ink" : "text-muted"}`}
      />
      {value && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onChange(undefined);
          }}
          aria-label={`${label} 지우기`}
          className="absolute right-1 bottom-2.5 z-10 px-1.5 text-lg leading-none text-muted hover:text-ink"
        >
          ×
        </button>
      )}
    </label>
  );
}
