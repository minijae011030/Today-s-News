import { SECTIONS } from "../../lib/constants";
import { href } from "../../lib/route";
import { NavLink } from "../atoms/NavLink";

export function Masthead({
  active,
  isFront,
}: {
  active?: string;
  isFront: boolean;
}) {
  return (
    <header className="pt-4">
      <a href={href.front} className="block py-3 text-center sm:py-5">
        <h1 className="font-masthead text-[clamp(2.6rem,9vw,5rem)] leading-none font-black tracking-tight">
          Today&rsquo;s News
        </h1>
      </a>

      <nav className="overflow-x-auto border-y border-ink">
        <ul className="mx-auto flex w-max gap-5 px-1 py-2.5 text-sm sm:gap-8">
          <NavLink href={href.front} current={isFront}>
            1면
          </NavLink>
          {SECTIONS.map((s) => (
            <NavLink key={s} href={href.section(s)} current={active === s}>
              {s}
            </NavLink>
          ))}
        </ul>
      </nav>
      <div className="mt-0.75 border-t border-ink" />
    </header>
  );
}
