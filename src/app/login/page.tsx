import { BrandMark } from "@/components/Brand";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const initialError =
    erro === "sem-acesso"
      ? "Esta conta ainda não tem acesso ao portal. Fale com a Bizzi Vision."
      : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <BrandMark size={32} />
        </div>
        <h1 className="text-[26px] font-semibold leading-tight">Portal de clientes</h1>
        <p className="mt-2 mb-8 text-slate-700">
          Entre com o seu email. Enviamos um código de acesso, sem passwords.
        </p>
        <LoginForm initialError={initialError} />
        <p className="mt-10 text-xs text-slate-500">
          Acesso reservado a clientes e equipa da <span className="bv-wordmark">Bizzi Vision</span>.
        </p>
      </div>
    </main>
  );
}
