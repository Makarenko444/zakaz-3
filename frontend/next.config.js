// ~/zakaz-2.0/frontend/next.config.js
/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");

/** @type {import('next').NextConfig} */
module.exports = {
  turbopack: {
    // Явно указываем корень как папку frontend
    root: path.resolve(__dirname),
  },
};
