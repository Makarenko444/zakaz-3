import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Заказ-3 - Система управления заявками",
  description: "Система управления заявками на подключение и обслуживание клиентов интернет-провайдера",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
