import Link from "next/link";
import ConnectionRequestForm from "./components/ConnectionRequestForm";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              InternetPro
            </h1>
            <Link
              href="/requests"
              className="text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Просмотр заявок
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Подключение к интернету
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Заполните форму, и наш специалист свяжется с вами в ближайшее время
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <ConnectionRequestForm />
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
            <div className="text-3xl mb-2">⚡</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Быстрое подключение
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Подключим интернет в течение 1-3 дней
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
            <div className="text-3xl mb-2">💰</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Выгодные тарифы
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Гибкие тарифные планы для любого бюджета
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
            <div className="text-3xl mb-2">🛡️</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Надёжность
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Стабильное соединение 24/7
            </p>
          </div>
        </div>
      </main>

      <footer className="bg-white dark:bg-gray-800 mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-600 dark:text-gray-300">
          <p>InternetPro - Ваш надёжный провайдер</p>
        </div>
      </footer>
    </div>
  );
}
