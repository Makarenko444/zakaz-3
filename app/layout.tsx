import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Система управления заявками | Интернет-провайдер",
  description: "CRM система для управления заявками клиентов на подключение к сети интернет",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
