# WhatsApp Multi-Session Manager

A web-based application to manage multiple WhatsApp sessions simultaneously.

## Features

- 🔗 Connect multiple WhatsApp accounts
- 📱 Web-based QR code scanning
- 📊 Real-time session status dashboard
- 💾 Persistent session storage
- 🔄 Auto-reconnection on disconnect
- 📨 Message forwarding to webhook API
- 🖼️ Image message handling with automatic media download
- 🌐 Media file hosting with public URLs

## Installation

```bash
npm install
```

## Configuration

Copy the `.env.example` file to `.env` and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server Configuration
PORT=3000
BASE_URL=http://localhost:3000

# Webhook Configuration
WEBHOOK_URL=https://neptuneerp.com/webhooks/whatsapp/webhook.php
```

### Environment Variables

- **PORT**: Server port (default: 3000)
- **BASE_URL**: Public base URL for serving media files (required for image URLs)
- **WEBHOOK_URL**: Your webhook endpoint URL for receiving messages

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. Click "Connect New Session" and scan the QR code with your WhatsApp mobile app

4. Your session will appear in the table below once connected

## Session Management

Each session:
- Has a unique Session ID
- Stores authentication in `sessions/<sessionId>/` folder
- Forwards messages to the configured webhook
- Can be deleted individually from the dashboard

## API Endpoints

- `POST /api/sessions/create` - Create a new WhatsApp session
- `GET /api/sessions` - List all active sessions
- `DELETE /api/sessions/:sessionId` - Delete a specific session

## File Structure

```
.
├── server.js              # Main server file (multi-session support)
├── index.js              # Original single-session script (deprecated)
├── public/
│   └── index.html        # Web dashboard
├── sessions/             # Session storage (one folder per session)
│   └── <sessionId>/      # Individual session auth files
├── multimedia/           # Downloaded media files (images, videos, etc.)
├── data/
│   ├── sessions.json     # Session metadata
│   ├── messages.log      # Message logs
│   └── payloads.log      # API payload logs
└── auth_info/            # Legacy auth folder (not used in multi-session)
```

## Configuration

Copy the `.env.example` file to `.env` and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server Configuration
PORT=3000
BASE_URL=http://localhost:3000

# Webhook Configuration
WEBHOOK_URL=https://neptuneerp.com/webhooks/whatsapp/webhook.php
```

### Environment Variables

- **PORT**: Server port (default: 3000)
- **BASE_URL**: Public base URL for serving media files (required for image URLs)
- **WEBHOOK_URL**: Your webhook endpoint URL for receiving messages

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. Click "Connect New Session" and scan the QR code with your WhatsApp mobile app

4. Your session will appear in the table below once connected

## Session Management

Each session:
- Has a unique Session ID
- Stores authentication in `sessions/<sessionId>/` folder
- Forwards messages to the configured webhook
- Can be deleted individually from the dashboard

## API Endpoints

- `POST /api/sessions/create` - Create a new WhatsApp session
- `GET /api/sessions` - List all active sessions
- `DELETE /api/sessions/:sessionId` - Delete a specific session

## File Structure

```
.
├── server.js              # Main server file (multi-session support)
├── index.js              # Original single-session script (deprecated)
├── .env                  # Environment configuration (create from .env.example)
├── .env.example          # Example environment configuration
├── public/
│   └── index.html        # Web dashboard
├── sessions/             # Session storage (one folder per session)
│   └── <sessionId>/      # Individual session auth files
├── multimedia/           # Downloaded media files (images, videos, etc.)
├── data/
│   ├── sessions.json     # Session metadata
│   ├── messages.log      # Message logs
│   └── payloads.log      # API payload logs
└── auth_info/            # Legacy auth folder (not used in multi-session)
```

## Production Deployment

For production, update your `.env` file with production values:

```env
PORT=3000
BASE_URL=https://yourdomain.com
WEBHOOK_URL=https://yourdomain.com/api/webhook
```

### Message Types Supported
- **Text messages**: Sent with `type: "text"`
- **Image messages**: Sent with `type: "image"` and an `image` attribute containing the public URL

## Port Configuration

The port is configured in the `.env` file. Change the `PORT` variable to use a different port.

## Notes

- Each session runs independently
- Session data persists across server restarts
- QR codes are delivered in real-time via WebSocket
- Messages are automatically forwarded to the configured webhook
