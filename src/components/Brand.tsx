import Image from "next/image";

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      {/* O ícone tem proporção 388 × 453 */}
      <Image
        src="/brand/icon-fox-slate.svg"
        alt=""
        width={Math.round((size * 388) / 453)}
        height={size}
        priority
      />
      <span className="bv-wordmark text-navy text-[17px]">Bizzi Vision</span>
    </span>
  );
}
