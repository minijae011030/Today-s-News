export function Tag({ children }: { children: string }) {
  return (
    <li className="border border-rule px-2.5 py-1 text-xs text-ink-soft">
      {children}
    </li>
  );
}
