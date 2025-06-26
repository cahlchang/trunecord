# Music to Discord

Stream YouTube Music (and other services) audio to Discord voice channels.

## Architecture

This project consists of three main components:

1. **Central Authentication Server** - Handles Discord OAuth2 authentication
2. **Local Client Application** - Desktop app that manages audio streaming to Discord
3. **Chrome Extension** - Captures audio from browser tabs

## Components

### 1. Authentication Server (`auth-server/`)

Central server that handles:
- Discord OAuth2 authentication
- Provides list of available servers/channels
- Issues tokens for local clients

### 2. Local Client (`local-client/`)

Electron desktop application that:
- Connects directly to Discord using bot token
- Receives audio from Chrome extension
- Streams audio to selected Discord voice channel
- Provides UI for server/channel selection

### 3. Chrome Extension (`extension/`)

Browser extension that:
- Adds streaming button to YouTube Music
- Captures tab audio
- Sends audio to local client via WebSocket

## Setup Instructions

### Prerequisites

- Node.js 16.11.0 or higher
- Discord account
- Discord server where you have admin permissions

### 1. Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the bot token
5. Go to OAuth2 → URL Generator
6. Select scopes: `bot`, `applications.commands`
7. Select bot permissions: `Connect`, `Speak`, `Use Voice Activity`
8. Use the generated URL to invite the bot to your server

### 2. Auth Server Setup

```bash
cd auth-server
npm install
cp .env.example .env
# Edit .env with your Discord app credentials
npm start
```

### 3. Local Client Setup

```bash
cd local-client
npm install
npm start
```

### 4. Chrome Extension Setup

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension` directory

## Usage

1. Start the auth server and local client
2. Open the local client app and authenticate with Discord
3. Select your Discord server and voice channel
4. Go to YouTube Music in Chrome
5. Click the "Stream to Discord" button in the player controls

## Development

### Auth Server
```bash
cd auth-server
npm run dev  # Start with auto-reload
```

### Local Client
```bash
cd local-client
npm run dev  # Start in development mode
```

### Building Local Client
```bash
cd local-client
npm run build  # Build for current platform
npm run dist   # Create distribution package
```

## Security Notes

- Never commit `.env` files or expose tokens
- The bot token is only used by the local client
- All audio streaming happens locally (no audio goes through central servers)

## Future Enhancements

- Support for additional music services (Spotify, SoundCloud, etc.)
- Multi-platform native clients
- Audio quality settings
- Volume control
- Queue management