module.exports = {
  apps: [
    {
      name: 'whatsapp-manager',
      script: './server.js',
      // This app keeps state in memory and uses Socket.IO + local auth/session files.
      // Running multiple workers without sticky/shared state causes 400 handshake errors
      // and duplicated WhatsApp session handling, so keep a single process.
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // Performance and stability settings
      max_memory_restart: '500M',
      watch: false,
      ignore_watch: ['node_modules', 'multimedia', 'data', 'sessions', 'auth_info'],
      
      // Auto restart settings
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Error and output logs
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: false,
      merge_logs: true,
      
      // Advanced settings
      listen_timeout: 3000,
      shutdown_with_message: true,
      
      // Node.js specific
      node_args: [
        '--max-old-space-size=2048',
        '--enable-source-maps'
      ]
    }
  ],

  deploy: {
    production: {
      user: 'root',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'https://github.com/your-repo/whatsapp-listener.git',
      path: '/var/www/whatsapp-manager',
      'post-deploy': 'npm install && npm run start:prod'
    }
  }
};
