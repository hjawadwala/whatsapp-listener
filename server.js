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

// Helper functions
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
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
app.post('/api/sessions/create', async (req, res) => {
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

app.get('/api/sessions', (req, res) => {
    const sessionList = Array.from(sessions.entries()).map(([id, session]) => ({
        sessionId: id,
        phoneNumber: session.phoneNumber,
        status: session.status,
        connectedAt: session.connectedAt,
        token: session.token
    }));
    res.json({ sessions: sessionList });
});

app.post('/api/sessions/:sessionId/refresh-token', (req, res) => {
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

app.delete('/api/sessions/:sessionId', async (req, res) => {
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

// Message sending endpoints
app.post('/api/messages/text', validateToken, async (req, res) => {
    try {
        const { to, message } = req.body;
        const sessionId = req.sessionId;
        const session = req.session;

        if (!to || !message) {
            return res.status(400).json({ success: false, error: 'Missing "to" or "message" field' });
        }

        // Normalize phone number to WhatsApp format
        const normalizedTo = String(to).replace(/\D/g, '');
        const jid = `${normalizedTo}@s.whatsapp.net`;

        const sock = session.sock;
        if (!sock) {
            return res.status(400).json({ success: false, error: 'Socket not connected' });
        }

        const result = await sock.sendMessage(jid, { text: message });

        const auditLog = {
            timestamp: new Date().toISOString(),
            sessionId,
            messageId: result.key?.id,
            to,
            type: 'text',
            status: 'sent',
            messageLength: message.length
        };

        storeSentMessage(auditLog);
        console.log(`[${sessionId}] Text message sent to ${to}:`, message);

        res.json({ success: true, messageId: result.key?.id });
    } catch (err) {
        console.error('Failed to send text message:', err);
        const auditLog = {
            timestamp: new Date().toISOString(),
            sessionId: req.sessionId,
            to: req.body.to,
            type: 'text',
            status: 'failed',
            error: String(err?.message || err)
        };
        storeSentMessage(auditLog);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/messages/image', validateToken, async (req, res) => {
    try {
        const { to, imageUrl, caption } = req.body;
        const sessionId = req.sessionId;
        const session = req.session;

        if (!to || !imageUrl) {
            return res.status(400).json({ success: false, error: 'Missing "to" or "imageUrl" field' });
        }

        // Normalize phone number to WhatsApp format
        const normalizedTo = String(to).replace(/\D/g, '');
        const jid = `${normalizedTo}@s.whatsapp.net`;

        const sock = session.sock;
        if (!sock) {
            return res.status(400).json({ success: false, error: 'Socket not connected' });
        }

        // Fetch image from URL or local path
        let imageData;
        try {
            if (imageUrl.startsWith('http')) {
                const response = await fetch(imageUrl);
                const arrayBuffer = await response.arrayBuffer();
                imageData = Buffer.from(arrayBuffer);
            } else {
                imageData = fs.readFileSync(imageUrl);
            }
        } catch (err) {
            return res.status(400).json({ success: false, error: `Failed to fetch image: ${err.message}` });
        }

        const result = await sock.sendMessage(jid, {
            image: imageData,
            caption: caption || ''
        });

        const auditLog = {
            timestamp: new Date().toISOString(),
            sessionId,
            messageId: result.key?.id,
            to,
            type: 'image',
            status: 'sent',
            imageUrl,
            caption: caption || ''
        };

        storeSentMessage(auditLog);
        console.log(`[${sessionId}] Image message sent to ${to}`);

        res.json({ success: true, messageId: result.key?.id });
    } catch (err) {
        console.error('Failed to send image message:', err);
        const auditLog = {
            timestamp: new Date().toISOString(),
            sessionId: req.sessionId,
            to: req.body.to,
            type: 'image',
            status: 'failed',
            error: String(err?.message || err)
        };
        storeSentMessage(auditLog);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/messages/video', validateToken, async (req, res) => {
    try {
        const { to, videoUrl, caption } = req.body;
        const sessionId = req.sessionId;
        const session = req.session;

        if (!to || !videoUrl) {
            return res.status(400).json({ success: false, error: 'Missing "to" or "videoUrl" field' });
        }

        // Normalize phone number to WhatsApp format
        const normalizedTo = String(to).replace(/\D/g, '');
        const jid = `${normalizedTo}@s.whatsapp.net`;

        const sock = session.sock;
        if (!sock) {
            return res.status(400).json({ success: false, error: 'Socket not connected' });
        }

        // Fetch video from URL or local path
        let videoData;
        try {
            if (videoUrl.startsWith('http')) {
                const response = await fetch(videoUrl);
                const arrayBuffer = await response.arrayBuffer();
                videoData = Buffer.from(arrayBuffer);
            } else {
                videoData = fs.readFileSync(videoUrl);
            }
        } catch (err) {
            return res.status(400).json({ success: false, error: `Failed to fetch video: ${err.message}` });
        }

        const result = await sock.sendMessage(jid, {
            video: videoData,
            caption: caption || '',
            mimetype: 'video/mp4'
        });

        const auditLog = {
            timestamp: new Date().toISOString(),
            sessionId,
            messageId: result.key?.id,
            to,
            type: 'video',
            status: 'sent',
            videoUrl,
            caption: caption || ''
        };

        storeSentMessage(auditLog);
        console.log(`[${sessionId}] Video message sent to ${to}`);

        res.json({ success: true, messageId: result.key?.id });
    } catch (err) {
        console.error('Failed to send video message:', err);
        const auditLog = {
            timestamp: new Date().toISOString(),
            sessionId: req.sessionId,
            to: req.body.to,
            type: 'video',
            status: 'failed',
            error: String(err?.message || err)
        };
        storeSentMessage(auditLog);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/messages/document', validateToken, async (req, res) => {
    try {
        const { to, documentUrl, fileName, caption } = req.body;
        const sessionId = req.sessionId;
        const session = req.session;

        if (!to || !documentUrl) {
            return res.status(400).json({ success: false, error: 'Missing "to" or "documentUrl" field' });
        }

        // Normalize phone number to WhatsApp format
        const normalizedTo = String(to).replace(/\D/g, '');
        const jid = `${normalizedTo}@s.whatsapp.net`;

        const sock = session.sock;
        if (!sock) {
            return res.status(400).json({ success: false, error: 'Socket not connected' });
        }

        // Fetch document from URL or local path
        let documentData;
        let detectedFileName;
        try {
            if (documentUrl.startsWith('http')) {
                const response = await fetch(documentUrl);
                const arrayBuffer = await response.arrayBuffer();
                documentData = Buffer.from(arrayBuffer);
                // Extract filename from URL if not provided
                detectedFileName = fileName || documentUrl.split('/').pop().split('?')[0] || 'document';
            } else {
                documentData = fs.readFileSync(documentUrl);
                detectedFileName = fileName || path.basename(documentUrl);
            }
        } catch (err) {
            return res.status(400).json({ success: false, error: `Failed to fetch document: ${err.message}` });
        }

        const result = await sock.sendMessage(jid, {
            document: documentData,
            fileName: detectedFileName,
            caption: caption || '',
            mimetype: 'application/octet-stream'
        });

        const auditLog = {
            timestamp: new Date().toISOString(),
            sessionId,
            messageId: result.key?.id,
            to,
            type: 'document',
            status: 'sent',
            documentUrl,
            fileName: detectedFileName,
            caption: caption || ''
        };

        storeSentMessage(auditLog);
        console.log(`[${sessionId}] Document message sent to ${to}`);

        res.json({ success: true, messageId: result.key?.id });
    } catch (err) {
        console.error('Failed to send document message:', err);
        const auditLog = {
            timestamp: new Date().toISOString(),
            sessionId: req.sessionId,
            to: req.body.to,
            type: 'document',
            status: 'failed',
            error: String(err?.message || err)
        };
        storeSentMessage(auditLog);
        res.status(500).json({ success: false, error: err.message });
    }
});

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
    loadSessions();
});
