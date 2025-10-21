'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ConnectionRequest {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  tariff: string;
  comment: string;
  createdAt: string;
  status: 'new' | 'processing' | 'completed' | 'cancelled';
}

const tariffNames: Record<string, string> = {
  basic: 'Базовый - 50 Мбит/с',
  standard: 'Стандарт - 100 Мбит/с',
  premium: 'Премиум - 200 Мбит/с',
  ultra: 'Ультра - 500 Мбит/с',
};

const statusNames: Record<string, string> = {
  new: 'Новая',
  processing: 'В обработке',
  completed: 'Завершена',
  cancelled: 'Отменена',
};

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  processing: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

export default function RequestsPage() {
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/requests');
      if (!response.ok) {
        throw new Error('Ошибка при загрузке заявок');
      }
      const data = await response.json();
      setRequests(data.reverse());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              InternetPro
            </h1>
            <Link
              href="/"
              className="text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              На главную
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8 flex justify-between items-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Заявки на подключение
          </h2>
          <button
            onClick={fetchRequests}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Обновить
          </button>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300">Загрузка заявок...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 rounded-lg p-4">
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {!loading && !error && requests.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-600 dark:text-gray-300 text-lg">
              Пока нет ни одной заявки
            </p>
            <Link
              href="/"
              className="mt-4 inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Создать первую заявку
            </Link>
          </div>
        )}

        {!loading && !error && requests.length > 0 && (
          <div className="grid grid-cols-1 gap-6">
            {requests.map((request) => (
              <div
                key={request.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {request.fullName}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      ID: {request.id}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      statusColors[request.status]
                    }`}
                  >
                    {statusNames[request.status]}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Телефон</p>
                    <p className="text-gray-900 dark:text-white">{request.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                    <p className="text-gray-900 dark:text-white">{request.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Адрес</p>
                    <p className="text-gray-900 dark:text-white">{request.address}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Тариф</p>
                    <p className="text-gray-900 dark:text-white">
                      {tariffNames[request.tariff] || request.tariff}
                    </p>
                  </div>
                </div>

                {request.comment && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Комментарий</p>
                    <p className="text-gray-900 dark:text-white">{request.comment}</p>
                  </div>
                )}

                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Создана: {formatDate(request.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
