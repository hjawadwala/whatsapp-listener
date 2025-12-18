# whatsapp-listener-

Simple WhatsApp listener built on Baileys. It connects via QR and stores every incoming message in a local JSONL log for later processing.

## Features
- Handles major message types: text, images, videos, audio, documents, stickers, contacts, locations, buttons, templates, lists, reactions
- Saves each message as a JSON object (one per line) to `data/messages.log`
- Prints the QR in the terminal for login

## Usage

1. Install dependencies:

```bash
npm install
```

2. Start the listener and scan the QR from your WhatsApp app:

```bash
node index.js
```

3. Messages will be stored at:

- `data/messages.log` (JSON Lines format)

Each line is a self-contained JSON object with normalized fields like `type`, `text`, `caption`, `media`, `location`, `contact`, etc.

## Notes
- The previous API POST call has been commented out. A `storeMessage(details)` function is used instead to persist messages locally.
- You can replace the internals of `storeMessage()` in `index.js` to push to a database or an external service.
