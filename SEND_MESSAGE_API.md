# WhatsApp Message Sending API Documentation

## Overview
This API allows you to send text, image, and video messages through WhatsApp using the authenticated session token.

## Authentication
All message sending endpoints require a Bearer token that is generated when a session is created.

### Getting Your Token
1. Create a new session via `POST /api/sessions/create`
2. You will receive a response with:
   - `sessionId`: Unique identifier for the session
   - `token`: Authentication token to use for sending messages

### Example Session Creation Response
```json
{
  "success": true,
  "sessionId": "uuid-string-here",
  "token": "64-character-hex-string"
}
```

### Using the Token
Include the token in the `Authorization` header of all message sending requests:
```
Authorization: Bearer YOUR_TOKEN_HERE
```

---

## Endpoints

### 1. Send Text Message
**Endpoint:** `POST /api/messages/text`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN_HERE
```

**Request Body:**
```json
{
  "to": "919876543210",
  "message": "Hello, this is a test message!"
}
```

**Parameters:**
- `to` (required): Recipient's phone number (with country code, no +)
- `message` (required): Text message content

**Response (Success):**
```json
{
  "success": true,
  "messageId": "message-id-string"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error description"
}
```

**Example cURL:**
```bash
curl -X POST http://localhost:3000/api/messages/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "to": "919876543210",
    "message": "Hello!"
  }'
```

---

### 2. Send Image Message
**Endpoint:** `POST /api/messages/image`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN_HERE
```

**Request Body:**
```json
{
  "to": "919876543210",
  "imageUrl": "https://example.com/image.jpg",
  "caption": "Check out this image!"
}
```

**Parameters:**
- `to` (required): Recipient's phone number (with country code, no +)
- `imageUrl` (required): URL of the image (can be HTTP URL or local file path)
- `caption` (optional): Caption for the image

**Response (Success):**
```json
{
  "success": true,
  "messageId": "message-id-string"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error description"
}
```

**Example cURL:**
```bash
curl -X POST http://localhost:3000/api/messages/image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "to": "919876543210",
    "imageUrl": "https://example.com/image.jpg",
    "caption": "Check this out!"
  }'
```

---

### 3. Send Video Message
**Endpoint:** `POST /api/messages/video`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN_HERE
```

**Request Body:**
```json
{
  "to": "919876543210",
  "videoUrl": "https://example.com/video.mp4",
  "caption": "Check out this video!"
}
```

**Parameters:**
- `to` (required): Recipient's phone number (with country code, no +)
- `videoUrl` (required): URL of the video (can be HTTP URL or local file path)
- `caption` (optional): Caption for the video

**Response (Success):**
```json
{
  "success": true,
  "messageId": "message-id-string"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error description"
}
```

**Example cURL:**
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

## Audit Logging

All sent messages are logged to `data/sent-messages.log` for auditing purposes.

### Log Entry Format
```json
{
  "timestamp": "2026-01-15T10:30:45.123Z",
  "sessionId": "uuid-string",
  "messageId": "whatsapp-message-id",
  "to": "919876543210",
  "type": "text|image|video",
  "status": "sent|failed",
  "message": "message content or error details"
}
```

### Reading Audit Logs
```bash
tail -f data/sent-messages.log    # Stream new logs
```

---

## Error Codes

| Status Code | Meaning |
|---|---|
| 200 | Message sent successfully |
| 400 | Bad request (missing fields, invalid format) |
| 401 | Unauthorized (invalid or missing token) |
| 500 | Server error (connection issue, etc.) |

---

## Common Errors

### "Missing authorization token"
- Ensure the `Authorization` header is included in your request
- Format: `Authorization: Bearer YOUR_TOKEN_HERE`

### "Invalid token"
- Token is either incorrect or has expired
- Create a new session to get a fresh token

### "Session not found"
- The session associated with the token was deleted
- Create a new session

### "Socket not connected"
- The WhatsApp session is not yet connected
- Wait for the session to show `status: connected` in `/api/sessions`

### "Failed to fetch image/video"
- The provided URL is not accessible
- Ensure the URL is publicly accessible or use a local file path

---

## Best Practices

1. **Store tokens securely**: Treat tokens like passwords
2. **Don't share tokens**: Each token is session-specific
3. **Monitor audit logs**: Regularly check `sent-messages.log` for failed sends
4. **Rate limiting**: Be mindful of WhatsApp's rate limits
5. **Phone number format**: Always include country code without `+`

---

## Example Workflow

```javascript
// 1. Create a session
const createResponse = await fetch('http://localhost:3000/api/sessions/create', {
  method: 'POST'
});
const { sessionId, token } = await createResponse.json();

// 2. Send a text message
const textResponse = await fetch('http://localhost:3000/api/messages/text', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    to: '919876543210',
    message: 'Hello from API!'
  })
});

// 3. Send an image
const imageResponse = await fetch('http://localhost:3000/api/messages/image', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    to: '919876543210',
    imageUrl: 'https://example.com/image.jpg',
    caption: 'Check this out!'
  })
});
```

---

## Session Management

### Check Session Status
```bash
GET /api/sessions
Authorization: Bearer YOUR_TOKEN_HERE
```

Response:
```json
{
  "sessions": [
    {
      "sessionId": "uuid",
      "phoneNumber": "919876543210",
      "status": "connected",
      "connectedAt": "2026-01-15T10:20:30.123Z"
    }
  ]
}
```

### Delete Session
```bash
DELETE /api/sessions/{sessionId}
Authorization: Bearer YOUR_TOKEN_HERE
```

---

## Support

For issues or questions, check the audit logs in `data/sent-messages.log` and `data/payloads.log`.
