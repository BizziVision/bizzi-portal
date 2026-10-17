import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portal Bizzi Vision",
  description: "Portal de clientes da Bizzi Vision",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-PT">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
