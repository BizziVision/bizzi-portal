/**
 * Tabela de tiers da Bizzi Vision (proposta inHabitus, out. 2026).
 * Fee mensal = tier de 1 plataforma (por nº de campanhas técnicas)
 *            + 90 € por cada plataforma adicional.
 * Valores sem IVA e sem investimento em media.
 */
export const TIER_ONE_PLATFORM: Record<number, number> = {
  1: 280.54,
  2: 338.0,
  3: 393.77,
  4: 449.54,
  5: 507.0,
  6: 562.77,
  7: 618.54,
  8: 676.0,
  9: 731.77,
};

export const EXTRA_PLATFORM_FEE = 90;
export const MAX_TIER = 9;

/** Devolve o fee mensal, ou null quando é "sob consulta" (10+ campanhas). */
export function monthlyFee(platforms: number, technicalCampaigns: number): number | null {
  if (platforms < 1 || technicalCampaigns < 1) throw new Error("Valores inválidos");
  if (technicalCampaigns > MAX_TIER) return null;
  // O tier mínimo é o nº de plataformas: cada plataforma tem pelo menos uma campanha.
  const tier = Math.max(technicalCampaigns, platforms);
  if (tier > MAX_TIER) return null;
  const fee = TIER_ONE_PLATFORM[tier] + EXTRA_PLATFORM_FEE * (platforms - 1);
  return Math.round(fee * 100) / 100;
}

export const formatEUR = (v: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v);
