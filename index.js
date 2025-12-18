const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode'); // Add this

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

    // Listen for incoming messages (unchanged)
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.key.fromMe && m.type === 'notify') {
            const sender = msg.key.remoteJid;
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || 'Media/No text';

            console.log(`New message from ${sender}: ${text}`);

            // Trigger your API
            try {
                const response = await fetch('https://your-api-endpoint.com/leads', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phone: sender.replace('@s.whatsapp.net', ''),
                        message: text,
                        timestamp: msg.messageTimestamp,
                    })
                });
                if (!response.ok) throw new Error('API error');
                console.log('API triggered successfully');
            } catch (err) {
                console.error('API trigger failed:', err);
            }
        }
    });
}

startSocket();
