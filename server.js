require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, getContentType, downloadMediaMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.json());
app.use(express.static('public'));
app.use('/multimedia', express.static('multimedia'));

// Store active WhatsApp sessions
const sessions = new Map();
const sessionsFile = path.join(__dirname, 'data', 'sessions.json');
const sessionTokens = new Map(); // Store session tokens
const adminTokens = new Set(); // Store valid admin login tokens

// IP-based rate limiting and blocking
const loginAttempts = new Map(); // Track login attempts per IP: { ip: { count: 0, firstAttemptTime: 0 } }
const blockedIPs = new Map(); // Track blocked IPs: { ip: blockedUntilTimestamp }
const blockedIPsFile = path.join(__dirname, 'data', 'blocked-ips.json');

// Security configuration from environment
const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');
const LOGIN_LOCKOUT_DURATION = parseInt(process.env.LOGIN_LOCKOUT_DURATION || '86400000'); // 24 hours in ms

// Helper functions
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

// Save blocked IPs to file
function saveBlockedIPs() {
    try {
        ensureDir(path.dirname(blockedIPsFile));
        const blockedData = Array.from(blockedIPs.entries()).map(([ip, blockedUntil]) => ({
            ip,
            blockedUntil,
            blockedAt: new Date(blockedUntil - LOGIN_LOCKOUT_DURATION).toISOString()
        }));
        fs.writeFileSync(blockedIPsFile, JSON.stringify(blockedData, null, 2));
        console.log(`[SECURITY] Saved ${blockedData.length} blocked IP(s) to file`);
    } catch (err) {
        console.error('[SECURITY] Failed to save blocked IPs:', err);
    }
}

// Load blocked IPs from file
function loadBlockedIPs() {
    try {
        if (fs.existsSync(blockedIPsFile)) {
            const data = JSON.parse(fs.readFileSync(blockedIPsFile, 'utf8'));
            const now = Date.now();
            let activeBlocks = 0;
            let expiredBlocks = 0;
            
            data.forEach(entry => {
                if (entry.blockedUntil > now) {
                    blockedIPs.set(entry.ip, entry.blockedUntil);
                    activeBlocks++;
                } else {
                    expiredBlocks++;
                }
            });
            
            if (activeBlocks > 0) {
                console.log(`[SECURITY] Loaded ${activeBlocks} active blocked IP(s) from file`);
            }
            if (expiredBlocks > 0) {
                console.log(`[SECURITY] Removed ${expiredBlocks} expired block(s)`);
                saveBlockedIPs(); // Update file to remove expired blocks
            }
        }
    } catch (err) {
        console.error('[SECURITY] Failed to load blocked IPs:', err);
    }
}

// Get client IP address
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress || 
           '0.0.0.0';
}

// Check if IP is blocked
function isIPBlocked(ip) {
    if (!blockedIPs.has(ip)) return false;
    
    const blockedUntil = blockedIPs.get(ip);
    if (Date.now() > blockedUntil) {
        // Block period has expired
        blockedIPs.delete(ip);
        loginAttempts.delete(ip);
        saveBlockedIPs(); // Update file
        return false;
    }
    return true;
}

// Get remaining lockout time in seconds
function getRemainingLockoutTime(ip) {
    if (!blockedIPs.has(ip)) return 0;
    const blockedUntil = blockedIPs.get(ip);
    const remaining = blockedUntil - Date.now();
    return Math.ceil(remaining / 1000);
}

// Record failed login attempt
function recordFailedAttempt(ip) {
    const now = Date.now();
    
    if (!loginAttempts.has(ip)) {
        loginAttempts.set(ip, { count: 1, firstAttemptTime: now });
    } else {
        const attempts = loginAttempts.get(ip);
        attempts.count += 1;
        
        // Reset counter if more than 1 hour has passed since first attempt
        if (now - attempts.firstAttemptTime > 3600000) {
            loginAttempts.set(ip, { count: 1, firstAttemptTime: now });
        }
    }
    
    const currentAttempts = loginAttempts.get(ip);
    
    // Block IP if max attempts exceeded
    if (currentAttempts.count >= MAX_LOGIN_ATTEMPTS) {
        const blockedUntil = now + LOGIN_LOCKOUT_DURATION;
        blockedIPs.set(ip, blockedUntil);
        saveBlockedIPs(); // Save to file
        console.warn(`[SECURITY] IP ${ip} blocked until ${new Date(blockedUntil).toISOString()} after ${currentAttempts.count} failed attempts`);
        return { blocked: true, remainingTime: LOGIN_LOCKOUT_DURATION / 1000 };
    }
    
    return { blocked: false, attemptsRemaining: MAX_LOGIN_ATTEMPTS - currentAttempts.count };
}

// Reset login attempts for IP on successful login
function resetLoginAttempts(ip) {
    loginAttempts.delete(ip);
}

// Download and save media from WhatsApp message
async function downloadMedia(message, sessionId) {
    try {
        const buffer = await downloadMediaMessage(
            message,
            'buffer',
            {},
            { 
                logger: pino({ level: 'silent' }),
                reuploadRequest: () => Promise.resolve()
            }
        );
        
        if (!buffer) return null;

        const multimediaDir = path.join(__dirname, 'multimedia');
        ensureDir(multimediaDir);

        // Get file extension from mimetype
        const content = unwrapContent(message);
        const imageMsg = content?.imageMessage;
        const mimetype = imageMsg?.mimetype || 'image/jpeg';
        const ext = mimetype.split('/')[1] || 'jpg';

        // Create unique filename
        const filename = `${sessionId}_${Date.now()}_${uuidv4()}.${ext}`;
        const filepath = path.join(multimediaDir, filename);

        // Save file
        fs.writeFileSync(filepath, buffer);
        console.log(`[${sessionId}] Media saved: ${filename}`);

        // Return public URL
        return `/multimedia/${filename}`;
    } catch (err) {
        console.error(`[${sessionId}] Failed to download media:`, err);
        return null;
    }
}

function jidToNumber(jid, sessionId = null) {
    if (!jid) return null;
    const bare = String(jid).split('@')[0];
    const user = bare.split(':')[0];

    try {
        // Only use session-specific directory for strict session isolation
        if (sessionId) {
            const sessionMapPath = path.join(process.cwd(), 'sessions', sessionId, `lid-mapping-${user}_reverse.json`);
            if (fs.existsSync(sessionMapPath)) {
                const raw = fs.readFileSync(sessionMapPath, 'utf8');
                const val = JSON.parse(raw);
                if (val && typeof val === 'string') return val.trim();
            }
        }
    } catch (e) {
        // fall back to user as-is
    }

    return user || null;
}



function storeSentMessage(record) {
    try {
        const dir = path.join(process.cwd(), 'data');
        ensureDir(dir);
        const file = path.join(dir, 'sent-messages.log');
        fs.appendFileSync(file, JSON.stringify(record) + '\n', 'utf8');
    } catch (e) {
        console.error('Failed to store sent message:', e);
    }
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function validateToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, error: 'Missing authorization token' });
    }

    let sessionId = null;
    for (const [id, tokenValue] of sessionTokens.entries()) {
        if (tokenValue === token) {
            sessionId = id;
            break;
        }
    }

    if (!sessionId) {
        return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    if (!sessions.has(sessionId)) {
        return res.status(401).json({ success: false, error: 'Session not found' });
    }

    req.sessionId = sessionId;
    req.session = sessions.get(sessionId);
    next();
}

function validateAdminToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, error: 'Missing authorization token' });
    }

    if (!adminTokens.has(token)) {
        return res.status(401).json({ success: false, error: 'Invalid or expired admin token' });
    }

    req.adminToken = token;
    next();
}

function unwrapContent(message) {
    let content = message?.message || {};
    if (content?.ephemeralMessage) content = content.ephemeralMessage.message;
    if (content?.viewOnceMessageV2) content = content.viewOnceMessageV2.message;
    if (content?.documentWithCaptionMessage) content = content.documentWithCaptionMessage.message;
    return content || {};
}

function extractMessageDetails(msg) {
    const content = unwrapContent(msg);
    const type = getContentType(content);

    const base = {
        id: msg.key?.id,
        from: msg.key?.remoteJid,
        fromMe: Boolean(msg.key?.fromMe),
        pushName: msg.pushName || null,
        timestamp: Number(msg.messageTimestamp) || Date.now(),
        type: type || 'unknown',
    };

    const out = { ...base };

    switch (type) {
        case 'conversation': {
            out.text = content.conversation || '';
            break;
        }
        case 'extendedTextMessage': {
            out.text = content.extendedTextMessage?.text || '';
            break;
        }
        case 'imageMessage': {
            const im = content.imageMessage || {};
            out.caption = im.caption || '';
            out.media = { kind: 'image', mimetype: im.mimetype, fileLength: im.fileLength };
            break;
        }
        case 'videoMessage': {
            const vm = content.videoMessage || {};
            out.caption = vm.caption || '';
            out.media = { kind: 'video', mimetype: vm.mimetype, fileLength: vm.fileLength };
            break;
        }
        case 'audioMessage': {
            const am = content.audioMessage || {};
            out.media = { kind: 'audio', mimetype: am.mimetype, ptt: am.ptt, seconds: am.seconds };
            break;
        }
        case 'documentMessage': {
            const dm = content.documentMessage || {};
            out.caption = dm.caption || '';
            out.media = { kind: 'document', mimetype: dm.mimetype, fileName: dm.fileName, fileLength: dm.fileLength };
            break;
        }
        case 'stickerMessage': {
            const sm = content.stickerMessage || {};
            out.media = { kind: 'sticker', mimetype: sm.mimetype, isAnimated: sm.isAnimated };
            break;
        }
        case 'contactMessage': {
            const cm = content.contactMessage || {};
            out.contact = { displayName: cm.displayName, vcard: cm.vcard };
            break;
        }
        case 'contactsArrayMessage': {
            const ca = content.contactsArrayMessage || {};
            out.contacts = (ca.contacts || []).map(c => ({ displayName: c?.displayName, vcard: c?.vcard }));
            break;
        }
        case 'locationMessage': {
            const lm = content.locationMessage || {};
            out.location = { latitude: lm.degreesLatitude, longitude: lm.degreesLongitude, name: lm.name, address: lm.address };
            break;
        }
        case 'liveLocationMessage': {
            const ll = content.liveLocationMessage || {};
            out.location = { latitude: ll.degreesLatitude, longitude: ll.degreesLongitude, accuracy: ll.accuracyInMeters };
            break;
        }
        case 'buttonsResponseMessage': {
            const br = content.buttonsResponseMessage || {};
            out.interactive = { kind: 'buttons', buttonId: br.selectedButtonId, displayText: br.selectedDisplayText };
            break;
        }
        case 'templateButtonReplyMessage': {
            const tr = content.templateButtonReplyMessage || {};
            out.interactive = { kind: 'template', buttonId: tr.selectedId, displayText: tr.selectedDisplayText };
            break;
        }
        case 'listResponseMessage': {
            const lr = content.listResponseMessage || {};
            out.interactive = {
                kind: 'list',
                title: lr.title,
                rowId: lr.singleSelectReply?.selectedRowId,
                sectionId: lr.singleSelectReply?.selectedRowId?.split(':')[0]
            };
            break;
        }
        case 'reactionMessage': {
            const rx = content.reactionMessage || {};
            out.reaction = { text: rx.text, key: rx.key };
            break;
        }
        default: {
            out.raw = content;
        }
    }

    if (!out.text && (out.caption || '').length) out.text = out.caption;

    return out;
}

// Session management
function saveSessions() {
    try {
        ensureDir(path.dirname(sessionsFile));
        const sessionData = Array.from(sessions.entries()).map(([id, session]) => ({
            sessionId: id,
            phoneNumber: session.phoneNumber,
            status: session.status,
            connectedAt: session.connectedAt,
            token: session.token || sessionTokens.get(id)
        }));
        fs.writeFileSync(sessionsFile, JSON.stringify(sessionData, null, 2));
    } catch (e) {
        console.error('Failed to save sessions:', e);
    }
}

function loadSessions() {
    try {
        if (fs.existsSync(sessionsFile)) {
            const data = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
            data.forEach(session => {
                // Only restore if auth files exist
                const authDir = path.join(__dirname, 'sessions', session.sessionId);
                if (fs.existsSync(authDir)) {
                    // Restore token if it exists
                    if (session.token) {
                        sessionTokens.set(session.sessionId, session.token);
                    }
                    startWhatsAppSession(session.sessionId, session.token);
                }
            });
        }
    } catch (e) {
        console.error('Failed to load sessions:', e);
    }
}

function resolveSelfNumber(sock, sessionId) {
    try {
        const jid = sock?.user?.id || sock?.user?.jid || null;
        const fromJid = jidToNumber(jid, sessionId);
        if (fromJid) return fromJid;
    } catch {}
    
    try {
        const dir = path.join(process.cwd(), 'sessions', sessionId);
        const files = fs.readdirSync(dir);
        const entry = files.find(f => /^device-list-(\d+)\.json$/.test(f));
        if (entry) {
            const m = entry.match(/^device-list-(\d+)\.json$/);
            if (m && m[1]) return m[1];
        }
    } catch {}
    
    return null;
}

async function startWhatsAppSession(sessionId, existingToken = null) {
    if (sessions.has(sessionId)) {
        console.log(`Session ${sessionId} already exists`);
        return;
    }

    console.log(`Starting WhatsApp session: ${sessionId}`);
    
    const authDir = path.join(__dirname, 'sessions', sessionId);
    ensureDir(authDir);

    // Generate token for this session or reuse existing one
    const token = existingToken || sessionTokens.get(sessionId) || generateToken();
    sessionTokens.set(sessionId, token);

    const sessionInfo = {
        sessionId,
        phoneNumber: null,
        status: 'connecting',
        connectedAt: null,
        sock: null,
        token: token
    };

    sessions.set(sessionId, sessionInfo);
    saveSessions();

    try {
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: 'silent' }),
        });

        sessionInfo.sock = sock;

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                try {
                    const qrDataURL = await QRCode.toDataURL(qr);
                    io.emit('qr', { sessionId, qr: qrDataURL });
                    console.log(`QR code generated for session ${sessionId}`);
                } catch (err) {
                    console.error('QR generation error:', err);
                }
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log(`Session ${sessionId} closed. Reconnecting:`, shouldReconnect);
                
                sessionInfo.status = 'disconnected';
                saveSessions();
                io.emit('disconnected', { sessionId });
                
                const preservedToken = sessionTokens.get(sessionId) || sessionInfo.token;

                if (shouldReconnect) {
                    // Preserve the existing token on automatic reconnects so clients keep the same auth
                    sessions.delete(sessionId);
                    if (preservedToken) sessionTokens.set(sessionId, preservedToken);
                    setTimeout(() => startWhatsAppSession(sessionId, preservedToken), 5000);
                } else {
                    sessions.delete(sessionId);
                    sessionTokens.delete(sessionId);
                    saveSessions();
                }
            } else if (connection === 'open') {
                const phoneNumber = resolveSelfNumber(sock, sessionId);
                sessionInfo.phoneNumber = phoneNumber;
                sessionInfo.status = 'connected';
                sessionInfo.connectedAt = new Date().toISOString();
                
                console.log(`Session ${sessionId} connected! Phone: ${phoneNumber}`);
                saveSessions();
                io.emit('connected', { sessionId, phoneNumber });
            }
        });



    } catch (err) {
        console.error(`Failed to start session ${sessionId}:`, err);
        sessions.delete(sessionId);
        saveSessions();
    }
}

// API Routes

// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        const clientIP = getClientIP(req);
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Missing username or password' });
        }

        // Check if IP is blocked
        if (isIPBlocked(clientIP)) {
            const remainingTime = getRemainingLockoutTime(clientIP);
            console.warn(`[SECURITY] Login attempt from blocked IP ${clientIP}. Remaining lockout: ${remainingTime}s`);
            return res.status(429).json({ 
                success: false, 
                error: `Too many failed attempts. Please try again in ${remainingTime} seconds.`,
                blockedUntil: remainingTime
            });
        }

        const appUsername = process.env.APP_USERNAME || 'admin';
        const appPassword = process.env.APP_PASSWORD || 'password123';

        if (username === appUsername && password === appPassword) {
            // Reset login attempts on successful login
            resetLoginAttempts(clientIP);
            
            // Generate admin token
            const adminToken = crypto.randomBytes(32).toString('hex');
            adminTokens.add(adminToken);

            console.log(`[SECURITY] Successful login from IP ${clientIP}`);
            res.json({ success: true, token: adminToken });
        } else {
            // Record failed attempt
            const failureResult = recordFailedAttempt(clientIP);
            
            if (failureResult.blocked) {
                console.warn(`[SECURITY] IP ${clientIP} blocked after ${MAX_LOGIN_ATTEMPTS} failed attempts`);
                return res.status(429).json({ 
                    success: false, 
                    error: `Too many failed attempts. Account locked for ${failureResult.remainingTime} seconds.`,
                    blockedUntil: failureResult.remainingTime
                });
            }
            
            console.warn(`[SECURITY] Failed login attempt from IP ${clientIP}. Attempts remaining: ${failureResult.attemptsRemaining}`);
            res.status(401).json({ 
                success: false, 
                error: 'Invalid username or password',
                attemptsRemaining: failureResult.attemptsRemaining
            });
        }
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

// Protected session creation endpoint
app.post('/api/sessions/create', validateAdminToken, async (req, res) => {
    try {
        const sessionId = uuidv4();
        await startWhatsAppSession(sessionId);
        const token = sessionTokens.get(sessionId);
        res.json({ success: true, sessionId, token });
    } catch (err) {
        console.error('Failed to create session:', err);
        res.json({ success: false, error: err.message });
    }
});

app.get('/api/sessions', validateAdminToken, (req, res) => {
    const sessionList = Array.from(sessions.entries()).map(([id, session]) => ({
        sessionId: id,
        phoneNumber: session.phoneNumber,
        status: session.status,
        connectedAt: session.connectedAt,
        token: session.token
    }));
    res.json({ sessions: sessionList });
});

app.post('/api/sessions/:sessionId/refresh-token', validateAdminToken, (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = sessions.get(sessionId);
        
        if (!session) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }
        
        // Generate new token
        const newToken = generateToken();
        sessionTokens.set(sessionId, newToken);
        session.token = newToken;
        
        // Save to persist the new token
        saveSessions();
        
        console.log(`Token refreshed for session: ${sessionId}`);
        res.json({ success: true, token: newToken });
    } catch (err) {
        console.error('Failed to refresh token:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/sessions/:sessionId', validateAdminToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = sessions.get(sessionId);
        
        if (session && session.sock) {
            await session.sock.logout();
        }
        
        sessions.delete(sessionId);
        sessionTokens.delete(sessionId);
        
        // Delete auth files
        const authDir = path.join(__dirname, 'sessions', sessionId);
        if (fs.existsSync(authDir)) {
            fs.rmSync(authDir, { recursive: true, force: true });
        }
        
        saveSessions();
        io.emit('disconnected', { sessionId });
        
        res.json({ success: true });
    } catch (err) {
        console.error('Failed to delete session:', err);
        res.json({ success: false, error: err.message });
    }
});

// Security management endpoints
app.get('/api/security/blocked-ips', validateAdminToken, (req, res) => {
    try {
        const now = Date.now();
        const blockedList = Array.from(blockedIPs.entries()).map(([ip, blockedUntil]) => ({
            ip,
            blockedUntil: new Date(blockedUntil).toISOString(),
            remainingSeconds: Math.ceil((blockedUntil - now) / 1000),
            blockedAt: new Date(blockedUntil - LOGIN_LOCKOUT_DURATION).toISOString()
        }));
        
        res.json({ 
            success: true, 
            blockedIPs: blockedList,
            count: blockedList.length 
        });
    } catch (err) {
        console.error('Failed to fetch blocked IPs:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/security/unblock/:ip', validateAdminToken, (req, res) => {
    try {
        const { ip } = req.params;
        
        if (!blockedIPs.has(ip)) {
            return res.status(404).json({ 
                success: false, 
                error: 'IP not found in blocked list' 
            });
        }
        
        blockedIPs.delete(ip);
        loginAttempts.delete(ip);
        saveBlockedIPs();
        
        console.log(`[SECURITY] Admin manually unblocked IP ${ip}`);
        res.json({ 
            success: true, 
            message: `IP ${ip} has been unblocked` 
        });
    } catch (err) {
        console.error('Failed to unblock IP:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Unified message sending endpoint
app.post('/api/messages/send', validateToken, async (req, res) => {
    try {
        const { to, type = 'text', message, mediaUrl, fileName } = req.body;
        const sessionId = req.sessionId;
        const session = req.session;

        if (!to) {
            return res.status(400).json({ success: false, error: 'Missing "to" field' });
        }

        if (!type || !['text', 'image', 'video', 'document'].includes(type)) {
            return res.status(400).json({ success: false, error: 'Invalid or missing "type" field. Supported: text, image, video, document' });
        }

        if (type === 'text' && !message) {
            return res.status(400).json({ success: false, error: 'Missing "message" field for text type' });
        }

        if (['image', 'video', 'document'].includes(type) && !mediaUrl) {
            return res.status(400).json({ success: false, error: `Missing "mediaUrl" field for ${type} type` });
        }

        // Normalize phone number to WhatsApp format
        const normalizedTo = String(to).replace(/\D/g, '');
        const jid = `${normalizedTo}@s.whatsapp.net`;

        const sock = session.sock;
        if (!sock) {
            return res.status(400).json({ success: false, error: 'Socket not connected' });
        }

        let result;
        const auditLog = {
            timestamp: new Date().toISOString(),
            sessionId,
            to,
            type,
            status: 'sent'
        };

        try {
            if (type === 'text') {
                // Process escape sequences in message properly
                // Handle both JSON-encoded and literal backslash-n sequences
                let processedMessage = String(message);
                // Replace literal \n with actual newline
                processedMessage = processedMessage.replace(/\\n/g, '\n');
                processedMessage = processedMessage.replace(/\\r/g, '\r');
                processedMessage = processedMessage.replace(/\\t/g, '\t');
                // Also handle unicode escape sequences if needed
                processedMessage = processedMessage.replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => {
                    return String.fromCharCode(parseInt(hex, 16));
                });
                
                result = await sock.sendMessage(jid, { text: processedMessage });
                auditLog.messageLength = processedMessage.length;
                console.log(`[${sessionId}] Text message sent to ${to}:`);
                console.log(processedMessage);
            } else if (type === 'image') {
                const imageData = await fetchMediaData(mediaUrl);
                // Process escape sequences in caption
                let processedCaption = message ? String(message).replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t') : '';
                result = await sock.sendMessage(jid, {
                    image: imageData,
                    caption: processedCaption
                });
                auditLog.mediaUrl = mediaUrl;
                auditLog.caption = processedCaption;
                console.log(`[${sessionId}] Image message sent to ${to}`);
            } else if (type === 'video') {
                const videoData = await fetchMediaData(mediaUrl);
                // Process escape sequences in caption
                let processedCaption = message ? String(message).replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t') : '';
                result = await sock.sendMessage(jid, {
                    video: videoData,
                    caption: processedCaption,
                    mimetype: 'video/mp4'
                });
                auditLog.mediaUrl = mediaUrl;
                auditLog.caption = processedCaption;
                console.log(`[${sessionId}] Video message sent to ${to}`);
            } else if (type === 'document') {
                let detectedFileName = fileName;
                if (!detectedFileName) {
                    if (mediaUrl.startsWith('http')) {
                        detectedFileName = mediaUrl.split('/').pop().split('?')[0] || 'document';
                    } else {
                        detectedFileName = path.basename(mediaUrl);
                    }
                }
                const { buffer: documentData, mimeType } = await fetchDocumentData(mediaUrl, detectedFileName);
                // Process escape sequences in caption
                let processedCaption = message ? String(message).replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t') : '';
                result = await sock.sendMessage(jid, {
                    document: documentData,
                    fileName: detectedFileName,
                    caption: processedCaption,
                    mimetype: mimeType
                });
                auditLog.mediaUrl = mediaUrl;
                auditLog.fileName = detectedFileName;
                auditLog.caption = processedCaption;
                console.log(`[${sessionId}] Document message sent to ${to}`);
            }

            auditLog.messageId = result.key?.id;
            storeSentMessage(auditLog);
            res.json({ success: true, messageId: result.key?.id });
        } catch (mediaErr) {
            throw new Error(`Failed to process media: ${mediaErr.message}`);
        }
    } catch (err) {
        console.error('Failed to send message:', err);
        const auditLog = {
            timestamp: new Date().toISOString(),
            sessionId: req.sessionId,
            to: req.body.to,
            type: req.body.type || 'unknown',
            status: 'failed',
            error: String(err?.message || err)
        };
        storeSentMessage(auditLog);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Helper function to fetch media data from URL or local path
async function fetchMediaData(mediaUrl) {
    if (mediaUrl.startsWith('http')) {
        const response = await fetch(mediaUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch media from URL: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } else {
        return fs.readFileSync(mediaUrl);
    }
}

function inferMimeType(fileName) {
    const ext = path.extname(fileName || '').toLowerCase();
    const map = {
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.txt': 'text/plain',
        '.csv': 'text/csv',
        '.zip': 'application/zip'
    };
    return map[ext] || 'application/octet-stream';
}

async function fetchDocumentData(mediaUrl, fileNameHint) {
    if (mediaUrl.startsWith('http')) {
        const response = await fetch(mediaUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch media from URL: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const headerType = response.headers.get('content-type');
        const cleanHeaderType = headerType ? headerType.split(';')[0].trim() : '';
        const inferred = inferMimeType(fileNameHint || mediaUrl);
        const mimeType = cleanHeaderType && cleanHeaderType !== 'application/octet-stream'
            ? cleanHeaderType
            : inferred;
        return { buffer: Buffer.from(arrayBuffer), mimeType };
    }

    const buffer = fs.readFileSync(mediaUrl);
    const mimeType = inferMimeType(fileNameHint || mediaUrl);
    return { buffer, mimeType };
}

// Socket.io connection
io.on('connection', (socket) => {
    console.log('Client connected');
    
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`🚀 WhatsApp Multi-Session Server running on http://localhost:${PORT}`);
    console.log(`📱 Open your browser to manage sessions`);
    loadBlockedIPs();
    loadSessions();
});
