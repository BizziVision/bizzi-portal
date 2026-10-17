import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { isStaff, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  if (isStaff(profile)) redirect("/admin");

  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("name").single();

  return (
    <>
      <AppHeader
        profile={profile}
        context={client?.name}
        nav={[
          { href: "/inicio", label: "Início" },
          { href: "/resultados", label: "Resultados" },
        ]}
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
