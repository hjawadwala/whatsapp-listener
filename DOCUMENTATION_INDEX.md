# WhatsApp Listener API - Complete Documentation Index

## 📋 Overview

This project provides a **WhatsApp messaging solution** with:
- 🔄 Receive and relay WhatsApp messages to webhook
- 📤 Send messages (text, images, videos) via API
- 🔐 Token-based authentication
- 📊 Comprehensive audit logging
- 📱 Multi-session support

---

## 📚 Documentation Guide

### For First-Time Users
1. **Start here:** [README_SEND_API.md](README_SEND_API.md)
   - Overview of features
   - Quick start in 30 seconds
   - Workflow diagram

2. **Then read:** [QUICK_START_SEND.md](QUICK_START_SEND.md)
   - Quick reference for all operations
   - Code examples (JavaScript, Python, Bash)
   - Phone number formatting

### For Detailed Information
3. **API Details:** [SEND_MESSAGE_API.md](SEND_MESSAGE_API.md)
   - Complete endpoint documentation
   - Request/response formats
   - All parameters explained

4. **API Reference:** [API_REFERENCE.md](API_REFERENCE.md)
   - All endpoints in one place
   - HTTP status codes
   - Example workflows

### For Developers
5. **Implementation:** [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
   - What was added
   - Code changes
   - Security features

6. **Troubleshooting:** [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
   - Common issues and solutions
   - Debugging steps
   - Log analysis

---

## 🎯 Common Tasks

### Task: Send a Text Message
1. Create session: `POST /api/sessions/create`
2. Get token from response
3. Send message: `POST /api/messages/text` with Bearer token
4. Check audit log: `data/sent-messages.log`

**Guide:** [QUICK_START_SEND.md](QUICK_START_SEND.md#step-3-send-messages)

### Task: Send an Image
1. Same as above
2. Use endpoint: `POST /api/messages/image`
3. Include imageUrl and optional caption

**Guide:** [SEND_MESSAGE_API.md](SEND_MESSAGE_API.md#2-send-image-message)

### Task: Monitor Message Delivery
1. Check audit log: `tail -f data/sent-messages.log`
2. Filter by status: `grep '"status":"sent"' data/sent-messages.log`
3. Find failures: `grep '"status":"failed"' data/sent-messages.log`

**Guide:** [TROUBLESHOOTING.md](TROUBLESHOOTING.md#11-audit-log-format-issues)

### Task: Debug Connection Issues
1. Check session status: `GET /api/sessions`
2. Look for status: `"connected"` or `"disconnected"`
3. If disconnected, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md#3-socket-not-connected)

### Task: Generate Authentication Token
1. Create session: `POST /api/sessions/create`
2. Response includes token and sessionId
3. Use token in all subsequent requests

**Guide:** [README_SEND_API.md](README_SEND_API.md#-quick-start-30-seconds)

---

## 🔗 File Structure

```
whatsapp-listener-A/
├── server.js                    (Main app - updated with token & send APIs)
├── package.json
├── .env                        (Environment variables)
├── README.md                   (Original project readme)
├── API_EXAMPLES.md            (Webhook examples)
│
├── 📚 Documentation/
│   ├── README_SEND_API.md           (Start here)
│   ├── QUICK_START_SEND.md          (Quick reference)
│   ├── SEND_MESSAGE_API.md          (Detailed API docs)
│   ├── API_REFERENCE.md             (Complete reference)
│   ├── IMPLEMENTATION_SUMMARY.md    (Implementation details)
│   ├── TROUBLESHOOTING.md           (Common issues)
│   └── DOCUMENTATION_INDEX.md       (This file)
│
├── 🧪 Testing/
│   └── test-api.sh                  (Automated test script)
│
├── 📁 Data/
│   ├── sent-messages.log       (Audit log for sent messages)
│   ├── messages.log            (All received messages)
│   └── payloads.log            (Webhook payloads)
│
├── 🔐 Authentication/
│   ├── auth_info/              (WhatsApp auth data)
│   └── sessions/               (Per-session data)
│
└── 📺 Media/
    └── multimedia/             (Downloaded images/videos)
```

---

## 🚀 Quick Reference Commands

### Create Session
```bash
curl -X POST http://localhost:3000/api/sessions/create
```

### Send Text Message
```bash
curl -X POST http://localhost:3000/api/messages/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"to": "919876543210", "message": "Hello!"}'
```

### Send Image
```bash
curl -X POST http://localhost:3000/api/messages/image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"to": "919876543210", "imageUrl": "https://example.com/pic.jpg", "caption": "Check this"}'
```

### Send Video
```bash
curl -X POST http://localhost:3000/api/messages/video \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"to": "919876543210", "videoUrl": "https://example.com/video.mp4", "caption": "Watch this"}'
```

### List Sessions
```bash
curl -X GET http://localhost:3000/api/sessions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Delete Session
```bash
curl -X DELETE http://localhost:3000/api/sessions/SESSION_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### View Audit Logs
```bash
tail -f data/sent-messages.log | jq '.'
```

---

## 📊 API Summary

### Authentication
All endpoints (except `/api/sessions/create`) require Bearer token:
```
Authorization: Bearer <token_from_session>
```

### Session Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/sessions/create` | Create new session (returns token) |
| GET | `/api/sessions` | List all sessions |
| DELETE | `/api/sessions/:id` | Delete session |

### Message Endpoints (all require Bearer token)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/messages/text` | Send text message |
| POST | `/api/messages/image` | Send image with caption |
| POST | `/api/messages/video` | Send video with caption |

### WebSocket Events
| Event | Data | Purpose |
|-------|------|---------|
| `qr` | `{sessionId, qr}` | New QR code generated |
| `connected` | `{sessionId, phoneNumber}` | Session connected |
| `disconnected` | `{sessionId}` | Session disconnected |

---

## 🔐 Authentication Flow

```
1. POST /api/sessions/create
   ↓
   Returns: { sessionId, token }
   ↓
2. Use token in Bearer header for all requests:
   Authorization: Bearer <token>
   ↓
3. Token validates against stored session
   ↓
4. Request allowed or rejected with 401
```

---

## 📊 Audit Logging

### What Gets Logged
- ✅ All sent messages (success)
- ✅ All failed sends (with error)
- ✅ Message metadata (to, type, caption, etc.)
- ✅ Timestamp and session ID
- ✅ WhatsApp message ID for tracking

### Where Logs Are Stored
- `data/sent-messages.log` - Sent messages only
- `data/messages.log` - Received messages
- `data/payloads.log` - Webhook payloads

### Log Format
```json
{
  "timestamp": "2026-01-15T10:30:45.123Z",
  "sessionId": "session-uuid",
  "messageId": "whatsapp-id",
  "to": "919876543210",
  "type": "text|image|video",
  "status": "sent|failed",
  "error": "error message if failed"
}
```

---

## ❓ FAQ

**Q: How do I get a token?**
A: Send `POST /api/sessions/create` to create a session. Response includes token.

**Q: Can I use the same token for multiple messages?**
A: Yes, one token per session. Use it for all messages in that session.

**Q: What if my token expires?**
A: Tokens don't expire. They remain valid until the session is deleted.

**Q: How do I format phone numbers?**
A: Country code + number (no +). Example: `919876543210` for India.

**Q: Can I send messages to multiple people?**
A: Yes, make separate API calls (no batch endpoint yet).

**Q: Where are my sent messages stored?**
A: Audit log: `data/sent-messages.log` (JSON format).

**Q: What if I lose my token?**
A: Create a new session to get a new token.

**Q: Can I view message delivery status?**
A: Check audit log for status: sent/failed. WhatsApp status in messages.log.

---

## 🧪 Testing & Verification

### Run Automated Tests
```bash
./test-api.sh

# Or with custom base URL and phone
./test-api.sh http://localhost:3000 919876543210
```

### Manual Testing Steps
1. Create session and save token
2. Send test text message
3. Verify message in audit log
4. Check recipient's WhatsApp
5. Verify audit log entry

**See:** [README_SEND_API.md](README_SEND_API.md#-testing)

---

## 🐛 Troubleshooting Quick Links

| Issue | Solution |
|-------|----------|
| Can't create session | Check if server is running on port 3000 |
| Missing token error | Add `Authorization: Bearer TOKEN` header |
| Invalid token | Create new session with `/api/sessions/create` |
| Socket not connected | Scan QR code, wait for connection |
| Message not sent | Check if session status is "connected" |
| Image not uploading | Verify URL is accessible from server |
| Can't read audit logs | Use `jq` to parse JSON: `jq '.' data/sent-messages.log` |

**Full guide:** [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## 📝 Implementation Details

### What's New
- ✅ Token generation system
- ✅ Three message sending endpoints
- ✅ Bearer token validation middleware
- ✅ Audit logging to file
- ✅ Phone number normalization
- ✅ Media file support (HTTP & local)
- ✅ Error handling and validation

### Files Modified
- `server.js` - Added token system and message endpoints

### New Dependencies
- `crypto` (Node.js built-in) - For token generation

**See:** [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)

---

## 🎓 Learning Path

1. **Beginner**: Read [README_SEND_API.md](README_SEND_API.md)
2. **Intermediate**: Follow [QUICK_START_SEND.md](QUICK_START_SEND.md)
3. **Advanced**: Study [SEND_MESSAGE_API.md](SEND_MESSAGE_API.md)
4. **Expert**: Review [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
5. **Debugging**: Reference [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## 🔄 Integration Examples

### Express.js Integration
```javascript
const token = process.env.WHATSAPP_TOKEN;
const baseUrl = process.env.WHATSAPP_BASE_URL;

async function sendWhatsAppMessage(to, message) {
  const response = await fetch(`${baseUrl}/api/messages/text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ to, message })
  });
  return response.json();
}
```

### Next.js API Route
```javascript
export default async function handler(req, res) {
  const { to, message } = req.body;
  const token = process.env.WHATSAPP_TOKEN;
  
  const response = await fetch('http://localhost:3000/api/messages/text', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ to, message })
  });
  
  res.json(await response.json());
}
```

---

## 📞 Support Resources

1. **Documentation Index**: This file
2. **Quick Start**: [QUICK_START_SEND.md](QUICK_START_SEND.md)
3. **Detailed Docs**: [SEND_MESSAGE_API.md](SEND_MESSAGE_API.md)
4. **Troubleshooting**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
5. **Test Script**: `./test-api.sh`
6. **Implementation**: [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)

---

## 🎉 Ready to Go!

You now have a complete, production-ready WhatsApp messaging API with:
- ✅ Secure token authentication
- ✅ Text, image, and video support
- ✅ Full audit trails
- ✅ Comprehensive documentation
- ✅ Testing tools

**Start here:** [README_SEND_API.md](README_SEND_API.md)

---

## 📄 Document Navigation

```
README_SEND_API.md (START HERE)
    ↓
QUICK_START_SEND.md (Quick Reference)
    ↓
SEND_MESSAGE_API.md (Detailed Docs)
    ↓
API_REFERENCE.md (Complete Reference)
    ↓
TROUBLESHOOTING.md (Problem Solving)
    ↓
IMPLEMENTATION_SUMMARY.md (Technical Details)
```

---

**Last Updated:** January 15, 2026  
**Status:** ✅ Production Ready  
**Version:** 1.0 - Send & Receive API
