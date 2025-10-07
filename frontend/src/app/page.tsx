"use client";

import { useEffect, useMemo, useState } from "react";

const tabs = ["Общее", "История", "Комментарии", "Файлы", "Планирование"] as const;

type TabKey = (typeof tabs)[number];

type RequestHistory = {
  date: string;
  action: string;
  actor: string;
};

type RequestComment = {
  author: string;
  role: string;
  date: string;
  message: string;
};

type RequestFile = {
  name: string;
  size: string;
  uploadedAt: string;
};

type RequestPlan = {
  stage: string;
  owner: string;
  dueDate: string;
  status: string;
};

type Request = {
  id: string;
  status: string;
  statusTone: "success" | "warning" | "info" | "danger";
  customer: string;
  amount: string;
  manager: string;
  createdAt: string;
  deadline: string;
  priority: "Высокий" | "Средний" | "Низкий";
  description: string;
  history: RequestHistory[];
  comments: RequestComment[];
  files: RequestFile[];
  plan: RequestPlan[];
};

const requests: Request[] = [
  {
    id: "ZK-1052",
    status: "В работе",
    statusTone: "warning",
    customer: "ООО \"Альфа Логистикс\"",
    amount: "1 280 000 ₽",
    manager: "Иван Петров",
    createdAt: "12.03.2024",
    deadline: "25.03.2024",
    priority: "Высокий",
    description:
      "Поставка серверного оборудования для модернизации вычислительного центра клиента.",
    history: [
      {
        date: "12.03.2024, 09:20",
        action: "Создана заявка и назначен ответственный",
        actor: "Виктория Петрова",
      },
      {
        date: "12.03.2024, 14:05",
        action: "Получено коммерческое предложение от поставщика",
        actor: "Иван Петров",
      },
      {
        date: "13.03.2024, 10:18",
        action: "Заявка отправлена на согласование",
        actor: "Иван Петров",
      },
    ],
    comments: [
      {
        author: "Иван Петров",
        role: "Менеджер",
        date: "13.03.2024, 10:20",
        message:
          "В коммерческом предложении уточнили сроки поставки — 14 календарных дней.",
      },
      {
        author: "Анна Соколова",
        role: "Финансовый контролёр",
        date: "13.03.2024, 11:45",
        message: "Проверила смету, замечаний нет. Жду согласование директора.",
      },
    ],
    files: [
      {
        name: "Коммерческое предложение.pdf",
        size: "1,2 МБ",
        uploadedAt: "12.03.2024",
      },
      { name: "ТЗ_Альфа.docx", size: "860 КБ", uploadedAt: "12.03.2024" },
    ],
    plan: [
      {
        stage: "Согласование",
        owner: "Анна Соколова",
        dueDate: "15.03.2024",
        status: "В процессе",
      },
      {
        stage: "Подготовка договора",
        owner: "Юридический отдел",
        dueDate: "18.03.2024",
        status: "Не начато",
      },
    ],
  },
  {
    id: "ZK-1049",
    status: "Ожидает согласования",
    statusTone: "info",
    customer: "АО \"СеверСтрой\"",
    amount: "780 000 ₽",
    manager: "Мария Лебедева",
    createdAt: "10.03.2024",
    deadline: "22.03.2024",
    priority: "Средний",
    description: "Закупка строительных материалов для объекта в Санкт-Петербурге.",
    history: [
      {
        date: "10.03.2024, 11:03",
        action: "Создана заявка",
        actor: "Виктория Петрова",
      },
      {
        date: "11.03.2024, 09:47",
        action: "Добавлены уточнения по спецификации",
        actor: "Мария Лебедева",
      },
    ],
    comments: [
      {
        author: "Мария Лебедева",
        role: "Куратор",
        date: "11.03.2024, 09:50",
        message: "Необходимо согласование с техдиректором по списку материалов.",
      },
    ],
    files: [
      {
        name: "Спецификация_СеверСтрой.xlsx",
        size: "420 КБ",
        uploadedAt: "11.03.2024",
      },
    ],
    plan: [
      {
        stage: "Утверждение спецификации",
        owner: "Технический директор",
        dueDate: "14.03.2024",
        status: "Просрочено",
      },
    ],
  },
  {
    id: "ZK-1043",
    status: "Завершена",
    statusTone: "success",
    customer: "ООО \"Городские сети\"",
    amount: "2 450 000 ₽",
    manager: "Дмитрий Орлов",
    createdAt: "04.03.2024",
    deadline: "11.03.2024",
    priority: "Средний",
    description: "Монтаж и настройка сетевого оборудования на 12 площадках.",
    history: [
      {
        date: "04.03.2024, 08:10",
        action: "Заявка создана",
        actor: "Виктория Петрова",
      },
      {
        date: "05.03.2024, 16:22",
        action: "Подписан договор",
        actor: "Дмитрий Орлов",
      },
      {
        date: "11.03.2024, 18:40",
        action: "Проект закрыт",
        actor: "Дмитрий Орлов",
      },
    ],
    comments: [
      {
        author: "Дмитрий Орлов",
        role: "Менеджер",
        date: "12.03.2024, 09:14",
        message: "Работы завершены вовремя, клиент доволен результатом.",
      },
    ],
    files: [
      {
        name: "Акт выполненных работ.pdf",
        size: "540 КБ",
        uploadedAt: "11.03.2024",
      },
    ],
    plan: [
      {
        stage: "Закрывающие документы",
        owner: "Бухгалтерия",
        dueDate: "15.03.2024",
        status: "В работе",
      },
    ],
  },
  {
    id: "ZK-1038",
    status: "В работе",
    statusTone: "warning",
    customer: "ООО \"Новые решения\"",
    amount: "960 000 ₽",
    manager: "Елена Фомина",
    createdAt: "01.03.2024",
    deadline: "20.03.2024",
    priority: "Высокий",
    description: "Внедрение CRM-системы и обучение сотрудников.",
    history: [
      {
        date: "01.03.2024, 12:34",
        action: "Заявка создана",
        actor: "Виктория Петрова",
      },
      {
        date: "07.03.2024, 15:06",
        action: "Подготовлена дорожная карта проекта",
        actor: "Елена Фомина",
      },
    ],
    comments: [
      {
        author: "Елена Фомина",
        role: "Проектный менеджер",
        date: "07.03.2024, 15:10",
        message: "Клиент просит уделить дополнительное внимание интеграции с 1С.",
      },
    ],
    files: [
      {
        name: "Roadmap_CRM.pdf",
        size: "1,6 МБ",
        uploadedAt: "07.03.2024",
      },
    ],
    plan: [
      {
        stage: "Настройка интеграций",
        owner: "ИТ отдел",
        dueDate: "19.03.2024",
        status: "В процессе",
      },
      {
        stage: "Обучение пользователей",
        owner: "Команда внедрения",
        dueDate: "25.03.2024",
        status: "Запланировано",
      },
    ],
  },
  {
    id: "ZK-1032",
    status: "Новая",
    statusTone: "info",
    customer: "ООО \"ФрешМаркет\"",
    amount: "320 000 ₽",
    manager: "Алексей Иванов",
    createdAt: "28.02.2024",
    deadline: "18.03.2024",
    priority: "Низкий",
    description: "Оформление витрин и рекламных материалов к открытию магазина.",
    history: [
      {
        date: "28.02.2024, 10:05",
        action: "Заявка зарегистрирована",
        actor: "Виктория Петрова",
      },
    ],
    comments: [],
    files: [],
    plan: [
      {
        stage: "Подготовка дизайн-концепции",
        owner: "Маркетинговый отдел",
        dueDate: "16.03.2024",
        status: "Не начато",
      },
    ],
  },
];

const toneClassMap: Record<Request["statusTone"], string> = {
  success: "tone-success",
  warning: "tone-warning",
  info: "tone-info",
  danger: "tone-danger",
};

export default function Home() {
  const [selectedId, setSelectedId] = useState<string>(requests[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<TabKey>(tabs[0]);

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? requests[0],
    [selectedId]
  );

  useEffect(() => {
    setActiveTab(tabs[0]);
  }, [selectedId]);

  if (!selectedRequest) {
    return null;
  }

  return (
    <main className="dashboard" aria-label="Список заявок и карточка выбранной заявки">
      <section className="dashboard__list" aria-label="Список заявок">
        <div className="dashboard__list-header">
          <div>
            <h1 className="dashboard__title">Заявки</h1>
            <p className="dashboard__subtitle">
              {requests.length} активных и завершённых заявок в работе
            </p>
          </div>
          <button type="button" className="create-request-button">
            + Новая заявка
          </button>
        </div>
        <ul className="request-list" role="list">
          {requests.map((request) => (
            <li
              key={request.id}
              className={`request-row ${
                request.id === selectedRequest.id ? "is-selected" : ""
              }`}
            >
              <button
                type="button"
                className="request-row__button"
                onClick={() => setSelectedId(request.id)}
              >
                <div className="request-row__primary">
                  <span className="request-row__id">{request.id}</span>
                  <span
                    className={`request-row__status ${toneClassMap[request.statusTone]}`}
                  >
                    {request.status}
                  </span>
                </div>
                <div className="request-row__meta">
                  <div className="request-row__cell">
                    <span className="request-row__label">Клиент</span>
                    <span className="request-row__value">{request.customer}</span>
                  </div>
                  <div className="request-row__cell">
                    <span className="request-row__label">Сумма</span>
                    <span className="request-row__value">{request.amount}</span>
                  </div>
                  <div className="request-row__cell">
                    <span className="request-row__label">Менеджер</span>
                    <span className="request-row__value">{request.manager}</span>
                  </div>
                  <div className="request-row__cell">
                    <span className="request-row__label">Создана</span>
                    <span className="request-row__value">{request.createdAt}</span>
                  </div>
                  <div className="request-row__cell">
                    <span className="request-row__label">Дедлайн</span>
                    <span className="request-row__value">{request.deadline}</span>
                  </div>
                  <div className="request-row__cell">
                    <span className="request-row__label">Приоритет</span>
                    <span className={`request-row__chip priority-${request.priority.toLowerCase()}`}>
                      {request.priority}
                    </span>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <aside className="dashboard__details" aria-label="Карточка выбранной заявки">
        <div className="details-header">
          <div>
            <h2 className="details-title">{selectedRequest.id}</h2>
            <p className="details-subtitle">{selectedRequest.customer}</p>
          </div>
          <div className="details-status">
            <span className={`request-row__status ${toneClassMap[selectedRequest.statusTone]}`}>
              {selectedRequest.status}
            </span>
            <span className="details-deadline">Дедлайн: {selectedRequest.deadline}</span>
          </div>
        </div>

        <div className="details-tabs" role="tablist" aria-label="Разделы карточки заявки">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`details-tab ${tab === activeTab ? "is-active" : ""}`}
              role="tab"
              aria-selected={tab === activeTab}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="details-content">
          {activeTab === "Общее" && (
            <div className="details-overview" role="tabpanel">
              <p className="details-description">{selectedRequest.description}</p>
              <div className="details-grid">
                <div className="details-card">
                  <span className="details-card__label">Ответственный</span>
                  <span className="details-card__value">{selectedRequest.manager}</span>
                </div>
                <div className="details-card">
                  <span className="details-card__label">Дата создания</span>
                  <span className="details-card__value">{selectedRequest.createdAt}</span>
                </div>
                <div className="details-card">
                  <span className="details-card__label">Сумма</span>
                  <span className="details-card__value">{selectedRequest.amount}</span>
                </div>
                <div className="details-card">
                  <span className="details-card__label">Приоритет</span>
                  <span className={`details-card__chip priority-${selectedRequest.priority.toLowerCase()}`}>
                    {selectedRequest.priority}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "История" && (
            <div className="details-history" role="tabpanel">
              <ul className="timeline" role="list">
                {selectedRequest.history.map((item) => (
                  <li key={`${item.date}-${item.action}`} className="timeline__item">
                    <span className="timeline__date">{item.date}</span>
                    <div className="timeline__content">
                      <span className="timeline__action">{item.action}</span>
                      <span className="timeline__actor">{item.actor}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === "Комментарии" && (
            <div className="details-comments" role="tabpanel">
              {selectedRequest.comments.length === 0 ? (
                <p className="empty-state">Комментариев пока нет.</p>
              ) : (
                <ul className="comment-list" role="list">
                  {selectedRequest.comments.map((comment) => (
                    <li key={`${comment.author}-${comment.date}`} className="comment">
                      <div className="comment__header">
                        <span className="comment__author">{comment.author}</span>
                        <span className="comment__role">{comment.role}</span>
                      </div>
                      <span className="comment__date">{comment.date}</span>
                      <p className="comment__message">{comment.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === "Файлы" && (
            <div className="details-files" role="tabpanel">
              {selectedRequest.files.length === 0 ? (
                <p className="empty-state">Файлы ещё не загружены.</p>
              ) : (
                <ul className="file-list" role="list">
                  {selectedRequest.files.map((file) => (
                    <li key={`${file.name}-${file.uploadedAt}`} className="file">
                      <div className="file__icon" aria-hidden>
                        📄
                      </div>
                      <div className="file__meta">
                        <span className="file__name">{file.name}</span>
                        <span className="file__info">
                          {file.size} · загружено {file.uploadedAt}
                        </span>
                      </div>
                      <button type="button" className="file__action">
                        Скачать
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === "Планирование" && (
            <div className="details-plan" role="tabpanel">
              {selectedRequest.plan.length === 0 ? (
                <p className="empty-state">Этапы планирования не заполнены.</p>
              ) : (
                <ul className="plan-list" role="list">
                  {selectedRequest.plan.map((item) => (
                    <li key={`${item.stage}-${item.owner}`} className="plan">
                      <div className="plan__main">
                        <span className="plan__stage">{item.stage}</span>
                        <span className="plan__owner">{item.owner}</span>
                      </div>
                      <div className="plan__meta">
                        <span className="plan__due">До {item.dueDate}</span>
                        <span className="plan__status">{item.status}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </aside>
    </main>
  );
}
