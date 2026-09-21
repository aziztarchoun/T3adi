import { useEffect, useRef, useState } from "react";
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
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!languageMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        setLanguageMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLanguageMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [languageMenuOpen]);

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
          <div ref={languageMenuRef} className="relative">
            <button
              type="button"
              aria-label={languageLabel}
              aria-haspopup="menu"
              aria-expanded={languageMenuOpen}
              onClick={() => setLanguageMenuOpen((open) => !open)}
              className="header-control flex h-12 items-center gap-2 rounded-xl border border-[#FBB615]/40 bg-[#0F283C] px-3 text-sm font-semibold shadow-sm transition-colors hover:bg-[#173b55] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FBB615]"
            >
              <span>{languageLabels[language]}</span>
              <span aria-hidden="true" className="text-xs">
                {languageMenuOpen ? "▲" : "▼"}
              </span>
            </button>
            {languageMenuOpen && (
              <div
                role="menu"
                aria-label={languageLabel}
                className="absolute right-0 top-[calc(100%+0.5rem)] min-w-36 overflow-hidden rounded-xl border border-[#0F283C]/15 bg-[#F8F8F6] p-1 shadow-[0_12px_30px_rgba(15,40,60,0.22)]"
              >
                {LANGUAGES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="menuitemradio"
                    aria-checked={language === option}
                    onClick={() => {
                      onLanguageChange(option);
                      setLanguageMenuOpen(false);
                    }}
                    className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-start text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0F283C] ${
                      language === option
                        ? "bg-[#0F283C] font-bold text-[#FBB615]"
                        : "text-[#0F283C] hover:bg-[#0F283C]/10"
                    }`}
                  >
                    <span>{languageLabels[option]}</span>
                    {language === option && <span aria-hidden="true">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
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
