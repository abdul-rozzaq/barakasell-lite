"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

type RoundingMode = "NONE" | "R10" | "R100" | "R1000";

interface Settings {
  allowNegativeStock: boolean;
  roundingMode: RoundingMode;
  lastClosedPeriodAt: string | null;
  storeName: string;
}

const ROUNDING_OPTIONS: { value: RoundingMode; label: string }[] = [
  { value: "NONE", label: "Yaxlitlanmaydi" },
  { value: "R10", label: "10 so'mgacha" },
  { value: "R100", label: "100 so'mgacha" },
  { value: "R1000", label: "1000 so'mgacha" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<Settings>("/settings")
      .then(setSettings)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi"));
  }, []);

  async function update(patch: Partial<Pick<Settings, "allowNegativeStock" | "roundingMode">>) {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.patch<Settings>("/settings", patch);
      setSettings(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  if (error && !settings) {
    return <div className="p-6 text-[color:var(--color-error-text)]">{error}</div>;
  }
  if (!settings) {
    return <div className="p-6 text-text/60">Yuklanmoqda...</div>;
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="font-condensed text-2xl font-bold mb-5">Sozlamalar</h1>

      <div className="border border-divider bg-white p-5 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Manfiy qoldiqqa ruxsat</div>
            <div className="text-sm text-text/60">Qoldiq tugagan tovarni sotishga ruxsat berish</div>
          </div>
          <button
            onClick={() => update({ allowNegativeStock: !settings.allowNegativeStock })}
            disabled={saving}
            className={`h-7 w-12 relative transition-colors ${
              settings.allowNegativeStock ? "bg-accent" : "bg-divider"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 bg-white transition-transform ${
                settings.allowNegativeStock ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="border border-divider bg-white p-5 mb-5">
        <div className="font-medium mb-3">Summalarni yaxlitlash</div>
        <div className="flex flex-col gap-2">
          {ROUNDING_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                checked={settings.roundingMode === opt.value}
                onChange={() => update({ roundingMode: opt.value })}
                disabled={saving}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div className="border border-divider bg-white p-5">
        <div className="font-medium mb-1">Davrni yopish</div>
        <div className="text-sm text-text/60 mb-3">
          {settings.lastClosedPeriodAt
            ? `Oxirgi yopilgan davr: ${new Date(settings.lastClosedPeriodAt).toLocaleDateString("uz-UZ")}`
            : "Hali davr yopilmagan"}
        </div>
        <button disabled className="h-10 px-4 border border-divider text-sm text-text/40 cursor-not-allowed" title="Keyingi bosqichda">
          Davrni yopish (keyingi bosqichda)
        </button>
      </div>

      {error && <div className="mt-4 text-sm text-[color:var(--color-error-text)]">{error}</div>}
    </div>
  );
}
