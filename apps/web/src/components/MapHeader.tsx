import { LANGUAGES, languageLabels, type Language } from "../i18n";

interface MapHeaderProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
  onMenuOpen: () => void;
  logoSrc?: string;
  disclaimer: string;
  menuLabel: string;
  languageLabel: string;
  appName: string;
}

export default function MapHeader({
  language,
  onLanguageChange,
  onMenuOpen,
  logoSrc,
  disclaimer,
  menuLabel,
  languageLabel,
  appName,
}: MapHeaderProps) {
  return (
    <header
      dir="ltr"
      className="brand-header pointer-events-none fixed inset-x-0 top-0 z-[1200] h-[4.25rem] border-b border-[#FBB615]/30 bg-[#0F283C] shadow-[0_4px_22px_rgba(15,40,60,0.28)] md:h-20"
    >
      <div className="flex h-full w-full items-center gap-4 px-4 md:px-6">
        <div className="flex min-w-0 max-w-[calc(100%-148px)] items-center gap-3">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt=""
              className="h-12 w-12 shrink-0 object-contain"
            />
          ) : (
            <div
              aria-hidden="true"
              className="h-12 w-12 shrink-0 rounded-xl border border-slate-300 bg-slate-100"
            />
          )}
          <div className="min-w-0">
            <p className="header-brand-title truncate text-lg font-bold leading-tight md:text-xl">
              {appName}
            </p>
            <p className="header-brand-subtitle hidden truncate text-[11px] leading-tight sm:block">
              {disclaimer}
            </p>
          </div>
        </div>

        <div className="pointer-events-auto ml-auto flex items-center gap-2.5">
          <label className="header-control flex h-12 items-center rounded-xl border border-[#FBB615]/40 bg-[#0F283C] px-3 text-sm shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-[#FBB615]">
            <span className="sr-only">{languageLabel}</span>
            <select
              value={language}
              onChange={(event) =>
                onLanguageChange(event.target.value as Language)
              }
              aria-label={languageLabel}
              className="max-w-[100px] bg-transparent font-semibold outline-none"
            >
              {LANGUAGES.map((option) => (
                <option key={option} value={option}>
                  {languageLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={onMenuOpen}
            aria-label={menuLabel}
            className="header-control flex h-12 w-12 items-center justify-center rounded-xl border border-[#FBB615]/40 bg-[#0F283C] text-xl shadow-sm transition-colors hover:bg-[#173b55] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FBB615]"
          >
            <span aria-hidden="true">☰</span>
          </button>
        </div>
      </div>
    </header>
  );
}
