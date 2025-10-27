# Trunecord

Stream YouTube Music audio directly to Discord voice channels through a Chrome extension and local client.

## Overview

Trunecord is a system that allows you to stream audio from YouTube Music to Discord voice channels. It consists of:
- A Chrome extension that captures audio from YouTube Music tabs
- A local Go client that streams the audio to Discord
- A Discord bot that plays the audio in voice channels

## Quick Start Guide

### Prerequisites

- Chrome browser
- Discord account with a server where you want to stream music
- Go runtime installed (version 1.19 or higher)

### Step 1: Invite the Discord Bot

First, you need to invite the Trunecord bot to your Discord server:

🤖 **[Click here to invite the Trunecord bot](https://discord.com/oauth2/authorize?client_id=1386587888359313500&permissions=36702208&integration_type=0&scope=bot)**

The bot requires the following permissions:
- **View Channels** - To see available channels
- **Connect** - To join voice channels
- **Speak** - To stream audio in voice channels

### Step 2: Install the Chrome Extension

#### Option A: Chrome Web Store (Recommended)

🎉 **[Install Trunecord from Chrome Web Store](https://chromewebstore.google.com/detail/trunecord/dhmegdkoembgmlhekieedhkilbnjmjee)**

Just click the link above and click "Add to Chrome" - it's that easy!

#### Option B: Manual Installation (For Developers)

1. Download the latest `trunecord-extension.zip` from the releases
2. Extract the ZIP file to a folder on your computer
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable **"Developer mode"** using the toggle in the top right corner
5. Click **"Load unpacked"** and select the extracted extension folder
6. You should see the Trunecord icon appear in your Chrome toolbar

> ℹ️ Ensure the extension reports version **1.3.5** in `chrome://extensions/`. The Go client performs a handshake and will refuse older builds.

### Step 3: Start the Local Client

#### Option A: Download Pre-built Binary (Recommended)

1. Download the latest release for your platform from **[Trunecord Releases](https://github.com/cahlchang/trunecord/releases)**
   - **Windows**: `trunecord-windows-amd64.exe`
   - **macOS (Intel)**: `trunecord-darwin-amd64`
   - **macOS (Apple Silicon)**: `trunecord-darwin-arm64`
   - **Linux**: `trunecord-linux-amd64`

2. Make the binary executable (macOS/Linux only):
   ```bash
   chmod +x trunecord-darwin-amd64  # or your platform's binary
   ```

3. Run the client:
   ```bash
   # macOS/Linux
   ./trunecord-darwin-amd64  # or your platform's binary
   
   # Windows
   trunecord-windows-amd64.exe
   ```

> ℹ️ Use the latest release (v1.3.5 or newer) so that the extension and client stay in sync.

#### Option B: Build from Source (For Developers)

```bash
# Clone the repository
git clone https://github.com/cahlchang/trunecord.git
cd trunecord/go-client

# Run the Go client
go run main.go
```

The client will start and display:
```
Trunecord client starting...
Listening on :8080
```

### Step 4: Configure the Extension

1. Click the Trunecord extension icon in your Chrome toolbar
2. Select your Discord server from the dropdown
3. Choose the voice channel where you want to stream music
4. Click **"Connect"** to establish the connection

### Step 5: Start Streaming!

1. Open your favourite supported service (YouTube Music, Spotify, Apple Music, or Amazon Music) in Chrome
2. Start playback of any song or playlist
3. Look for the **Discord streaming button** near the playback controls (it appears inline with the player UI)
4. Click the button to start streaming — it will turn red while streaming is active
5. The bot joins the configured voice channel and mirrors the audio in real time

## Supported Music Services

- YouTube Music (music.youtube.com)
- Spotify Web Player (open.spotify.com)
- Apple Music on the Web (music.apple.com)
- Amazon Music (music.amazon.co.jp / .com)

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  YouTube Music  │────▶│ Chrome Extension│────▶│   Local Client  │
│   (Browser)     │     │ (Audio Capture) │     │   (Go Binary)   │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │  Discord Bot    │
                                                 │ (Voice Channel) │
                                                 └─────────────────┘
```

1. **Audio Capture**: The Chrome extension uses the `tabCapture` API to capture audio from YouTube Music
2. **Local Processing**: Audio is sent to the local Go client via WebSocket (no external servers)
3. **Discord Streaming**: The Go client uses the Discord API to stream audio through the bot
4. **Voice Output**: The bot plays the audio in your selected Discord voice channel

## Features

- 🎵 Stream high-quality audio from YouTube Music, Spotify, Apple Music, and Amazon Music straight to Discord
- 🔴 Visual streaming indicator embedded in each supported player UI
- 🔄 Automatic reconnection handling
- 🔒 All audio processing happens locally (privacy-focused)
- ⚡ Low-latency streaming
- 🌍 Multi-language extension UI (English, 日本語, 한국어, 简体中文)
- 🎮 Simple one-click interface with automatic session resume after browser restarts

## Version Compatibility

- Chrome extension: **v1.3.5**
- Local Go client: **v1.3.5** or newer

Launching mismatched versions triggers a “version mismatch” warning in the popup and refuses to stream until both components are upgraded.

## Architecture

### Components

1. **Chrome Extension** (`extension/`)
   - Injects streaming button into YouTube Music
   - Captures tab audio using Chrome APIs
   - Sends audio data to local client

2. **Go Client** (`go-client/`)
   - Receives audio from Chrome extension
   - Handles Discord bot connection
   - Streams audio to voice channels

3. **Discord Bot**
   - Pre-configured bot (no setup required)
   - Joins voice channels on command
   - Plays audio stream

## Troubleshooting

### Bot doesn't join the voice channel
- Ensure the bot has been invited to your server with proper permissions
- Check that you've selected a voice channel in the extension popup
- Make sure you're in the voice channel yourself

### No audio is playing
- Verify the local Go client is running (check the terminal)
- Ensure YouTube Music is actually playing audio
- Check the streaming button is in the "active" (red) state
- Look for any error messages in the extension popup

### Extension doesn't appear
- Make sure Developer mode is enabled in Chrome
- Try reloading the extension from `chrome://extensions/`
- Check for errors on the extension card

### Connection errors
- Ensure the Go client is running on port 8080
- Check your firewall isn't blocking local connections
- Try restarting both the extension and the Go client

## Privacy & Security

- 🔒 **Local Processing**: All audio is processed on your machine
- 🚫 **No External Servers**: Audio never leaves your computer except to Discord
- 🔐 **Secure WebSocket**: All connections use secure protocols
- 👤 **User Control**: Bot only joins channels you explicitly select

## Development

### Building from Source

#### Chrome Extension
```bash
cd extension
npm install
npm test
```

#### Go Client
```bash
cd go-client
go build -o trunecord
./trunecord
```

### Creating Extension Package
When preparing a package for submission to the Chrome Web Store (or any other distribution channel), make sure the archive still contains `manifest.json`. Create the zip while excluding only `node_modules/` and test artifacts as shown below so the manifest remains in the root.

```bash
cd extension
zip -r ../trunecord-extension.zip . -x "node_modules/*" -x "test/*" -x "coverage/*"
```

Before uploading, verify that `manifest.json` is present at the root of the resulting `trunecord-extension.zip`.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues, feature requests, or questions:
- Open an issue on GitHub
- Join our Discord server (link coming soon)

---

*Enjoy streaming your favorite music to Discord with Trunecord!* 🎵
