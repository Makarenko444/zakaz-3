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

## Repository branches

The project work happens on topic branches that can change over time. After cloning,
check which branches are available before checking out `work`:

```bash
git branch -a
```

If the `work` branch is not listed, stay on the default branch (usually `main`) or
create a local `work` branch from it:

```bash
git checkout -b work origin/main
```

When the remote repository exposes a `work` branch, fetch it and switch to it:

```bash
git fetch origin
git checkout work
```

These commands help avoid the “pathspec 'work' did not match any file(s) known to git”
error when the branch has not been published yet.
