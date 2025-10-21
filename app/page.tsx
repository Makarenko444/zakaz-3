export default function Home() {
  // Mock данные для демонстрации
  const stats = [
    { title: "Новые заявки", value: 12, color: "bg-blue-500" },
    { title: "В работе", value: 8, color: "bg-yellow-500" },
    { title: "Выполнено", value: 45, color: "bg-green-500" },
    { title: "Всего за месяц", value: 65, color: "bg-purple-500" },
  ];

  const applications = [
    {
      id: "APP-001",
      client: "Иванов Иван Иванович",
      phone: "+7 (999) 123-45-67",
      address: "ул. Ленина, д. 15, кв. 42",
      tariff: "100 Мбит/с",
      status: "new",
      date: "2025-10-20",
    },
    {
      id: "APP-002",
      client: "Петрова Мария Сергеевна",
      phone: "+7 (999) 234-56-78",
      address: "ул. Пушкина, д. 23, кв. 15",
      tariff: "200 Мбит/с",
      status: "in_progress",
      date: "2025-10-19",
    },
    {
      id: "APP-003",
      client: "Сидоров Петр Алексеевич",
      phone: "+7 (999) 345-67-89",
      address: "пр. Мира, д. 8, кв. 7",
      tariff: "500 Мбит/с",
      status: "in_progress",
      date: "2025-10-19",
    },
    {
      id: "APP-004",
      client: "Козлова Анна Дмитриевна",
      phone: "+7 (999) 456-78-90",
      address: "ул. Гагарина, д. 45, кв. 102",
      tariff: "100 Мбит/с",
      status: "completed",
      date: "2025-10-18",
    },
    {
      id: "APP-005",
      client: "Морозов Сергей Викторович",
      phone: "+7 (999) 567-89-01",
      address: "ул. Советская, д. 12, кв. 89",
      tariff: "300 Мбит/с",
      status: "new",
      date: "2025-10-20",
    },
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      new: { label: "Новая", className: "bg-blue-100 text-blue-800" },
      in_progress: { label: "В работе", className: "bg-yellow-100 text-yellow-800" },
      completed: { label: "Выполнено", className: "bg-green-100 text-green-800" },
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.className}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Система управления заявками
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Управление заявками на подключение интернета
              </p>
            </div>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm">
              + Создать заявку
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {stat.title}
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {stat.value}
                  </p>
                </div>
                <div className={`w-12 h-12 ${stat.color} rounded-lg opacity-10`}></div>
              </div>
            </div>
          ))}
        </div>

        {/* Applications Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">
              Последние заявки
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Клиент
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Телефон
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Адрес
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Тариф
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Дата
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {app.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {app.client}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {app.phone}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {app.address}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {app.tariff}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {getStatusBadge(app.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(app.date).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button className="text-blue-600 hover:text-blue-800 font-medium">
                        Открыть
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
