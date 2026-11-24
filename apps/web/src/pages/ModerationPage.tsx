import { useCallback, useEffect, useRef, useState } from "react";
import type { OpenFlagDto } from "@road-safety-map/shared";
import {
  dismissReportFlags,
  fetchOpenFlags,
  hideReport,
  unhideReport,
} from "../api/reports";
import { getPhotoFullUrl } from "../api/reports";
import { translations, type Language } from "../i18n";

const TOKEN_KEY = "t3adi-moderator-token";

interface ModerationPageProps {
  language: Language;
}

function FlagCard({
  flag,
  token,
  copy,
  onAction,
}: {
  flag: OpenFlagDto;
  token: string;
  copy: (typeof translations)[Language];
  onAction: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [enlargedPhoto, setEnlargedPhoto] = useState(false);
  const photoUrl = getPhotoFullUrl(flag.reportPhotoUrl);

  const severityColors: Record<string, string> = {
    safe: "bg-emerald-100 text-emerald-800",
    caution: "bg-amber-100 text-amber-800",
    dangerous: "bg-red-100 text-red-800",
    blocked: "bg-slate-800 text-white",
  };

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      onAction();
    } finally {
      setBusy(false);
    }
  }

  const reasonLabels: Record<string, string> = {
    inaccurate: "Inaccurate",
    spam: "Spam",
    offensive: "Offensive",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* Header row */}
      <div className="mb-3 flex flex-wrap items-start gap-2">
        <span
          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${severityColors[flag.reportSeverity] ?? "bg-slate-100 text-slate-700"}`}
        >
          {copy.severityLabel[
            flag.reportSeverity as keyof typeof copy.severityLabel
          ] ?? flag.reportSeverity}
        </span>
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
          {copy.type[flag.reportType as keyof typeof copy.type] ??
            flag.reportType}
        </span>
        <span className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
          {copy.flagsCount}: {flag.flagCount}
        </span>
        <span className="ml-auto rounded-lg border border-dashed border-slate-300 px-2.5 py-1 text-xs text-slate-500">
          {flag.reason in reasonLabels
            ? reasonLabels[flag.reason]
            : flag.reason}
        </span>
      </div>

      {/* Description */}
      {flag.reportDescription && (
        <p className="mb-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {flag.reportDescription}
        </p>
      )}

      {/* Photo thumbnail */}
      {photoUrl && (
        <div className="mb-3">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setEnlargedPhoto(true)}
            onKeyDown={(e) => e.key === "Enter" && setEnlargedPhoto(true)}
            className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
          >
            <img
              src={photoUrl}
              alt={copy.photoProof}
              className="h-36 w-full object-cover transition group-hover:scale-105"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition group-hover:opacity-100">
              <span className="rounded-lg bg-black/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                🔍 {copy.clickToEnlarge}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Status badge */}
      <p className="mb-3 text-xs text-slate-400">
        {new Date(flag.createdAt).toLocaleString()} · status:{" "}
        <span className="font-semibold text-slate-600">
          {flag.reportStatus}
        </span>
      </p>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {flag.reportStatus !== "hidden" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => hideReport(flag.reportId, token))}
            className="min-h-10 rounded-xl bg-red-600 px-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {copy.hideReport}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => unhideReport(flag.reportId, token))}
            className="min-h-10 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {copy.unhideReport}
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => act(() => dismissReportFlags(flag.reportId, token))}
          className="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
        >
          {copy.dismissFlags}
        </button>
      </div>

      {/* Enlarged photo lightbox */}
      {enlargedPhoto && photoUrl && (
        <div
          role="presentation"
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setEnlargedPhoto(false)}
        >
          <img
            src={photoUrl}
            alt={copy.photoProof}
            className="max-h-[90vh] max-w-full rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}

export default function ModerationPage({ language }: ModerationPageProps) {
  const copy = translations[language];
  const [token, setToken] = useState<string>(() => {
    try {
      return sessionStorage.getItem(TOKEN_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [tokenInput, setTokenInput] = useState("");
  const [authError, setAuthError] = useState(false);
  const [flags, setFlags] = useState<OpenFlagDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const load = useCallback(async (tok: string) => {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchOpenFlags(tok);
      setFlags(data);
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setAuthError(true);
        setToken("");
        try {
          sessionStorage.removeItem(TOKEN_KEY);
        } catch {
          // ignore
        }
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      void load(token);
    }
  }, [token, load]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const t = tokenInput.trim();
    if (!t) return;
    setAuthError(false);
    try {
      sessionStorage.setItem(TOKEN_KEY, t);
    } catch {
      // ignore
    }
    setToken(t);
  }

  const isRtl = language === "ar";

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div
        dir={isRtl ? "rtl" : "ltr"}
        className="flex min-h-screen items-center justify-center bg-slate-50 p-4"
      >
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
          <h1 className="mb-4 text-xl font-bold text-slate-900">
            {copy.moderation}
          </h1>
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <label
              htmlFor="mod-token"
              className="text-sm font-semibold text-slate-700"
            >
              {copy.moderatorTokenLabel}
            </label>
            <input
              id="mod-token"
              type="password"
              autoComplete="current-password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder={copy.moderatorTokenPrompt}
              className="min-h-11 rounded-xl border border-slate-200 px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            />
            {authError && (
              <p className="text-sm text-red-600">{copy.moderatorTokenError}</p>
            )}
            <button
              type="submit"
              className="min-h-11 rounded-xl bg-slate-900 font-semibold text-white transition hover:bg-slate-700"
            >
              {copy.moderatorTokenSubmit}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Logged in ──────────────────────────────────────────────────────────────
  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-slate-50 pb-16">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <h1 className="text-lg font-bold text-slate-900">{copy.moderation}</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load(token)}
            disabled={loading}
            className="min-h-9 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
          >
            ↻
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.removeItem(TOKEN_KEY);
              } catch {
                // ignore
              }
              setToken("");
              setTokenInput("");
              setFlags([]);
            }}
            className="min-h-9 rounded-xl bg-slate-100 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            ✕
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-6">
        {loading && (
          <p className="text-center text-slate-500">{copy.moderationLoading}</p>
        )}
        {error && !loading && (
          <p className="text-center text-red-600">{copy.moderationError}</p>
        )}
        {!loading && !error && flags.length === 0 && (
          <p className="text-center text-slate-500">{copy.noFlags}</p>
        )}
        {!loading && !error && flags.length > 0 && (
          <>
            <p className="mb-4 text-sm text-slate-500">
              {flags.length} {copy.flaggedReports}
            </p>
            <div className="flex flex-col gap-4">
              {flags.map((flag) => (
                <FlagCard
                  key={flag.id}
                  flag={flag}
                  token={token}
                  copy={copy}
                  onAction={() => void load(token)}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
