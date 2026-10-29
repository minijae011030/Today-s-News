/**
 * 날짜 하나 고르는 칸: 작은 이름표 + 신문 글씨로 날짜. 실제 입력은 브라우저 달력(투명하게 겹쳐 둠)
 * 폰에선 네이티브 달력, PC에선 눌렀을 때 달력이 바로 열림
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
  const shown = value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Any date";
  return (
    <div className={`relative min-w-0 py-2.5 pr-8 ${className}`}>
      <span className="block text-[0.65rem] font-semibold tracking-[0.12em] text-muted uppercase">{label}</span>
      <span className={`mt-0.5 flex items-center gap-2 font-serif text-[1.05rem] ${value ? "text-ink" : "text-muted"}`}>
        {shown}
      </span>
      <input
        type="date"
        value={value ?? ""}
        min={min}
        max={max}
        aria-label={label}
        onChange={(e) => onChange(e.target.value || undefined)}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker?.();
          } catch {}
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          aria-label={`${label} 지우기`}
          className="absolute top-1/2 right-1 z-10 -translate-y-1/2 px-1.5 text-lg leading-none text-muted hover:text-ink"
        >
          ×
        </button>
      )}
    </div>
  );
}
