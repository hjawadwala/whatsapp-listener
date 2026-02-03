# Quick Start Guide - Send Messages via WhatsApp API

## Step 1: Create a Session

```bash
curl -X POST http://localhost:3000/api/sessions/create
```

**Response:**
```json
{
  "success": true,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6..."
}
```

**Save this token** - you'll use it for all message sending requests.

---

## Step 2: Scan QR Code

Once you create a session, a QR code will appear on the dashboard. Scan it with your WhatsApp to connect the session.

---

## Step 3: Send Messages

### Send Text Message
```bash
curl -X POST http://localhost:3000/api/messages/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "to": "919876543210",
    "message": "Hello!"
  }'
```

### Send Image
```bash
curl -X POST http://localhost:3000/api/messages/image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "to": "919876543210",
    "imageUrl": "https://example.com/image.jpg",
    "caption": "Check this!"
  }'
```

### Send Video
```bash
curl -X POST http://localhost:3000/api/messages/video \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "to": "919876543210",
    "videoUrl": "https://example.com/video.mp4",
    "caption": "Watch this!"
  }'
```

---

## Step 4: Check Sent Messages Audit Log

```bash
# View last 20 sent messages
tail -20 data/sent-messages.log

# Stream new messages in real-time
tail -f data/sent-messages.log

# Search for failed messages
grep '"status":"failed"' data/sent-messages.log
```

---

## Phone Number Format

Always use the format: **Country Code + Phone Number** (without +)

| Country | Example | Format |
|---------|---------|--------|
| India | +91 98765 43210 | 919876543210 |
| USA | +1 234 567 8900 | 12345678900 |
| UK | +44 7911 123456 | 447911123456 |

---

## Key Points

✅ **Token is your session key** - Keep it safe  
✅ **Phone numbers must include country code**  
✅ **All messages are logged to `data/sent-messages.log`**  
✅ **Session must be connected before sending messages**  
✅ **Each session has its own WhatsApp account**  

---

## JavaScript Example

```javascript
const token = 'YOUR_TOKEN_HERE';
const baseUrl = 'http://localhost:3000';

async function sendMessage(to, message) {
  const response = await fetch(`${baseUrl}/api/messages/text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ to, message })
  });
  
  const data = await response.json();
  return data;
}

async function sendImage(to, imageUrl, caption) {
  const response = await fetch(`${baseUrl}/api/messages/image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ to, imageUrl, caption })
  });
  
  const data = await response.json();
  return data;
}

// Usage
await sendMessage('919876543210', 'Hello!');
await sendImage('919876543210', 'https://example.com/pic.jpg', 'My photo');
```

---

## Python Example

```python
import requests
import json

token = 'YOUR_TOKEN_HERE'
base_url = 'http://localhost:3000'
headers = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {token}'
}

def send_text(to, message):
    url = f'{base_url}/api/messages/text'
    data = {'to': to, 'message': message}
    response = requests.post(url, headers=headers, json=data)
    return response.json()

def send_image(to, image_url, caption=''):
    url = f'{base_url}/api/messages/image'
    data = {'to': to, 'imageUrl': image_url, 'caption': caption}
    response = requests.post(url, headers=headers, json=data)
    return response.json()

def send_video(to, video_url, caption=''):
    url = f'{base_url}/api/messages/video'
    data = {'to': to, 'videoUrl': video_url, 'caption': caption}
    response = requests.post(url, headers=headers, json=data)
    return response.json()

# Usage
print(send_text('919876543210', 'Hello from Python!'))
print(send_image('919876543210', 'https://example.com/pic.jpg', 'Check this'))
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Missing authorization token" | Include `Authorization: Bearer YOUR_TOKEN` header |
| "Invalid token" | Create a new session with `/api/sessions/create` |
| "Socket not connected" | Wait for QR code scan, check session status with `/api/sessions` |
| "Failed to fetch image/video" | Ensure URL is accessible from server |
| Empty `sent-messages.log` | No messages sent yet, try sending a test message |

---

## Files Generated

- `data/sent-messages.log` - All sent messages audit trail
- `data/messages.log` - All received messages
- `data/payloads.log` - API webhook payloads
