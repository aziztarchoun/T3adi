import { useEffect, useState } from "react";
import { type Language, translations } from "../i18n";

const GITHUB_REPO_URL = "https://github.com/aziztarchoun/T3adi";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  language: Language;
  onSelectTestLocation?: (loc: { lat: number; lng: number }) => void;
  onOpenModeration?: () => void;
}

const TEST_LOCATIONS = [
  { name: "Tunis (Centre-Ville)", lat: 36.8065, lng: 10.1815 },
  { name: "Ariana / Ennasr", lat: 36.8665, lng: 10.1647 },
  { name: "La Marsa", lat: 36.8782, lng: 10.3247 },
  { name: "Sousse", lat: 35.8256, lng: 10.6369 },
  { name: "Sfax", lat: 34.7406, lng: 10.7603 },
] as const;

export default function Sidebar({
  open,
  onClose,
  language,
  onSelectTestLocation,
  onOpenModeration,
}: SidebarProps) {
  const [showAbout, setShowAbout] = useState(false);
  const copy = translations[language];

  useEffect(() => {
    if (!open && !showAbout) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (showAbout) {
        setShowAbout(false);
      } else {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open, showAbout]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[1400] bg-black/30"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <aside
        aria-label={copy.menu}
        aria-hidden={!open}
        dir={language === "ar" ? "rtl" : "ltr"}
        className={`t3adi-sidebar fixed right-0 top-0 z-[1500] h-full w-64 transform overflow-y-auto text-[#F8F8F6] shadow-[0_0_28px_rgba(15,40,60,0.35)] transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="t3adi-sidebar-header flex items-center justify-between p-4">
          <span className="font-bold text-[#FBB615]">{copy.appName}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-xl text-[#FBB615] transition-colors hover:bg-[#FBB615]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FBB615]"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <nav className="flex flex-col p-2">
          <button
            type="button"
            onClick={() => setShowAbout(true)}
            className="min-h-11 rounded-lg px-3 py-2 text-start text-[#F8F8F6] transition-colors hover:bg-[#FBB615]/15 hover:text-[#FBB615] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FBB615]"
          >
            {copy.about}
          </button>

          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center rounded-lg px-3 py-2 text-start text-[#F8F8F6] transition-colors hover:bg-[#FBB615]/15 hover:text-[#FBB615] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FBB615]"
          >
            {copy.github}
          </a>

          <a
            href={`${GITHUB_REPO_URL}/issues/new`}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center rounded-lg px-3 py-2 text-start text-[#F8F8F6] transition-colors hover:bg-[#FBB615]/15 hover:text-[#FBB615] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FBB615]"
          >
            {copy.reportSiteIssue}
          </a>

          <button
            type="button"
            onClick={() => {
              onOpenModeration?.();
              onClose();
            }}
            className="min-h-11 rounded-lg px-3 py-2 text-start text-[#F8F8F6]/60 transition-colors hover:bg-[#FBB615]/10 hover:text-[#FBB615]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FBB615] text-sm"
          >
            🔒 {copy.moderation}
          </button>
        </nav>

        {/* Quick Test Locations section to bypass browser GPS glitches or test anywhere in Tunisia */}
        <div className="border-t border-[#FBB615]/20 p-2 mt-2">
          <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#FBB615]">
            {copy.testLocations}
          </p>
          <div className="flex flex-col gap-1">
            {TEST_LOCATIONS.map((loc) => (
              <button
                key={loc.name}
                type="button"
                onClick={() => {
                  onSelectTestLocation?.(loc);
                  onClose();
                }}
                className="flex min-h-10 items-center rounded-lg px-3 py-1.5 text-start text-sm text-[#F8F8F6] transition-colors hover:bg-[#FBB615]/15 hover:text-[#FBB615] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FBB615]"
              >
                📍 {loc.name}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* About panel — a simple overlay, not a separate route, so the map
          stays the actual home page at all times. */}
      {showAbout && (
        <div
          role="presentation"
          className="fixed inset-0 z-[1600] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowAbout(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={copy.about}
            className="max-h-[calc(100vh-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3">
              <h2 className="text-xl font-bold text-slate-900">{copy.about}</h2>
              <button
                type="button"
                onClick={() => setShowAbout(false)}
                aria-label={copy.close}
                className="flex h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 px-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                <span aria-hidden="true" className="text-xl leading-none">
                  ✕
                </span>
              </button>
            </div>
            <p className="mt-2 text-slate-700">{copy.aboutText}</p>
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              {copy.communityNotice}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
