export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
              З
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Заказ 3.0</h1>
              <p className="text-xs text-gray-500">Система управления заявками</p>
            </div>
          </div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
            Войти
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <div className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-6">
            📋 MVP v0.35 • В разработке
          </div>
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Управление заявками
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              нового поколения
            </span>
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Система для интернет-провайдеров: от создания заявки до установки оборудования.
            Контроль на каждом этапе.
          </p>
          <div className="flex gap-4 justify-center">
            <button className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
              Начать работу →
            </button>
            <button className="px-8 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
              Документация
            </button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <FeatureCard
            icon="📋"
            title="Управление заявками"
            description="Создавайте и отслеживайте заявки с 10 статусами: от новой до установленной"
            status="✅ Готово"
          />
          <FeatureCard
            icon="📍"
            title="Справочник адресов"
            description="Структурированное хранение улиц, домов и подъездов с GPS координатами"
            status="✅ Готово"
          />
          <FeatureCard
            icon="👥"
            title="Управление пользователями"
            description="4 роли: оператор, инженер, руководитель и администратор"
            status="✅ Готово"
          />
          <FeatureCard
            icon="💬"
            title="Комментарии"
            description="Обсуждайте заявки прямо в системе"
            status="🚧 В разработке"
          />
          <FeatureCard
            icon="📎"
            title="Файлы и фото"
            description="Прикрепляйте документы и фотографии к заявкам"
            status="🚧 В разработке"
          />
          <FeatureCard
            icon="📊"
            title="Аналитика"
            description="Дашборды и отчёты по работе команды"
            status="🚧 Запланировано"
          />
        </div>

        {/* Tech Stack */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Современный технологический стек
          </h3>
          <div className="grid md:grid-cols-4 gap-6">
            <TechItem name="Next.js 15" type="Frontend" />
            <TechItem name="PostgreSQL" type="Database" />
            <TechItem name="Supabase" type="Backend" />
            <TechItem name="Tailwind CSS" type="UI" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mt-16">
          <StatCard number="35%" label="Готовность MVP" />
          <StatCard number="10" label="Статусов заявок" />
          <StatCard number="4" label="Роли пользователей" />
          <StatCard number="11" label="Таблиц в БД" />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-gray-600 text-sm">
          <p>© 2025 Заказ 3.0 • Система управления заявками интернет-провайдера</p>
          <p className="mt-2">
            Powered by Next.js 15 • PostgreSQL • Supabase
          </p>
        </div>
      </footer>
    </div>
  );
}

// Feature Card Component
function FeatureCard({ icon, title, description, status }: {
  icon: string;
  title: string;
  description: string;
  status: string;
}) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm mb-4">{description}</p>
      <span className="text-xs font-medium text-gray-500">{status}</span>
    </div>
  );
}

// Tech Item Component
function TechItem({ name, type }: { name: string; type: string }) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-3">
        <span className="text-2xl font-bold text-blue-600">
          {name[0]}
        </span>
      </div>
      <h4 className="font-semibold text-gray-900 text-sm">{name}</h4>
      <p className="text-xs text-gray-500">{type}</p>
    </div>
  );
}

// Stat Card Component
function StatCard({ number, label }: { number: string; label: string }) {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl text-center border border-blue-100">
      <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mb-2">
        {number}
      </div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}
