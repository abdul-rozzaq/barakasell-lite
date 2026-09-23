@AGENTS.md

# Tailwind CSS & Design System Guidelines

Loyihada **Tailwind CSS v4** ishlatilmoqda. Tailwind CSS Language Server / Linter ogohlantirishlarini (`tailwindcss(suggestCanonicalClasses)`) oldini olish va kod tozaligini saqlash uchun quyidagi qoidalarga qat'iy amal qiling:

---

## 1. Doimo Kanonik Mavzu Tokenlaridan (Theme Classes) Foydalaning

Ixtiyoriy (arbitrary) CSS o'zgaruvchilari sintaksisi (`[color:var(...)]`) **qat'iyan taqiqlanadi**.
Barcha ranglar `globals.css` dagi `@theme inline` orqali Tailwind tokenlariga bog'langan.

### To'g'ri va Noto'g'ri Variantlar:

| Noto'g'ri (Linter ogohlantiradi) | To'g'ri (Kanonik Tailwind class) | Maqsadi |
| :--- | :--- | :--- |
| `text-[color:var(--color-error-text)]` | `text-error-text` | Xatolik matni rangi |
| `border-[color:var(--color-error-border)]` | `border-error-border` | Xatolik hoshiyasi |
| `bg-[color:var(--color-error-bg)]` | `bg-error-bg` | Xatolik foni |
| `bg-[color:var(--color-error-text)]` | `bg-error-text` | Xato holatidagi tugma/badge foni |
| `text-[color:var(--color-warning-text)]` | `text-warning-text` | Ogohlantirish matni |
| `border-[color:var(--color-warning-border)]` | `border-warning-border` | Ogohlantirish hoshiyasi |
| `bg-[color:var(--color-warning-bg)]` | `bg-warning-bg` | Ogohlantirish foni |
| `text-[color:var(--color-success-text)]` | `text-success-text` | Muvaffaqiyat matni |
| `border-[color:var(--color-success-border)]` | `border-success-border` | Muvaffaqiyat hoshiyasi |
| `bg-[color:var(--color-accent-tint-bg)]` | `bg-accent-tint-bg` | Aktiv/tanlangan qator foni |
| `text-[color:var(--color-accent-tint-text)]` | `text-accent-tint-text` | Aktiv/tanlangan qator matni |
| `text-[color:var(--color-accent)]` | `text-accent` | Asosiy brend ko'k matni |
| `bg-[color:var(--color-accent)]` | `bg-accent` | Asosiy brend tugma foni |
| `hover:bg-[color:var(--color-accent-dark)]` | `hover:bg-accent-dark` | Tugma ustiga borgandagi rang |
| `border-[color:var(--color-divider)]` | `border-divider` | Standart ajratuvchi chiziq |
| `bg-[color:var(--color-surface)]` | `bg-surface` | Yuzalar foni |
| `bg-[color:var(--color-bg)]` | `bg-bg` | Umumiy sahifa foni |

---

## 2. Shaffoflik (Opacity / Alpha) Sintaksisi Qoidalari

1. **Standart foizlar uchun qisqa sintaksisdan foydalaning:**
   - ❌ Noto'g'ri: `bg-black/[.05]`, `bg-black/[0.05]`
   - ✅ To'g'ri: `bg-black/5`
   - Xuddi shunday: `text-text/50`, `text-text/60`, `text-text/70`, `bg-black/10`, `bg-black/20` va h.k.

2. **Nostandart foizlar (1%, 2%, 3%) uchun yetakchi noldan (leading zero) foydalaning:**
   - ❌ Noto'g'ri: `hover:bg-black/[.02]`, `hover:bg-black/[.03]`, `bg-black/[.01]` (Linter `suggestCanonicalClasses` chiqaradi)
   - ✅ To'g'ri: `hover:bg-black/[0.02]`, `hover:bg-black/[0.03]`, `bg-black/[0.01]`

---

## 3. Font va Radius Klasslari

- Standart font: `font-sans` (`var(--font-barlow)`)
- Qisqartirilgan sarlavhalar / tugmalar: `font-condensed` (`var(--font-barlow-condensed)`)
- To'g'ri burchakli (0 radius): `rounded-none` (default tizim qoidasi)
