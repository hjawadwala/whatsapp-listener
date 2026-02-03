# Web Dashboard Quick Reference

## New Features Available

### 🔑 Token Display on Dashboard

Your authentication tokens are now visible directly on the web dashboard.

**Location:** Active Sessions table → Authentication Token column

**Features:**
- Token displayed next to each session
- "Copy" button to copy token to clipboard
- Token shown when session is created
- Full token available, truncated in table for readability

---

## How to Use

### Get Your Token

**Option 1: When Creating Session**
1. Click "Connect New Session"
2. Token appears with "Copy Token" button
3. Click to copy before scanning QR code

**Option 2: From Active Sessions Table**
1. Look at the "Authentication Token" column
2. Click "Copy" button next to any session
3. Token copied to clipboard

---

### Use Token in API Requests

Once you have the token, use it in any API call:

**Example 1: Send Text Message**
```bash
curl -X POST http://localhost:3000/api/messages/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "to": "919876543210",
    "message": "Hello!"
  }'
```

**Example 2: Send Image**
```bash
curl -X POST http://localhost:3000/api/messages/image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "to": "919876543210",
    "imageUrl": "https://example.com/photo.jpg",
    "caption": "Check this!"
  }'
```

---

### View API Documentation

**On Dashboard:**
1. Click "📚 API Docs" tab
2. View complete documentation
3. See examples in JavaScript, Python, cURL
4. Learn phone number format
5. Check HTTP status codes

**In Browser:**
Navigate to: `http://localhost:3000`

**Tabs:**
- 📱 Sessions - Manage your WhatsApp connections
- 📚 API Docs - Complete API reference

---

## Feature Details

### Automatic Number Detection

The system automatically knows which phone number to use based on your token:

```
Token you provide
    ↓
Backend maps token → Session ID
    ↓
Backend maps Session ID → Phone Number
    ↓
Message sent from that number
```

**You don't need to specify the number - just use the token!**

---

### Copy Token Workflow

```
1. Click "Copy" button
2. Token copied to clipboard
3. See success message: "✓ Token copied to clipboard!"
4. Paste anywhere (curl, code, etc.)
```

---

## Active Sessions Table

### Columns

| Column | Description |
|--------|-------------|
| Session ID | Unique session identifier (truncated) |
| Mobile Number | WhatsApp phone number for this session |
| Authentication Token | Your API token with Copy button |
| Status | connected / disconnected / connecting |
| Connected At | When session was established |
| Action | Delete button to remove session |

---

## API Endpoints (from Dashboard)

### 1. Send Text Message
```
POST /api/messages/text
Headers: Authorization: Bearer TOKEN
Body: { to: "PHONE_NUMBER", message: "text" }
```

### 2. Send Image
```
POST /api/messages/image
Headers: Authorization: Bearer TOKEN
Body: { to: "PHONE_NUMBER", imageUrl: "URL", caption: "optional" }
```

### 3. Send Video
```
POST /api/messages/video
Headers: Authorization: Bearer TOKEN
Body: { to: "PHONE_NUMBER", videoUrl: "URL", caption: "optional" }
```

---

## Common Tasks

### Task: Send Message from Dashboard-Created Session

1. Create new session (+ Connect New Session)
2. Copy the token shown
3. Use token in API call:
   ```bash
   curl -X POST http://localhost:3000/api/messages/text \
     -H "Authorization: Bearer COPIED_TOKEN" \
     -d '{"to": "919876543210", "message": "Hi!"}'
   ```

### Task: Use Token in Application

```javascript
const token = document.querySelector('.token-display').textContent;

async function sendMessage(message) {
  const response = await fetch('http://localhost:3000/api/messages/text', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: '919876543210',
      message: message
    })
  });
  return response.json();
}
```

### Task: Find Specific Session's Token

1. Look at Active Sessions table
2. Find your phone number in "Mobile Number" column
3. Click "Copy" in the "Authentication Token" column
4. Token is now in clipboard

---

## Phone Number Format

**Always use:** Country Code + Phone Number (no + or spaces)

| Country | Format | Example |
|---------|--------|---------|
| India | 91 + number | 919876543210 |
| USA | 1 + number | 12345678900 |
| UK | 44 + number | 447911123456 |
| Canada | 1 + number | 14165551234 |

---

## Troubleshooting

### "Token copied" message doesn't appear
- Try refreshing the page
- Check browser console (F12) for errors

### Can't find my token
1. Check Active Sessions table
2. If empty, create a new session first
3. Token appears immediately after creation

### Token doesn't work in API
- Make sure you copied the full token (not truncated version)
- Check header format: `Authorization: Bearer TOKEN`
- Verify session status is "connected"

### Session shows "Connecting"
- It may take a few seconds
- Scan QR code with WhatsApp
- Wait for status to change to "connected"

---

## Session Lifecycle

```
Create Session
    ↓
Token generated (shown on dashboard)
    ↓
QR code displayed
    ↓
Scan QR with WhatsApp
    ↓
Status changes to "connected"
    ↓
Ready to send messages
    ↓
Token visible in Active Sessions table
    ↓
Use token in API calls
    ↓
(Optional) Delete session when done
```

---

## Security Tips

1. **Keep tokens safe** - Treat like passwords
2. **Don't share tokens** - Each session is independent
3. **Copy via dashboard** - Easier than manual selection
4. **Use HTTPS** - In production, always use encrypted connection
5. **Regenerate if needed** - Delete and create new session

---

## Dashboard URL

```
http://localhost:3000
```

**Tabs Available:**
- 📱 Sessions Tab - Create sessions, view tokens, manage connections
- 📚 API Docs Tab - Complete API documentation

---

## API Documentation Tab Contents

### Sections
- Authentication info
- All 3 message endpoints
- Request/response formats
- Code examples (JS, Python, cURL)
- Phone number format guide
- HTTP status codes

### Copy-Paste Ready
- All code examples are ready to use
- Just replace YOUR_TOKEN_HERE with actual token
- Works with cURL, Node.js, Python, etc.

---

## Benefits of Token on Dashboard

✅ **Easy to find** - Always visible in one place  
✅ **Quick copy** - One click to clipboard  
✅ **No manual typing** - Avoid token mistakes  
✅ **Session tracking** - See token for each number  
✅ **Built-in docs** - Learn API without leaving dashboard  
✅ **No API calls needed** - Everything on the dashboard  

---

## Next Steps

1. **Create a session**
   - Click "Connect New Session"

2. **Copy your token**
   - See it displayed, click "Copy Token"

3. **View API docs**
   - Click "API Docs" tab

4. **Send a message**
   - Use your token in an API call

5. **Check the audit log**
   - View `data/sent-messages.log`

---

## Quick Links

- 📱 Dashboard: http://localhost:3000
- 📖 Full API Docs: [SEND_MESSAGE_API.md](SEND_MESSAGE_API.md)
- 🚀 Quick Start: [QUICK_START_SEND.md](QUICK_START_SEND.md)
- 🐛 Troubleshooting: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

**Everything you need is now on the dashboard!** 🎉

Open http://localhost:3000 and start using your tokens.
