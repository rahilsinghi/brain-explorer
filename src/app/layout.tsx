import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

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
      <body
        className={`${inter.className} bg-[#050510] text-white overflow-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
