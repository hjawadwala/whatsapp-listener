# Login Functionality Added

## Overview
Login functionality has been added to the WhatsApp Manager application. Users must now authenticate with a username and password before accessing the dashboard.

## Changes Made

### 1. Environment Configuration (.env)
Created a new `.env` file with login credentials:
```
PORT=3000
APP_USERNAME=admin
APP_PASSWORD=password123
```

**Default Credentials:**
- Username: `admin`
- Password: `password123`

⚠️ **Important:** Change these credentials in production!

### 2. Server-Side Changes (server.js)

#### Added Admin Token Management
- New `adminTokens` Set to store valid admin login session tokens
- New `validateAdminToken()` middleware function to protect admin-only endpoints

#### New Login Endpoint
```
POST /api/login
Content-Type: application/json
{
  "username": "admin",
  "password": "password123"
}

Response (Success):
{
  "success": true,
  "token": "token_here"
}

Response (Failure):
{
  "success": false,
  "error": "Invalid username or password"
}
```

#### Protected Endpoints
All session management endpoints now require admin authentication:
- `POST /api/sessions/create` - Create new session
- `GET /api/sessions` - List sessions  
- `POST /api/sessions/:sessionId/refresh-token` - Refresh token
- `DELETE /api/sessions/:sessionId` - Delete session

The message sending endpoint `/api/messages/send` still requires the WhatsApp session token (unchanged).

### 3. UI Changes (public/index.html)

#### Login Page
- Clean login interface with username and password fields
- Error message display
- Loading state during authentication
- Stored admin token in localStorage for session persistence

#### Dashboard Updates
- Added logout button in the header
- Protected main page - only visible after successful login
- Auto-logout on token expiration (401 response)
- Session storage using localStorage

#### JavaScript Functions Added
```javascript
handleLogin(event)           // Process login form submission
handleLogout()               // Clear session and return to login
showLoginPage()              // Display login interface
showMainPage()               // Display dashboard
getAuthHeaders()             // Get headers with admin token
```

#### Modified Functions
Updated all API calls to include `validateAdminToken` headers:
- `initiateConnection()`
- `loadSessions()`
- `refreshToken()`
- `deleteSession()`

## Usage

### First Login
1. Open the application in your browser
2. Enter default credentials:
   - Username: `admin`
   - Password: `password123`
3. Click "Sign In"
4. Access the dashboard and manage sessions

### For Each API Request
All WhatsApp message API requests require:
```bash
curl -X POST http://localhost:3000/api/messages/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer WHATSAPP_SESSION_TOKEN" \
  -d '{
    "to": "919876543210",
    "type": "text",
    "message": "Hello!"
  }'
```

### Logout
Click the "🚪 Logout" button in the header to end your session.

## Security Considerations

1. **Change Default Credentials:** Update `APP_USERNAME` and `APP_PASSWORD` in `.env`
2. **HTTPS in Production:** Use HTTPS to prevent token interception
3. **Token Expiration:** Consider adding token expiration time limits
4. **Environment Variables:** Never commit `.env` to version control

## Flow Diagram

```
User → Login Page → Authenticate → Get Admin Token → Stored in localStorage
  ↓
  Dashboard (Protected) → All Admin Endpoints require Admin Token
  ↓
  Create Session → Get WhatsApp Session Token → Send Messages with Session Token
```
