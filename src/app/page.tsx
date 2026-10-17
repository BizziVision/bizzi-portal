import { redirect } from "next/navigation";
import { getProfile, isStaff } from "@/lib/auth";

export default async function Home() {
  const profile = await getProfile();
  if (!profile) redirect("/login?erro=sem-acesso");
  redirect(isStaff(profile) ? "/admin" : "/inicio");
}
