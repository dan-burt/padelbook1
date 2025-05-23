import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Press_Start_2P } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const pressStart2P = Press_Start_2P({ 
  weight: '400',
  subsets: ["latin"],
  variable: '--font-press-start-2p'
});

export const metadata: Metadata = {
  title: "Padel Tribe - Court Bookings",
  description: "Book padel courts for your local community group",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${pressStart2P.variable}`}>{children}</body>
    </html>
  );
}
