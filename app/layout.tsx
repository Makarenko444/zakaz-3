import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InternetPro - Подключение к интернету",
  description: "Заявки на подключение к интернету от провайдера InternetPro",
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
