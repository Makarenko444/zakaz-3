module.exports = {
  apps: [
    {
      name: 'zakaz-3',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: '/home/makarenko/apps/zakaz-3',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: '/home/makarenko/logs/zakaz-3-error.log',
      out_file: '/home/makarenko/logs/zakaz-3-out.log',
      time: true,
    },
  ],
};
