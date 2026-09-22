"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

type RoundingMode = "NONE" | "R10" | "R100" | "R1000";

interface Settings {
  allowNegativeStock: boolean;
  roundingMode: RoundingMode;
  lastClosedPeriodAt: string | null;
  storeName: string;
  loyaltyEnabled: boolean;
  loyaltyEarnPoints: number;
  loyaltyEarnPerSum: string;
  loyaltyPointValue: string;
  loyaltyMinRedeemPoints: number;
  loyaltyMaxRedeemPercent: number;
}

const ROUNDING_OPTIONS: { value: RoundingMode; label: string }[] = [
  { value: "NONE", label: "Yaxlitlanmaydi" },
  { value: "R10", label: "10 so'mgacha" },
  { value: "R100", label: "100 so'mgacha" },
  { value: "R1000", label: "1000 so'mgacha" },
];

type LoyaltyRuleField =
  | "loyaltyEarnPoints"
  | "loyaltyEarnPerSum"
  | "loyaltyPointValue"
  | "loyaltyMinRedeemPoints"
  | "loyaltyMaxRedeemPercent";

// PATCH sends plain numbers for the Decimal fields; GET returns them
// serialized as strings (like every other Decimal in this API).
type SettingsPatch = Partial<Omit<Settings, "loyaltyEarnPerSum" | "loyaltyPointValue">> & {
  loyaltyEarnPerSum?: number;
  loyaltyPointValue?: number;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loyaltyForm, setLoyaltyForm] = useState<Record<LoyaltyRuleField, string> | null>(null);

  useEffect(() => {
    api
      .get<Settings>("/settings")
      .then((s) => {
        setSettings(s);
        setLoyaltyForm({
          loyaltyEarnPoints: String(s.loyaltyEarnPoints),
          loyaltyEarnPerSum: String(s.loyaltyEarnPerSum),
          loyaltyPointValue: String(s.loyaltyPointValue),
          loyaltyMinRedeemPoints: String(s.loyaltyMinRedeemPoints),
          loyaltyMaxRedeemPercent: String(s.loyaltyMaxRedeemPercent),
        });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi"));
  }, []);

  async function update(patch: SettingsPatch) {
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

  async function saveLoyaltyRules() {
    if (!loyaltyForm) return;
    await update({
      loyaltyEarnPoints: Number(loyaltyForm.loyaltyEarnPoints),
      loyaltyEarnPerSum: Number(loyaltyForm.loyaltyEarnPerSum),
      loyaltyPointValue: Number(loyaltyForm.loyaltyPointValue),
      loyaltyMinRedeemPoints: Number(loyaltyForm.loyaltyMinRedeemPoints),
      loyaltyMaxRedeemPercent: Number(loyaltyForm.loyaltyMaxRedeemPercent),
    });
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

      <div className="border border-divider bg-white p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-medium">Loyalty (ball) dasturi</div>
            <div className="text-sm text-text/60">Mijozlar xariddan ball to&apos;plab, keyin chegirmaga aylantirishi</div>
          </div>
          <button
            onClick={() => update({ loyaltyEnabled: !settings.loyaltyEnabled })}
            disabled={saving}
            className={`h-7 w-12 relative transition-colors ${
              settings.loyaltyEnabled ? "bg-accent" : "bg-divider"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 bg-white transition-transform ${
                settings.loyaltyEnabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {loyaltyForm && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="flex flex-col gap-1">
              Har necha so&apos;mga
              <input
                type="number"
                className="h-9 px-2 border border-divider"
                value={loyaltyForm.loyaltyEarnPerSum}
                onChange={(e) => setLoyaltyForm({ ...loyaltyForm, loyaltyEarnPerSum: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1">
              Necha ball beriladi
              <input
                type="number"
                className="h-9 px-2 border border-divider"
                value={loyaltyForm.loyaltyEarnPoints}
                onChange={(e) => setLoyaltyForm({ ...loyaltyForm, loyaltyEarnPoints: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1">
              1 ball necha so&apos;m (chegirmada)
              <input
                type="number"
                className="h-9 px-2 border border-divider"
                value={loyaltyForm.loyaltyPointValue}
                onChange={(e) => setLoyaltyForm({ ...loyaltyForm, loyaltyPointValue: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1">
              Kamida nechta ball ishlatish mumkin
              <input
                type="number"
                className="h-9 px-2 border border-divider"
                value={loyaltyForm.loyaltyMinRedeemPoints}
                onChange={(e) => setLoyaltyForm({ ...loyaltyForm, loyaltyMinRedeemPoints: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 col-span-2">
              Sotuvning necha foizigacha ball bilan yopish mumkin
              <input
                type="number"
                className="h-9 px-2 border border-divider max-w-40"
                value={loyaltyForm.loyaltyMaxRedeemPercent}
                onChange={(e) => setLoyaltyForm({ ...loyaltyForm, loyaltyMaxRedeemPercent: e.target.value })}
              />
            </label>
          </div>
        )}
        <button
          onClick={saveLoyaltyRules}
          disabled={saving}
          className="h-9 px-4 mt-3 bg-accent text-white text-sm disabled:opacity-40"
        >
          Qoidalarni saqlash
        </button>
      </div>

      <div className="border border-divider bg-white p-5 mb-5">
        <div className="font-medium mb-1">Telegram bot</div>
        <div className="text-sm text-text/60 mb-3">
          Botga ulanib, hisobotlarni va bildirishnomalarni Telegram orqali oling.
        </div>
        <TelegramLinkButton />
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

function TelegramLinkButton() {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ code: string }>("/users/me/telegram-link-code");
      setCode(res.code);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  }

  if (code) {
    return (
      <div className="text-sm">
        <div className="mb-1">
          Botga shu buyruqni yuboring (10 daqiqa amal qiladi):
        </div>
        <div className="font-condensed text-xl font-bold tracking-wider bg-surface inline-block px-3 py-1">
          /link {code}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={generate}
        disabled={loading}
        className="h-9 px-4 bg-accent text-white text-sm disabled:opacity-40"
      >
        Telegram&apos;ga ulash
      </button>
      {error && <div className="mt-2 text-sm text-[color:var(--color-error-text)]">{error}</div>}
    </div>
  );
}
