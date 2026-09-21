import { useEffect, useState } from "react";
import { type Language, translations } from "../i18n";

const GITHUB_REPO_URL = "https://github.com/aziztarchoun/T3adi";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  language: Language;
}

export default function Sidebar({ open, onClose, language }: SidebarProps) {
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
        className={`t3adi-sidebar fixed right-0 top-0 z-[1500] h-full w-64 transform text-[#F8F8F6] shadow-[0_0_28px_rgba(15,40,60,0.35)] transition-transform duration-200 ${
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
        </nav>
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
            aria-labelledby="about-title"
            className="t3adi-sidebar max-w-md rounded-2xl p-6 text-[#F8F8F6] shadow-[0_12px_30px_rgba(15,40,60,0.35)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 id="about-title" className="text-lg font-bold text-[#FBB615]">
                {copy.about}
              </h2>
              <button
                type="button"
                onClick={() => setShowAbout(false)}
                aria-label={copy.close}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl text-[#FBB615] transition-colors hover:bg-[#FBB615]/15 hover:text-[#FBB615] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FBB615]"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            <p className="mb-3 text-sm text-[#F8F8F6]/85">{copy.aboutText}</p>
            <p className="mb-4 text-sm text-[#F8F8F6]/85">
              {copy.communityNotice} 
            </p>
            <p className="text-xs text-[#F8F8F6]/85">
              By Aziz Tarchoun
            </p>
          </div>
        </div>
      )}
    </>
  );
}
