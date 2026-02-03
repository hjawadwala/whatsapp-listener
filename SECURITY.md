# IP-Based Rate Limiting & Brute Force Protection

## Overview

A comprehensive security feature has been implemented to protect against brute force login attacks. IPs that exceed the maximum number of failed login attempts are automatically blocked for a configurable period (default: 24 hours).

## Features

✅ **IP-based rate limiting** - Tracks login attempts per IP address  
✅ **Automatic IP blocking** - Blocks IPs after X failed attempts  
✅ **Configurable lockout duration** - Default 24 hours, customizable via .env  
✅ **Attempt counter reset** - Resets after 1 hour of inactivity  
✅ **User feedback** - Shows remaining attempts and lockout time  
✅ **Security logging** - All attempts logged for monitoring  
✅ **Automatic cleanup** - Expired blocks removed automatically  

## Configuration

Edit `.env` file to customize:

```env
# Maximum login attempts before blocking (default: 5)
MAX_LOGIN_ATTEMPTS=5

# Lockout duration in milliseconds (default: 86400000 = 24 hours)
LOGIN_LOCKOUT_DURATION=86400000
```

### Examples

**Strict security (3 attempts, 24 hours):**
```env
MAX_LOGIN_ATTEMPTS=3
LOGIN_LOCKOUT_DURATION=86400000
```

**Moderate security (5 attempts, 1 hour):**
```env
MAX_LOGIN_ATTEMPTS=5
LOGIN_LOCKOUT_DURATION=3600000
```

**Relaxed security (10 attempts, 30 minutes):**
```env
MAX_LOGIN_ATTEMPTS=10
LOGIN_LOCKOUT_DURATION=1800000
```

## How It Works

### 1. Login Attempt Processing

```
User submits login → IP address captured → Check if IP is blocked
  ↓ (If blocked)
  Return 429 error with remaining lockout time
  
  ↓ (If not blocked)
  Validate credentials → Success: Reset attempts, generate token
                     → Failure: Record attempt, check if limit exceeded
```

### 2. Attempt Recording

- Each failed login attempt for an IP is recorded
- Counter includes timestamp of first attempt
- If no new attempts within 1 hour, counter resets
- When max attempts reached, IP is blocked immediately

### 3. IP Blocking

- Blocked IP cannot login for the configured duration
- Block automatically expires after timeout
- All attempt records cleaned up when block expires
- User can try again after lockout period

## API Responses

### Successful Login
```json
{
  "success": true,
  "token": "admin_token_here"
}
```

### Failed Login (First Attempts)
```json
{
  "success": false,
  "error": "Invalid username or password",
  "attemptsRemaining": 4
}
```

### Failed Login (Max Attempts Reached / IP Blocked)
```json
{
  "success": false,
  "error": "Too many failed attempts. Account locked for 86400 seconds.",
  "blockedUntil": 86400
}
```

Status Code: `429 (Too Many Requests)`

## User Interface

### Login Page Enhancements

1. **Attempt Counter**
   - Shows remaining attempts after each failed login
   - Example: "(4 attempts remaining)"

2. **Lockout Message**
   - Displays when IP is blocked
   - Shows countdown timer until unlocking
   - Example: "Locked for 24h 0m"

3. **Countdown Timer**
   - Automatically updates remaining lockout time
   - Disables login form during lockout
   - Re-enables when lockout expires

## Security Logging

All login attempts are logged with timestamps and IP addresses:

```
[SECURITY] Successful login from IP 192.168.1.100
[SECURITY] Failed login attempt from IP 192.168.1.101. Attempts remaining: 4
[SECURITY] IP 192.168.1.102 blocked after 5 failed attempts
[SECURITY] Login attempt from blocked IP 192.168.1.102. Remaining lockout: 86399s
```

View logs:
```bash
npm run logs | grep SECURITY
```

## IP Detection

The system uses multiple methods to detect client IP:

1. **X-Forwarded-For Header** (Proxy/Load Balancer)
2. **Connection.remoteAddress** (Direct Connection)
3. **Socket.remoteAddress** (Fallback)

This ensures correct IP detection even behind:
- Nginx/Apache reverse proxies
- Load balancers
- Cloud CDN services

## Scenarios

### Scenario 1: Correct Password After Few Attempts
```
Attempt 1 (wrong): "Invalid credentials (4 attempts remaining)"
Attempt 2 (wrong): "Invalid credentials (3 attempts remaining)"
Attempt 3 (correct): ✓ Login successful, token generated
                     All attempts reset for this IP
```

### Scenario 2: Brute Force Attack
```
Attempt 1 (wrong): "Invalid credentials (4 attempts remaining)"
Attempt 2 (wrong): "Invalid credentials (3 attempts remaining)"
Attempt 3 (wrong): "Invalid credentials (2 attempts remaining)"
Attempt 4 (wrong): "Invalid credentials (1 attempts remaining)"
Attempt 5 (wrong): "Too many failed attempts. Locked for 24h"
                   IP BLOCKED for 24 hours
Attempt 6 (after 10s): "Too many failed attempts. Locked for 24h"
```

### Scenario 3: Attack from Multiple IPs
```
IP1: 5 failed → BLOCKED for 24h
IP2: 5 failed → BLOCKED for 24h
IP3: 1 failed → Can continue trying
```

Each IP has independent attempt counter, allowing legitimate users on different networks to login.

## Monitoring

### Check Active Blocks
```bash
# View server logs for blocked IPs
npm run logs | grep "SECURITY"
```

### Check Attempt History
The information is kept in memory - view in server logs.

## Best Practices

1. **Recommended Settings**
   ```env
   MAX_LOGIN_ATTEMPTS=5
   LOGIN_LOCKOUT_DURATION=86400000
   ```

2. **Monitor Failed Attempts**
   - Review logs regularly
   - Look for patterns of repeated attacks
   - Identify compromised networks

3. **User Communication**
   - Display clear error messages (already implemented)
   - Show remaining attempts
   - Show countdown timer during lockout

4. **Incident Response**
   - Monitor for sustained brute force attacks
   - Consider implementing CAPTCHA for additional protection
   - Review and rotate credentials if compromised

## Troubleshooting

### User Locked Out

If a user is legitimately locked out:
1. Wait for lockout duration to expire
2. Or temporarily reduce `LOGIN_LOCKOUT_DURATION` in .env and restart
3. Or implement admin panel to unlock IPs (future enhancement)

### Incorrect IP Detection

If behind proxy and IP detection not working:
```javascript
// Verify IP detection in server logs
console.log('Client IP:', getClientIP(req));
```

Configure proxy:
```javascript
// In server.js
app.set('trust proxy', 1); // Trust first proxy
```

### Too Many False Positives

If legitimate users keep getting locked out:
```env
MAX_LOGIN_ATTEMPTS=10
LOGIN_LOCKOUT_DURATION=1800000
```

## Rate Limiting at Application Level

This is application-level rate limiting. For additional protection, consider:

1. **Network-level Rate Limiting** (Nginx)
   ```nginx
   limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
   
   location /api/login {
       limit_req zone=login burst=5 nodelay;
   }
   ```

2. **CAPTCHA** (for future enhancement)
   - After 3 failed attempts, require CAPTCHA
   - Prevents automated attacks

3. **Two-Factor Authentication**
   - SMS or email verification
   - Additional security layer

## Future Enhancements

1. **Admin Panel for IP Management**
   - View blocked IPs
   - Manually unblock IPs
   - Configure per-IP rules

2. **Alerting System**
   - Email/SMS on suspected attack
   - Dashboard notifications

3. **Gradual Lockout**
   - Progressive delays between attempts
   - Exponential backoff

4. **Geographic Blocking**
   - Block login from specific regions
   - Track IP location

## Security Comparison

| Feature | Before | After |
|---------|--------|-------|
| Rate Limiting | ❌ None | ✅ IP-based |
| Brute Force Protection | ❌ None | ✅ Auto-blocking |
| Attempt Logging | ❌ Basic | ✅ Detailed |
| User Feedback | ❌ None | ✅ Countdown timer |
| Configurable | ❌ No | ✅ Via .env |

## Commands Reference

```bash
# View security logs
npm run logs

# Grep for security events
npm run logs | grep SECURITY

# Monitor in real-time
tail -f logs/combined.log | grep SECURITY
```
