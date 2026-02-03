# Performance & Deployment Guide

## PM2 Ecosystem Configuration

A `ecosystem.config.js` file has been created for optimal performance using PM2.

### Key Performance Features

#### 1. **Cluster Mode**
- Runs application on all available CPU cores
- Automatic load balancing across instances
- Zero-downtime restarts

#### 2. **Memory Management**
- Max memory limit: 500MB per instance
- Auto-restart if memory exceeds limit
- Node.js heap size optimization: 2GB max

#### 3. **Stability**
- Auto-restart on crashes
- Max 10 restarts within 10 seconds window
- Graceful shutdown (5-second timeout)
- Merge logs from all instances

#### 4. **Logging**
- Separate error and output logs
- Combined log file for complete visibility
- Timestamped entries

### Installation

```bash
# Install PM2 globally (recommended)
npm install -g pm2

# Or install locally
npm install
```

### Quick Start Commands

```bash
# Start in production mode (cluster mode, all cores)
npm run start:pm2

# Start in development mode
npm run start:pm2:dev

# View logs
npm run logs

# Monitor processes
npm run monit

# Check status
npm run status

# Restart application
npm run restart

# Reload (zero-downtime restart)
npm run reload

# Stop application
npm run stop

# Delete from PM2
npm run delete

# Save current configuration
npm run save

# Resurrect saved processes
npm run resurrect
```

### Monitoring

#### Using PM2 Dashboard
```bash
# Start PM2+ monitoring
pm2 web
# Open http://localhost:9615
```

#### Real-time Monitoring
```bash
pm2 monit
```

#### View Logs
```bash
pm2 logs whatsapp-manager
pm2 logs whatsapp-manager --lines 100  # Last 100 lines
pm2 logs whatsapp-manager --err        # Error logs only
```

### Production Deployment

#### 1. Set Up Startup Script
```bash
# Make PM2 start on system boot
pm2 startup

# Copy the suggested command and run it
# Then save the current process list
npm run save
```

#### 2. Configure for Production
Update `.env` file:
```
NODE_ENV=production
PORT=3000
```

#### 3. Start Application
```bash
npm run start:pm2
```

#### 4. Enable Log Rotation
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
npm run save
```

### Performance Tuning

#### Adjust Max Memory
Edit `ecosystem.config.js`:
```javascript
max_memory_restart: '1000M',  // Increase if needed
```

#### Adjust Node.js Heap Size
```javascript
node_args: [
  '--max-old-space-size=4096',  // 4GB heap
  '--enable-source-maps'
]
```

#### Number of Instances
```javascript
instances: 4,  // Fixed number
// OR
instances: 'max',  // Use all cores (default)
```

### Troubleshooting

#### Application crashes frequently
1. Check logs: `npm run logs`
2. Increase `max_memory_restart`
3. Check Node.js heap size in `node_args`

#### High CPU usage
1. Monitor: `npm run monit`
2. Reduce number of instances
3. Profile with: `node --prof server.js`

#### Port already in use
```bash
# Kill process on port 3000
lsof -i :3000
kill -9 <PID>

# Or change port in .env
PORT=3001
npm run start:pm2
```

### Log Management

#### Location
- Error logs: `./logs/error.log`
- Output logs: `./logs/out.log`
- Combined logs: `./logs/combined.log`

#### View recent logs
```bash
tail -f logs/combined.log
```

#### Rotate logs manually
```bash
pm2 install pm2-logrotate
```

### Health Check

#### System Health
```bash
# Check CPU and Memory
npm run monit

# Check process status
npm run status
```

#### Application Health
Monitor from logs:
```bash
grep "error" logs/error.log
```

### Environment Variables

#### Development
```bash
NODE_ENV=development
PORT=3000
APP_USERNAME=admin
APP_PASSWORD=password123
```

#### Production
```bash
NODE_ENV=production
PORT=3000
APP_USERNAME=<secure_username>
APP_PASSWORD=<secure_password>
```

### Backup & Recovery

#### Save Configuration
```bash
npm run save
```

#### List saved processes
```bash
pm2 describe whatsapp-manager
```

#### Export configuration
```bash
pm2 describe whatsapp-manager > process-config.json
```

### Clustering Details

When running in cluster mode with `instances: 'max'`:
- If you have 4 CPU cores → 4 instances will run
- Each instance runs independently
- Socket.IO distributes connections across instances
- Load balancer required for HTTP (use Nginx or HAProxy)

### Load Balancing (Optional)

For production, use Nginx:

```nginx
upstream whatsapp_manager {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://whatsapp_manager;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Security Recommendations

1. **Change default credentials in production**
   ```bash
   # Edit .env
   APP_USERNAME=your_secure_username
   APP_PASSWORD=your_secure_password
   ```

2. **Use HTTPS**
   ```bash
   # Use Let's Encrypt with Certbot
   certbot certonly --standalone -d your-domain.com
   ```

3. **Firewall configuration**
   ```bash
   sudo ufw allow 22    # SSH
   sudo ufw allow 80    # HTTP
   sudo ufw allow 443   # HTTPS
   ```

4. **Enable PM2 startup**
   ```bash
   pm2 startup
   npm run save
   ```

### Resource Monitoring

Monitor resource usage:
```bash
# Real-time monitoring
npm run monit

# Historical logs
pm2 logs --lines 500

# Process info
pm2 info whatsapp-manager
```

### Scaling Tips

- **Vertical Scaling**: Increase `max_memory_restart` and Node.js heap size
- **Horizontal Scaling**: Use multiple servers with load balancer
- **Database**: Consider moving sessions to Redis for multi-server setup
- **Socket.IO**: Configure Socket.IO adapter for multi-server communication

```javascript
// For distributed systems, use Redis adapter
const io = require('socket.io')(server, {
  adapter: require('socket.io-redis')({
    host: 'localhost',
    port: 6379
  })
});
```

### Maintenance Tasks

#### Weekly
```bash
pm2 logs
npm run status
```

#### Monthly
```bash
pm2 update
npm audit
```

#### Quarterly
```bash
npm update
pm2 flush
```

### Useful PM2 Commands

```bash
pm2 start app.js                 # Start app
pm2 stop app.js                  # Stop app
pm2 restart app.js               # Restart app
pm2 reload app.js                # Graceful restart
pm2 delete app.js                # Remove from PM2
pm2 list                          # List all processes
pm2 info app                      # Process info
pm2 logs app                      # View logs
pm2 logs app --err                # Error logs only
pm2 kill                          # Kill all PM2 processes
pm2 flush                         # Clear logs
pm2 save                          # Save process list
pm2 resurrect                     # Restore saved processes
pm2 ecosystem                     # Generate config
pm2 web                           # Web dashboard
```
