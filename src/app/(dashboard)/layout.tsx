import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

const NAV = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/dashboard/members", label: "Socios" },
  { href: "/dashboard/products", label: "Productos" },
  { href: "/dashboard/transactions", label: "Transacciones" },
  { href: "/pos", label: "TPV" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-50">
      <aside className="w-56 shrink-0 border-r bg-white flex flex-col">
        <div className="px-5 py-4 border-b">
          <span className="font-bold text-lg tracking-tight">OmmniClub</span>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-5 py-4 border-t">
          <UserButton />
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
