import { AppHeader } from "@/components/AppHeader";
import { requireStaff } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireStaff();
  const nav = [
    { href: "/admin", label: "Clientes" },
    ...(profile.role === "admin" ? [{ href: "/admin/clientes/novo", label: "Novo cliente" }] : []),
  ];
  return (
    <>
      <AppHeader profile={profile} nav={nav} context="Backoffice" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
