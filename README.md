## Заказ 2.0 — система управления заявками провайдера

Веб-приложение для операторов и инженерных бригад интернет-провайдера, которое позволяет принимать и обрабатывать заявки на подключение и обслуживание клиентов. Сервис включает каталог адресов, гибкую систему статусов с историей изменений, планирование выездов монтажных бригад и генерацию служебных документов. Проект создаётся на Next.js и PostgreSQL с прицелом на интеграцию с Supabase, Telegram и другими внутренними сервисами.

### Краткое описание для блока GitHub About

Скопируйте следующий текст в настройках репозитория GitHub (Settings → General → Description), чтобы он отображался в блоке **About**:

> Веб-платформа для операторов и выездных бригад провайдера: приём и обработка заявок, планирование выездов, журнал статусов и интеграции с Supabase и Telegram. Next.js + PostgreSQL.

Более детальное описание проекта находится в этом `README.md` в разделе «Заказ 2.0 — система управления заявками провайдера».

#### Как автоматически записать описание через GitHub CLI

Если у вас установлен и авторизован [GitHub CLI](https://cli.github.com/), выполните одну команду, и описание появится в блоке **About** без ручного ввода:

```bash
gh repo edit <owner>/<repo> \
  --description "Веб-платформа для операторов и выездных бригад провайдера: приём и обработка заявок, планирование выездов, журнал статусов и интеграции с Supabase и Telegram. Next.js + PostgreSQL."
```

Замените `<owner>/<repo>` на путь к вашему репозиторию, например `our-team/zakaz-3`. После выполнения команды описание обновится сразу же на GitHub.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
