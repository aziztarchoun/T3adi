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
        className={`fixed right-0 top-0 z-[1500] h-full w-64 transform bg-white shadow-lg transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b p-4">
          <span className="font-medium text-gray-900">{copy.appName}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-xl text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <nav className="flex flex-col p-2">
          <button
            type="button"
            onClick={() => setShowAbout(true)}
            className="min-h-11 rounded px-3 py-2 text-start text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
          >
            {copy.about}
          </button>

          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center rounded px-3 py-2 text-start text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
          >
            {copy.github}
          </a>

          <a
            href={`${GITHUB_REPO_URL}/issues/new`}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center rounded px-3 py-2 text-start text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
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
            className="max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2
                id="about-title"
                className="text-lg font-medium text-gray-900"
              >
                {copy.about}
              </h2>
              <button
                type="button"
                onClick={() => setShowAbout(false)}
                aria-label={copy.close}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            <p className="mb-3 text-sm text-gray-700">{copy.aboutText}</p>
            <p className="mb-4 text-sm text-gray-700">{copy.communityNotice}</p>
          </div>
        </div>
      )}
    </>
  );
}
