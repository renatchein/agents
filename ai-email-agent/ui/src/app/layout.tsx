import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quick Mail",
  description: "Intelligent email agent powered by Claude",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
