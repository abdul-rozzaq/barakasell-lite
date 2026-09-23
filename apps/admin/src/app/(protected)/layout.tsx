"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/products", label: "Tovarlar" },
  { href: "/categories", label: "Kategoriyalar" },
  { href: "/receipts", label: "Kirimlar" },
  { href: "/suppliers", label: "Yetkazib beruvchilar" },
  { href: "/sales", label: "Sotuvlar" },
  { href: "/customers", label: "Mijozlar" },
  { href: "/reports", label: "Hisobotlar" },
  { href: "/audit", label: "Audit" },
  { href: "/users", label: "Foydalanuvchilar" },
  { href: "/settings", label: "Sozlamalar" },
];

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="flex flex-1 items-center justify-center text-text/60">Yuklanmoqda...</div>;
  }

  if (user.role !== "ADMIN") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <div className="font-condensed text-2xl font-bold">Ruxsat yo&apos;q</div>
        <div className="text-sm text-text/60">Bu panel faqat do&apos;kon egasi uchun.</div>
        <button onClick={logout} className="mt-2 text-accent hover:underline text-sm">
          Chiqish
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1">
      <aside className="w-56 shrink-0 border-r border-divider bg-sidebar flex flex-col">
        <div className="h-14 flex items-center px-5 border-b border-divider">
          <span className="font-condensed text-lg font-bold">BarakaSELL</span>
        </div>
        <nav className="flex-1 py-3">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-5 py-2.5 text-sm border-l-2 ${
                  active
                    ? "border-accent bg-accent-tint-bg text-accent-tint-text font-medium"
                    : "border-transparent text-text/70 hover:bg-black/[0.03]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-divider text-sm">
          <div className="text-text/60 mb-2">{user.name}</div>
          <button onClick={logout} className="text-accent hover:underline">
            Chiqish
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
