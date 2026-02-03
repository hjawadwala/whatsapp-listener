# API Summary - Complete Reference

## Base URL
```
http://localhost:3000
```

## Authentication
All message endpoints require Bearer token authentication:
```
Authorization: Bearer <token_from_session_creation>
```

---

## Session Management Endpoints

### 1. Create New Session
```
POST /api/sessions/create
```

**Headers:**
```
Content-Type: application/json
```

**Request Body:** (empty)

**Response:**
```json
{
  "success": true,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0"
}
```

**cURL:**
```bash
curl -X POST http://localhost:3000/api/sessions/create
```

---

### 2. List All Sessions
```
GET /api/sessions
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "sessions": [
    {
      "sessionId": "550e8400-e29b-41d4-a716-446655440000",
      "phoneNumber": "919876543210",
      "status": "connected",
      "connectedAt": "2026-01-15T10:30:45.123Z"
    }
  ]
}
```

**cURL:**
```bash
curl -X GET http://localhost:3000/api/sessions \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

### 3. Delete Session
```
DELETE /api/sessions/:sessionId
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true
}
```

**cURL:**
```bash
curl -X DELETE http://localhost:3000/api/sessions/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Message Sending Endpoints

All message endpoints require Bearer token authentication.

### 1. Send Text Message
```
POST /api/messages/text
```

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "to": "919876543210",
  "message": "Your message here"
}
```

**Response (Success):**
```json
{
  "success": true,
  "messageId": "3EB0601DAAF2EF6BE85000"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Socket not connected"
}
```

**Audit Log Entry:**
```json
{
  "timestamp": "2026-01-15T10:30:45.123Z",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "messageId": "3EB0601DAAF2EF6BE85000",
  "to": "919876543210",
  "type": "text",
  "status": "sent",
  "messageLength": 17
}
```

---

### 2. Send Image Message
```
POST /api/messages/image
```

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "to": "919876543210",
  "imageUrl": "https://example.com/image.jpg",
  "caption": "This is a caption"
}
```

**Parameters:**
- `to`: Phone number with country code
- `imageUrl`: URL to image (http/https) or local file path
- `caption`: Optional image caption

**Response (Success):**
```json
{
  "success": true,
  "messageId": "3EB0601DAAF2EF6BE85001"
}
```

**Audit Log Entry:**
```json
{
  "timestamp": "2026-01-15T10:30:45.123Z",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "messageId": "3EB0601DAAF2EF6BE85001",
  "to": "919876543210",
  "type": "image",
  "status": "sent",
  "imageUrl": "https://example.com/image.jpg",
  "caption": "This is a caption"
}
```

---

### 3. Send Video Message
```
POST /api/messages/video
```

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "to": "919876543210",
  "videoUrl": "https://example.com/video.mp4",
  "caption": "This is a video"
}
```

**Parameters:**
- `to`: Phone number with country code
- `videoUrl`: URL to video (http/https) or local file path
- `caption`: Optional video caption

**Response (Success):**
```json
{
  "success": true,
  "messageId": "3EB0601DAAF2EF6BE85002"
}
```

**Audit Log Entry:**
```json
{
  "timestamp": "2026-01-15T10:30:45.123Z",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "messageId": "3EB0601DAAF2EF6BE85002",
  "to": "919876543210",
  "type": "video",
  "status": "sent",
  "videoUrl": "https://example.com/video.mp4",
  "caption": "This is a video"
}
```

---

## Error Responses

### Authentication Errors

**Missing Token:**
```json
{
  "success": false,
  "error": "Missing authorization token"
}
```

**Invalid Token:**
```json
{
  "success": false,
  "error": "Invalid token"
}
```

**Session Not Found:**
```json
{
  "success": false,
  "error": "Session not found"
}
```

### Request Validation Errors

**Missing Fields:**
```json
{
  "success": false,
  "error": "Missing \"to\" or \"message\" field"
}
```

**Connection Error:**
```json
{
  "success": false,
  "error": "Socket not connected"
}
```

**Media Fetch Error:**
```json
{
  "success": false,
  "error": "Failed to fetch image: Error message"
}
```

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (auth error) |
| 500 | Server error |

---

## Audit Logging

### Log Files Location
- Text messages received: `data/messages.log`
- Messages sent: `data/sent-messages.log`
- API payloads: `data/payloads.log`

### Sent Message Log Format
```json
{
  "timestamp": "2026-01-15T10:30:45.123Z",
  "sessionId": "uuid-string",
  "messageId": "whatsapp-id",
  "to": "919876543210",
  "type": "text|image|video",
  "status": "sent|failed",
  "error": "error message if failed",
  "message": "optional message content"
}
```

---

## Token Generation

- Tokens are generated automatically when a session is created
- Tokens are 64-character hexadecimal strings
- Each session has a unique token
- Tokens are session-specific and cannot be transferred
- Deleting a session invalidates its token

---

## Rate Limiting

WhatsApp has built-in rate limits:
- Text messages: Generally no limit but avoid spam
- Media messages: Varies by account
- Recommend: Wait 1-2 seconds between messages

---

## Complete Workflow Example

```bash
# 1. Create session
SESSION_RESPONSE=$(curl -X POST http://localhost:3000/api/sessions/create)
SESSION_ID=$(echo $SESSION_RESPONSE | jq -r '.sessionId')
TOKEN=$(echo $SESSION_RESPONSE | jq -r '.token')

echo "Session ID: $SESSION_ID"
echo "Token: $TOKEN"

# 2. (Scan QR code with WhatsApp)

# 3. Send text message
curl -X POST http://localhost:3000/api/messages/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "to": "919876543210",
    "message": "Hello from API!"
  }'

# 4. Check audit logs
tail -f data/sent-messages.log
```

---

## Support & Debugging

For detailed troubleshooting, see [SEND_MESSAGE_API.md](SEND_MESSAGE_API.md) and [QUICK_START_SEND.md](QUICK_START_SEND.md).
