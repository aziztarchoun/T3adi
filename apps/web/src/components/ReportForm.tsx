import { useState } from "react";
import {
  REPORT_SEVERITIES,
  REPORT_TYPES,
  type CreateReportInput,
} from "@road-safety-map/shared";
import { type Language, translations } from "../i18n";

interface ReportFormProps {
  onSubmit: (input: CreateReportInput) => Promise<void>;
  onCancel: () => void;
  defaultLat: number;
  defaultLng: number;
  language: Language;
}

const typeOptions = [
  { value: "flooding", icon: "flooding" },
  { value: "pothole", icon: "pothole" },
  { value: "blocked", icon: "blocked" },
  { value: "accident_obstacle", icon: "accident" },
  { value: "other", icon: "other" },
] as const;

function HazardIcon({ type }: { type: (typeof typeOptions)[number]["icon"] }) {
  const paths = {
    flooding: (
      <>
        <path d="M3 9c2.2-2 4.2-2 6.4 0s4.2 2 6.4 0 4.2-2 6.4 0 4.2 2 6.4 0" />
        <path d="M3 15c2.2-2 4.2-2 6.4 0s4.2 2 6.4 0 4.2-2 6.4 0 4.2 2 6.4 0" />
        <path d="M3 21c2.2-2 4.2-2 6.4 0s4.2 2 6.4 0 4.2-2 6.4 0 4.2 2 6.4 0" />
      </>
    ),
    pothole: (
      <>
        <path d="M8 5h16l5 22H3L8 5Z" />
        <ellipse
          cx="16"
          cy="20"
          rx="5.5"
          ry="3.2"
          fill="currentColor"
          stroke="none"
        />
        <path d="M11 20c1.8 1.3 3.2 1.3 5 0 1.8 1.3 3.2 1.3 5 0" />
      </>
    ),
    blocked: (
      <>
        <path d="M4 26h24M8 26V9m16 17V9" />
        <path d="M5 9h22v8H5Z" />
        <path d="m8 9 8 8m0-8-8 8m8-8 8 8m0-8-8 8" />
      </>
    ),
    accident: (
      <>
        <path d="m16 3 13 24H3L16 3Z" />
        <path d="M16 11v7m0 4h.01" />
      </>
    ),
    other: (
      <>
        <path d="M16 28s9-8.2 9-15A9 9 0 1 0 7 13c0 6.8 9 15 9 15Z" />
        <circle cx="16" cy="13" r="3" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6 shrink-0"
      fill="none"
      viewBox="0 0 32 32"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.75"
    >
      {paths[type]}
    </svg>
  );
}

const severityClasses: Record<string, string> = {
  safe: "border-emerald-600 bg-emerald-600 text-white",
  caution: "border-yellow-400 bg-yellow-400 text-slate-900",
  dangerous: "border-red-600 bg-red-600 text-white",
  blocked: "border-slate-900 bg-slate-900 text-white",
};

export default function ReportForm({
  onSubmit,
  onCancel,
  defaultLat,
  defaultLng,
  language,
}: ReportFormProps) {
  const copy = translations[language];
  const [type, setType] = useState<(typeof REPORT_TYPES)[number]>("pothole");
  const [severity, setSeverity] =
    useState<(typeof REPORT_SEVERITIES)[number]>("safe");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit({
        lat: defaultLat,
        lng: defaultLng,
        type,
        severity,
        description: description.trim() || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-t-[28px] bg-white p-4 pb-5 shadow-[0_-8px_30px_rgba(15,23,42,0.12)]"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-900">
          {copy.reportTitle}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label={copy.close}
          className="flex h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 px-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          <span aria-hidden="true" className="text-xl leading-none">
            ✕
          </span>
        </button>
      </div>

      <div className="mb-4">
        <p className="mb-2 text-sm font-medium text-slate-800">
          {copy.hazardType}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {typeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-label={copy.type[option.value]}
              aria-pressed={type === option.value}
              onClick={() => setType(option.value)}
              className={`flex min-h-[52px] items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                type === option.value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              <HazardIcon type={option.icon} />
              <span>{copy.type[option.value]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <p className="mb-2 text-sm font-medium text-slate-800">
          {copy.severity}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {REPORT_SEVERITIES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={severity === option}
              onClick={() => setSeverity(option)}
              className={`min-h-[52px] rounded-xl border px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                severity === option
                  ? severityClasses[option]
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              {copy.severityLabel[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label
          htmlFor="report-description"
          className="mb-2 block text-sm font-medium text-slate-800"
        >
          {copy.description}
        </label>
        <textarea
          id="report-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          maxLength={200}
          placeholder={copy.descriptionPlaceholder}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base text-slate-800 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-slate-900 px-4 py-3 text-base font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? copy.submitting : copy.submit}
      </button>
    </form>
  );
}
