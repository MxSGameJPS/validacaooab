import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "Verificação de OAB | Social Jurídico",
  description: "Verificação automática de identidade e registro na OAB.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className={geistSans.variable}>{children}</body>
    </html>
  );
}
