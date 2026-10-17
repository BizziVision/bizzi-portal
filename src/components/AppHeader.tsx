import Link from "next/link";
import { BrandMark } from "./Brand";
import type { Profile } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/types";

export function AppHeader({
  profile,
  nav,
  context,
}: {
  profile: Profile;
  nav: { href: string; label: string }[];
  context?: string;
}) {
  return (
    <header className="border-b border-slate-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3.5 sm:px-6">
        <Link href="/" className="shrink-0">
          <BrandMark size={26} />
        </Link>
        {context && (
          <span className="hidden border-l border-slate-200 pl-6 font-bold text-slate-700 sm:inline">
            {context}
          </span>
        )}
        <nav className="order-3 flex w-full gap-5 overflow-x-auto text-[14px] sm:order-none sm:w-auto">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap text-slate-700 hover:text-navy"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-[13px] text-slate-600">
          <span className="hidden md:inline">
            {profile.email} · {ROLE_LABEL[profile.role]}
          </span>
          <form action="/auth/sair" method="post">
            <button className="rounded-md border border-slate-200 px-3 py-1.5 hover:border-slate-400 hover:text-navy">
              Sair
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
