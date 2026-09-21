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
        <path d="M4 25 10 7m18 18L22 7" />
        <path d="M9 22c2-3 4-4 7-4s5 1 7 4c-3 2-5 3-7 3s-4-1-7-3Z" />
        <path d="M12 21c1.5.8 2.8.8 4 .1 1.2.7 2.5.7 4-.1" />
      </>
    ),
    blocked: (
      <>
        <path d="M4 25h24M8 25V9m16 16V9M5 9h22" />
        <path d="m8 5 16 8M8 13 24 5" />
        <path d="M8 17h16" />
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
