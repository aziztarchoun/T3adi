import { useEffect, useRef, useState } from "react";
import {
  REPORT_SEVERITIES,
  REPORT_TYPES,
  type CreateReportInput,
} from "@road-safety-map/shared";
import { uploadReportPhoto } from "../api/reports";
import { type Language, translations } from "../i18n";

interface ReportFormProps {
  onSubmit: (input: CreateReportInput) => Promise<void>;
  onCancel: () => void;
  defaultLat: number;
  defaultLng: number;
  language: Language;
  onAdjustLocation: () => void;
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

function StepIcon({
  kind,
}: {
  kind: "type" | "severity" | "evidence" | "review";
}) {
  const paths = {
    type: <path d="M5 7h14M5 12h14M5 17h9" />,
    severity: <path d="M12 4 21 20H3L12 4Zm0 6v4m0 3h.01" />,
    evidence: (
      <>
        <path d="M5 7h4l1.5-2h3L15 7h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
        <circle cx="12" cy="13" r="3" />
      </>
    ),
    review: <path d="m5 12 4 4L19 6" />,
  };

  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.25"
    >
      {paths[kind]}
    </svg>
  );
}

const choiceChipClasses =
  "report-choice-chip flex min-h-[58px] items-center gap-2 rounded-xl border px-3 py-2 text-start text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#03ab82]";

function ChoiceButton({
  group,
  value,
  selected,
  label,
  onSelect,
  centered = false,
  children,
}: {
  group: string;
  value: string;
  selected: boolean;
  label: string;
  onSelect: () => void;
  centered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      data-choice-group={group}
      data-choice-value={value}
      onClick={onSelect}
      className={`${choiceChipClasses} ${centered ? "justify-center" : ""} ${
        selected
          ? "report-choice-chip-selected"
          : "report-choice-chip-unselected"
      }`}
    >
      {children}
    </button>
  );
}

export default function ReportForm({
  onSubmit,
  onCancel,
  defaultLat,
  defaultLng,
  language,
  onAdjustLocation,
}: ReportFormProps) {
  const copy = translations[language];
  const [type, setType] = useState<(typeof REPORT_TYPES)[number]>("pothole");
  // Default to 'caution' as the sensible default when signaling a road issue
  const [severity, setSeverity] =
    useState<(typeof REPORT_SEVERITIES)[number]>("caution");
  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  function handlePhotoSelect(event: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null);
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadError(copy.photoTooLarge);
      return;
    }
    setPhotoFile(file);
  }

  function handleRemovePhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setUploadError(null);

    try {
      let photoUrl: string | undefined = undefined;
      if (photoFile) {
        try {
          photoUrl = await uploadReportPhoto(photoFile);
        } catch {
          setUploadError(copy.photoUploadError);
          setIsSubmitting(false);
          return;
        }
      }

      await onSubmit({
        lat: defaultLat,
        lng: defaultLng,
        type,
        severity,
        description: description.trim() || undefined,
        photoUrl,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-h-[calc(100dvh-1.5rem)] flex-col rounded-[28px] bg-white shadow-[0_-8px_30px_rgba(15,23,42,0.12)]"
    >
      <div className="border-b border-slate-200/80 bg-gradient-to-b from-[#03ab82]/10 to-transparent p-4 pb-3">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {copy.reportTitle}
            </h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {step < 4 ? `${copy.step} ${step}/3` : copy.reviewReport}
            </p>
          </div>
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
        <div className="mt-3 grid grid-cols-4 gap-1" aria-hidden="true">
          {(["type", "severity", "evidence", "review"] as const).map(
            (kind, index) => (
              <div
                key={kind}
                className={`h-1 rounded-full ${index + 1 <= step ? "bg-[#03ab82]" : "bg-slate-200"}`}
              />
            ),
          )}
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto p-4 pt-4">
        {step === 1 && (
          <section aria-labelledby="report-step-type">
            <p
              id="report-step-type"
              className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#03ab82]/10 text-[#087f68]">
                <StepIcon kind="type" />
              </span>
              {copy.hazardType}
            </p>
            <div
              className="grid grid-cols-2 gap-2"
              role="radiogroup"
              aria-label={copy.hazardType}
            >
              {typeOptions.map((option) => (
                <ChoiceButton
                  key={option.value}
                  group="report-type"
                  value={option.value}
                  selected={type === option.value}
                  label={copy.type[option.value]}
                  onSelect={() => setType(option.value)}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-[#0f283c]">
                    <HazardIcon type={option.icon} />
                  </span>
                  <span>{copy.type[option.value]}</span>
                </ChoiceButton>
              ))}
            </div>
          </section>
        )}

        {step === 2 && (
          <section aria-labelledby="report-step-severity">
            <p
              id="report-step-severity"
              className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-100 text-amber-700">
                <StepIcon kind="severity" />
              </span>
              {copy.severity}
            </p>
            <div
              className="grid grid-cols-2 gap-2"
              role="radiogroup"
              aria-label={copy.severity}
            >
              {REPORT_SEVERITIES.map((option) => (
                <ChoiceButton
                  key={option}
                  group="report-severity"
                  value={option}
                  selected={severity === option}
                  label={copy.severityLabel[option]}
                  onSelect={() => setSeverity(option)}
                  centered
                >
                  <span
                    aria-hidden="true"
                    className={`severity-chip-dot severity-${option}`}
                  />
                  {copy.severityLabel[option]}
                </ChoiceButton>
              ))}
            </div>
          </section>
        )}

        {step === 3 && (
          <section aria-labelledby="report-step-evidence">
            <p
              id="report-step-evidence"
              className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-100 text-sky-700">
                <StepIcon kind="evidence" />
              </span>
              {copy.photoProof} &amp; {copy.description}
            </p>
            {photoPreview ? (
              <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
                <img
                  src={photoPreview}
                  alt={copy.photoProof}
                  className="h-28 w-full rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute right-3 top-3 rounded-lg bg-black/70 px-2.5 py-1 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {copy.removePhoto}
                </button>
              </div>
            ) : (
              <label className="flex min-h-[52px] cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800">
                <span>{copy.addPhoto}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="sr-only"
                  onChange={handlePhotoSelect}
                />
              </label>
            )}
            {uploadError && (
              <p className="mt-1.5 text-xs text-red-600">{uploadError}</p>
            )}
            <label
              htmlFor="report-description"
              className="mb-2 mt-4 block text-sm font-semibold text-slate-800"
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
            <p
              className="mt-1 text-end text-xs text-slate-500"
              aria-live="polite"
            >
              {copy.characterCount}: {description.length}/200
            </p>
          </section>
        )}

        {step === 4 && (
          <section aria-labelledby="report-review-title">
            <p
              id="report-review-title"
              className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                <StepIcon kind="review" />
              </span>
              {copy.reviewReport}
            </p>
            <dl className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt>{copy.hazardType}</dt>
                <dd className="font-semibold">{copy.type[type]}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>{copy.severity}</dt>
                <dd className="font-semibold">
                  {copy.severityLabel[severity]}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>{copy.reportLocation}</dt>
                <dd className="text-end font-semibold">
                  {defaultLat.toFixed(5)}, {defaultLng.toFixed(5)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>{copy.photoProof}</dt>
                <dd className="font-semibold">
                  {photoFile ? copy.addPhoto : copy.noPhoto}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>{copy.description}</dt>
                <dd className="max-w-[60%] text-end font-semibold">
                  {description.trim() || copy.noDescription}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={onAdjustLocation}
              className="mt-3 min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              {copy.adjustLocation}
            </button>
          </section>
        )}
      </div>
      <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 p-4 backdrop-blur">
        <div className="flex gap-2">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((value) => (value - 1) as 1 | 2 | 3 | 4)}
              className="min-h-12 flex-1 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              {copy.back}
            </button>
          )}
          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((value) => (value + 1) as 1 | 2 | 3 | 4)}
              className="min-h-12 flex-1 rounded-xl bg-[#03ab82] px-4 text-base font-bold text-white shadow-[0_4px_12px_rgba(3,171,130,0.25)] hover:bg-[#087f68] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#03ab82]"
            >
              {copy.next}
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-12 flex-1 rounded-xl bg-[#03ab82] px-4 text-base font-bold text-white shadow-[0_4px_12px_rgba(3,171,130,0.25)] hover:bg-[#087f68] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#03ab82] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting
                ? photoFile
                  ? copy.photoUploading
                  : copy.submitting
                : copy.confirmReport}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
