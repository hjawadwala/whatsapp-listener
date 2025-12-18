const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, getContentType } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode'); // Add this
const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function storeMessage(record) {
    try {
        const dir = path.join(process.cwd(), 'data');
        ensureDir(dir);
        const file = path.join(dir, 'messages.log');
        fs.appendFileSync(file, JSON.stringify(record) + '\n', 'utf8');
    } catch (e) {
        console.error('Failed to store message:', e);
    }
}

function unwrapContent(message) {
    let content = message?.message || {};
    // unwrap common containers
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
            // Fallbacks for uncommon wrappers
            out.raw = content;
        }
    }

    // Also surface caption/text when available
    if (!out.text && (out.caption || '').length) out.text = out.caption;

    return out;
}

async function startSocket() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        // Remove printQRInTerminal entirely
    });

    sock.ev.on('creds.update', saveCreds);

    // Handle connection updates + QR
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // Print QR in terminal as ASCII art
            console.log('Scan this QR code with your WhatsApp app:');
            console.log(await QRCode.toString(qr, { type: 'terminal', small: true }));
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed:', lastDisconnect?.error, 'Reconnecting:', shouldReconnect);
            if (shouldReconnect) startSocket();
        } else if (connection === 'open') {
            console.log('WhatsApp connected!');
        }
    });

    // Listen for incoming messages (now handling all major types)
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.key.fromMe && m.type === 'notify') {
            const details = extractMessageDetails(msg);
            const sender = details.from;

            console.log(`New ${details.type} from ${sender}: ${details.text || details.caption || '[no text]'}`);

            // Store message locally instead of sending to API
            storeMessage(details);

            // API call commented as requested
            // try {
            //     const response = await fetch('https://your-api-endpoint.com/leads', {
            //         method: 'POST',
            //         headers: { 'Content-Type': 'application/json' },
            //         body: JSON.stringify(details)
            //     });
            //     if (!response.ok) throw new Error('API error');
            //     console.log('API triggered successfully');
            // } catch (err) {
            //     console.error('API trigger failed:', err);
            // }
        }
    });
}

startSocket();
