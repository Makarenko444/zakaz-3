import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sections = [
  "Заявки",
  "Дашборд",
  "Планирование",
  "Справочники",
  "Администрирование",
];

export const metadata: Metadata = {
  title: "Zakaz 2.0",
  description: "Рабочее место оператора заказов",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="app-shell">
          <header className="app-header">
            <div className="app-brand">
              <span className="app-brand__title">Zakaz 2.0</span>
              <span className="app-brand__subtitle">Единое окно заявок</span>
            </div>
            <nav className="app-nav" aria-label="Основные разделы">
              {sections.map((section, index) => (
                <button
                  key={section}
                  type="button"
                  className={`app-nav__item ${index === 0 ? "is-active" : ""}`}
                  aria-current={index === 0 ? "page" : undefined}
                >
                  {section}
                </button>
              ))}
            </nav>
            <div className="app-header__profile" aria-label="Информация о пользователе">
              <span className="app-header__avatar" aria-hidden>ВП</span>
              <div className="app-header__user">
                <span className="app-header__name">Виктория Петрова</span>
                <span className="app-header__role">Оператор</span>
              </div>
            </div>
          </header>

          <section className="app-filters" aria-label="Фильтры заявок">
            <div className="filter-field filter-field--search">
              <label htmlFor="search" className="filter-field__label">
                Поиск
              </label>
              <input
                id="search"
                type="search"
                placeholder="По номеру, клиенту или товару"
                className="filter-field__input"
              />
            </div>
            <div className="filter-field">
              <label htmlFor="status" className="filter-field__label">
                Статус
              </label>
              <select id="status" className="filter-field__input">
                <option>Все статусы</option>
                <option>Новая</option>
                <option>В работе</option>
                <option>Ожидает согласования</option>
                <option>Завершена</option>
              </select>
            </div>
            <div className="filter-field">
              <label htmlFor="period" className="filter-field__label">
                Период
              </label>
              <select id="period" className="filter-field__input">
                <option>Последние 7 дней</option>
                <option>Текущий месяц</option>
                <option>Прошлый месяц</option>
                <option>Произвольный диапазон</option>
              </select>
            </div>
            <div className="filter-field">
              <label htmlFor="priority" className="filter-field__label">
                Приоритет
              </label>
              <select id="priority" className="filter-field__input">
                <option>Все</option>
                <option>Высокий</option>
                <option>Средний</option>
                <option>Низкий</option>
              </select>
            </div>
            <div className="filter-actions">
              <button type="button" className="filter-actions__button">
                Сбросить
              </button>
              <button type="button" className="filter-actions__button filter-actions__button--primary">
                Применить
              </button>
            </div>
          </section>

          <div className="app-content">{children}</div>
        </div>
      </body>
    </html>
  );
}
