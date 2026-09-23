# Barakasell Lite — Engineering Guidelines

Loyihada **Tailwind CSS v4** ishlatilmoqda. `tailwindcss(suggestCanonicalClasses)` linter ogohlantirishlarini oldini olish va frontend kodining tozaligini saqlash uchun quyidagi qoidalarga amal qilinadi.

Batafsil ma'lumot: [`apps/admin/CLAUDE.md`](file:///C:/Users/Abdurazzoq/Desktop/PrivateProjects/barakasell-lite/apps/admin/CLAUDE.md)

---

## Tailwind CSS Kanonik Qoidalari

1. **Arbitrary CSS o'zgaruvchilari ishlatilmaydi (`[color:var(...)]`)**:
   - ❌ `text-[color:var(--color-error-text)]` -> ✅ `text-error-text`
   - ❌ `border-[color:var(--color-error-border)]` -> ✅ `border-error-border`
   - ❌ `bg-[color:var(--color-error-bg)]` -> ✅ `bg-error-bg`
   - ❌ `bg-[color:var(--color-accent-tint-bg)]` -> ✅ `bg-accent-tint-bg`
   - ❌ `text-[color:var(--color-accent-tint-text)]` -> ✅ `text-accent-tint-text`
   - ❌ `text-[color:var(--color-warning-text)]` -> ✅ `text-warning-text`
   - ❌ `border-[color:var(--color-warning-border)]` -> ✅ `border-warning-border`
   - ❌ `bg-[color:var(--color-warning-bg)]` -> ✅ `bg-warning-bg`
   - ❌ `text-[color:var(--color-success-text)]` -> ✅ `text-success-text`
   - ❌ `border-[color:var(--color-success-border)]` -> ✅ `border-success-border`

2. **Shaffoflik (Opacity) sintaksisi**:
   - Standart foizlar uchun slash sintaksisi: `bg-black/5` (not `bg-black/[.05]`)
   - Nostandart foizlar uchun yetakchi nol majburiy: `bg-black/[0.02]` (not `bg-black/[.02]`)
