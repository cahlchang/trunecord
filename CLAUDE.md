# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome extension project that streams YouTube Music audio to Discord. The extension:
- Adds play/stop buttons next to the YouTube Music footer player
- Captures Chrome's audio output
- Streams audio through a Discord bot
- Acts as a proxy so audio plays from Discord, not the user's device

## Project Status

This is currently in the initial planning stage. The following components need to be implemented:

### Chrome Extension
- Manifest file (manifest.json)
- Content script to inject buttons into YouTube Music
- Background script/service worker to handle audio capture
- Communication with Discord bot

### Discord Bot
- Centrally managed bot (no user creation required)
- Single bot instance serving all users
- Handles WebRTC or audio streaming from extensions
- OAuth2 authentication for Discord server access
- User selects Discord server through OAuth flow

## Architecture Overview

### Components
1. **Central Authentication Server**
   - Handles Discord OAuth2 authentication only
   - Provides available servers/channels information
   - Central Discord bot is pre-invited to servers
   - No audio streaming through central server

2. **Local Client Application**
   - Desktop application (Electron/Native)
   - Handles all audio streaming to Discord
   - Direct Discord API connection using bot token
   - Supports multiple audio sources (YouTube Music, Spotify, etc.)
   - User-friendly UI for server/channel selection

3. **Chrome Extension**
   - Captures tab audio from streaming services
   - Communicates with local client via WebSocket
   - Minimal footprint - only audio capture

4. **Communication Flow**
   - User authenticates via central server (OAuth2)
   - Gets token and available servers list
   - Local client uses token to stream audio directly to Discord
   - No audio data passes through central infrastructure

## Development Guidelines

### Chrome Extension Structure
When implementing the Chrome extension:
- Use Manifest V3 (latest Chrome extension standard)
- Implement proper permissions for audio capture and tab access
- Use Chrome's tabCapture API or similar for audio streaming
- Follow Chrome Web Store policies for media extensions

### Audio Streaming Architecture
- Consider using WebRTC for real-time audio streaming
- Implement proper buffering and latency management
- Handle connection failures gracefully

### Security Considerations
- Secure communication between extension and Discord bot
- User authentication/authorization
- Rate limiting to prevent abuse

## Development Commands

### Discord Bot
```bash
cd discord-bot
npm install          # Install dependencies
npm start           # Start bot
npm run dev         # Start bot with auto-reload
```

### Chrome Extension
1. Open `chrome://extensions/` in Chrome
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension` directory

### Testing
- Load extension in Chrome
- Navigate to YouTube Music
- Check for Discord button in player controls
- Test WebSocket connection to bot

## Project Structure

```
trunecord/
├── extension/              # Chrome extension
│   ├── manifest.json      # Extension manifest (Manifest V3)
│   ├── src/
│   │   ├── background.js  # Service worker for audio capture
│   │   ├── content.js     # Content script for UI injection
│   │   ├── popup.html/js  # Extension popup settings
│   │   └── content.css    # Styling for injected elements
│   └── assets/
│       └── icons/         # Extension icons
├── discord-bot/           # Discord bot server
│   ├── index.js          # Main bot + WebRTC server
│   └── package.json      # Node dependencies
└── create_icons.py       # Icon generation script
```