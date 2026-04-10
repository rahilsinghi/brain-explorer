import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brain Explorer",
  description: "3D knowledge graph — Rahil Singhi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans bg-[#050510] text-white overflow-hidden">
        {children}
      </body>
    </html>
  );
}
