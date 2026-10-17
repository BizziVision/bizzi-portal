"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type Step = "email" | "code";

export function LoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(initialError ?? null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    // shouldCreateUser: false → só emails aprovados no backoffice recebem código.
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (error && error.status === 429) {
      setMessage("Demasiadas tentativas. Aguarde um minuto e tente de novo.");
      return;
    }
    // Mesma resposta para emails aprovados e não aprovados: não revela quem tem acesso.
    setStep("code");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setBusy(false);
      setMessage("Código inválido ou expirado. Confirme o código ou peça um novo.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  const input =
    "w-full rounded-md border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] text-navy placeholder:text-slate-400 focus:border-slate-500 focus:outline-none";
  const button =
    "w-full rounded-md bg-navy px-4 py-2.5 text-[15px] font-bold text-white transition-colors hover:bg-navy-500 disabled:opacity-60";

  if (step === "email") {
    return (
      <form onSubmit={sendCode} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-bold text-slate-700">Email</span>
          <input
            className={input}
            type="email"
            required
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@empresa.pt"
          />
        </label>
        {message && <p className="text-sm text-negative">{message}</p>}
        <button className={button} disabled={busy}>
          {busy ? "A enviar…" : "Receber código de acesso"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verifyCode} className="space-y-4">
      <p className="text-sm text-slate-700">
        Se <strong className="text-navy">{email}</strong> tiver acesso ao portal, recebeu um código
        por email. É válido durante alguns minutos.
      </p>
      <label className="block space-y-1.5">
        <span className="text-sm font-bold text-slate-700">Código</span>
        <input
          className={`${input} tracking-[0.3em] text-lg`}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6,8}"
          maxLength={8}
          required
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
        />
      </label>
      {message && <p className="text-sm text-negative">{message}</p>}
      <button className={button} disabled={busy}>
        {busy ? "A entrar…" : "Entrar"}
      </button>
      <button
        type="button"
        className="w-full text-sm text-slate-600 underline-offset-2 hover:underline"
        onClick={() => {
          setStep("email");
          setCode("");
          setMessage(null);
        }}
      >
        Usar outro email
      </button>
    </form>
  );
}
