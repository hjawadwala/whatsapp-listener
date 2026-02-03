# Troubleshooting Guide - Message Sending API

## Common Issues & Solutions

### 1. "Missing authorization token"

**Problem:** 
```
{
  "success": false,
  "error": "Missing authorization token"
}
```

**Causes:**
- Header not included in request
- Wrong header format

**Solutions:**
```bash
# ❌ Wrong - no header
curl -X POST http://localhost:3000/api/messages/text

# ✅ Correct - with Bearer token
curl -X POST http://localhost:3000/api/messages/text \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Check your header format:**
- Must be: `Authorization: Bearer <token>`
- Not: `Authorization: Token <token>`
- Not: `Authorization: <token>`

---

### 2. "Invalid token" or "Session not found"

**Problem:**
```
{
  "success": false,
  "error": "Invalid token"
}
```

**Causes:**
- Token is incorrect
- Token is outdated
- Session was deleted
- Token is corrupted

**Solutions:**
1. Create a new session:
   ```bash
   curl -X POST http://localhost:3000/api/sessions/create
   ```
   
2. Copy the token from response exactly (no spaces at end)

3. Verify token works:
   ```bash
   curl -X GET http://localhost:3000/api/sessions \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

---

### 3. "Socket not connected"

**Problem:**
```
{
  "success": false,
  "error": "Socket not connected"
}
```

**Causes:**
- Session not yet connected to WhatsApp
- Connection was lost
- QR code not scanned

**Solutions:**
1. Check session status:
   ```bash
   curl -X GET http://localhost:3000/api/sessions \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. Look for status field - must be `"connected"`

3. If status is `"connecting"`:
   - Wait a few seconds
   - Check dashboard for QR code
   - Scan with WhatsApp on phone

4. If status is `"disconnected"`:
   - Session may have logged out
   - Create a new session

---

### 4. Missing Required Fields

**Problem:**
```
{
  "success": false,
  "error": "Missing \"to\" or \"message\" field"
}
```

**Causes:**
- Missing `to` field (phone number)
- Missing `message` field (message content)
- Wrong request body format

**Solution - Correct format:**
```bash
curl -X POST http://localhost:3000/api/messages/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "to": "919876543210",
    "message": "Hello"
  }'
```

**Required fields by endpoint:**

| Endpoint | Required Fields |
|----------|-----------------|
| /messages/text | `to`, `message` |
| /messages/image | `to`, `imageUrl` |
| /messages/video | `to`, `videoUrl` |

---

### 5. "Failed to fetch image" or "Failed to fetch video"

**Problem:**
```
{
  "success": false,
  "error": "Failed to fetch image: FetchError: ..."
}
```

**Causes:**
- URL is not accessible from server
- File path doesn't exist
- Network connectivity issue
- URL is behind authentication
- CORS restriction

**Solutions:**

1. **Test if URL is accessible:**
   ```bash
   # From server machine
   curl -I https://example.com/image.jpg
   ```

2. **Use local file path:**
   ```bash
   curl -X POST http://localhost:3000/api/messages/image \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{
       "to": "919876543210",
       "imageUrl": "/home/hj/Downloads/photo.jpg"
     }'
   ```

3. **Ensure file exists:**
   ```bash
   ls -la /path/to/file
   ```

4. **Check file permissions:**
   ```bash
   # File must be readable
   chmod 644 /path/to/file
   ```

---

### 6. Phone Number Format Issues

**Problem:**
Message appears to go through but doesn't arrive

**Causes:**
- Missing country code
- Invalid phone number format
- Using + or spaces in number

**Solutions:**

**Correct format:**
```json
{
  "to": "919876543210"
}
```

**Not these:**
```json
{
  "to": "+919876543210",   // ❌ Don't include +
  "to": "91 9876 543210",  // ❌ Don't include spaces
  "to": "9876543210",      // ❌ Must include country code
  "to": "+91-98765-43210"  // ❌ Don't include + or hyphens
}
```

**Country codes:**
- India: 91
- USA: 1
- UK: 44
- Canada: 1

Format: `<country_code><number_without_+>`

---

### 7. No Messages in Audit Log

**Problem:**
Messages sent but not in `data/sent-messages.log`

**Causes:**
- `data/` directory doesn't exist
- Permission issues
- No messages actually sent
- Wrong file path

**Solutions:**

1. **Check if data directory exists:**
   ```bash
   ls -la data/
   ```

2. **Create if missing:**
   ```bash
   mkdir -p data/
   ```

3. **Check permissions:**
   ```bash
   # Directory must be writable
   chmod 755 data/
   
   # If file exists, must be writable
   chmod 644 data/sent-messages.log
   ```

4. **View log file:**
   ```bash
   # View last 10 entries
   tail -10 data/sent-messages.log
   
   # Pretty print
   tail -10 data/sent-messages.log | jq '.'
   
   # Search for failures
   grep '"status":"failed"' data/sent-messages.log
   ```

---

### 8. Session Created But No QR Code

**Problem:**
Session created but no QR appears on dashboard

**Causes:**
- Socket.io connection not working
- Dashboard not loaded
- Browser caching issue

**Solutions:**

1. **Check if server is running:**
   ```bash
   curl -s http://localhost:3000/api/sessions | jq '.'
   ```

2. **Check browser console:**
   - Open browser DevTools (F12)
   - Look for Socket.io connection errors

3. **Clear browser cache:**
   - Hard refresh: Ctrl+Shift+R or Cmd+Shift+R

4. **Check browser logs:**
   ```bash
   # In browser console, run:
   console.log('Socket.io version:', io.version)
   ```

---

### 9. "Content-Type" Related Errors

**Problem:**
Request returns unexpected format or error

**Causes:**
- Missing Content-Type header
- Wrong Content-Type value

**Solution:**
Always include this header:
```bash
-H "Content-Type: application/json"
```

**Correct cURL:**
```bash
curl -X POST http://localhost:3000/api/messages/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"to": "919876543210", "message": "Hello"}'
```

---

### 10. Token Works in Postman But Not in Code

**Problem:**
Manual API testing works, but application fails

**Causes:**
- Token copied with extra spaces/characters
- String encoding issues
- Token expired between tests
- Code syntax error

**Solutions:**

1. **Remove whitespace:**
   ```javascript
   // ❌ Wrong
   const token = " a1b2c3d4 ";
   
   // ✅ Correct
   const token = "a1b2c3d4".trim();
   ```

2. **Check header format in code:**
   ```javascript
   // ✅ Correct
   headers: {
     'Authorization': `Bearer ${token}`,
     'Content-Type': 'application/json'
   }
   ```

3. **Log the request:**
   ```javascript
   console.log('URL:', url);
   console.log('Headers:', headers);
   console.log('Body:', body);
   ```

4. **Get fresh token if needed:**
   ```javascript
   // Create new session if old token fails
   const sessionRes = await fetch('http://localhost:3000/api/sessions/create');
   const { token: newToken } = await sessionRes.json();
   ```

---

### 11. Audit Log Format Issues

**Problem:**
Can't read or parse audit log

**Solutions:**

1. **Parse JSON from log:**
   ```bash
   # Pretty print each line
   cat data/sent-messages.log | jq '.'
   ```

2. **Find specific messages:**
   ```bash
   # Find all failures
   grep '"status":"failed"' data/sent-messages.log | jq '.'
   
   # Find messages to specific number
   grep '"to":"919876543210"' data/sent-messages.log | jq '.'
   
   # Find messages in last hour
   cat data/sent-messages.log | jq 'select(.timestamp > "2026-01-15T09:00:00")'
   ```

3. **Count messages:**
   ```bash
   wc -l data/sent-messages.log
   ```

---

### 12. Rate Limiting Issues

**Problem:**
Messages fail after sending many quickly

**Causes:**
- Hitting WhatsApp rate limits
- Too many concurrent requests
- Session flagged for unusual activity

**Solutions:**

1. **Add delays between messages:**
   ```javascript
   // Wait 1-2 seconds between messages
   await new Promise(r => setTimeout(r, 1000));
   await sendMessage(to, text);
   ```

2. **Use batch processing:**
   ```javascript
   for (const number of numbers) {
     await sendMessage(number, text);
     await delay(2000);  // 2 second delay
   }
   ```

3. **Monitor audit logs:**
   ```bash
   # Check for patterns in failures
   grep '"status":"failed"' data/sent-messages.log | tail -20
   ```

---

### 13. Database/Storage Issues

**Problem:**
Error creating or updating session files

**Causes:**
- Disk full
- Permission denied
- Corrupted session files

**Solutions:**

1. **Check disk space:**
   ```bash
   df -h
   ```

2. **Check permissions:**
   ```bash
   ls -la data/
   ls -la sessions/
   ```

3. **Fix permissions:**
   ```bash
   chmod -R 755 data/
   chmod -R 755 sessions/
   ```

4. **Clear old session files (caution):**
   ```bash
   # Backup first!
   cp -r sessions/ sessions.backup/
   
   # Remove specific session
   rm -rf sessions/SESSION_ID_HERE/
   ```

---

## Debugging Steps

### Step 1: Verify Server is Running
```bash
curl -s http://localhost:3000/api/sessions | jq '.'
# Should return: { "sessions": [] }
```

### Step 2: Create Fresh Session
```bash
curl -X POST http://localhost:3000/api/sessions/create | jq '.'
# Save the token
```

### Step 3: Test with Simple Text
```bash
curl -X POST http://localhost:3000/api/messages/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"to": "919876543210", "message": "test"}'
```

### Step 4: Check Logs
```bash
# Server logs (in terminal running server)
# Look for: [sessionId] Text message sent to...

# Audit logs
tail -5 data/sent-messages.log | jq '.'
```

### Step 5: Verify Session Status
```bash
curl -s http://localhost:3000/api/sessions \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.'
# Status must be "connected"
```

---

## Getting Help

1. **Check this troubleshooting guide first**
2. **Review audit logs:** `data/sent-messages.log`
3. **Check server console output**
4. **Read:** [SEND_MESSAGE_API.md](SEND_MESSAGE_API.md)
5. **Read:** [API_REFERENCE.md](API_REFERENCE.md)

---

## Test Script

Run the included test script:
```bash
./test-api.sh

# Or with custom parameters:
./test-api.sh http://localhost:3000 919876543210
```

This will test:
- Session creation
- Token validation
- Text message sending
- Auth rejection
- Field validation
- Audit logging
