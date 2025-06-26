# trunecord (Music to Discord) Architecture

## Overview

This document describes the architecture and data flow of the trunecord system, which streams audio from YouTube Music to Discord voice channels.

## System Components

### 1. Chrome Extension
- Captures audio from YouTube Music tabs
- Sends audio data to local client via WebSocket
- Manages streaming state (play/pause)

### 2. Go Client (Local)
- WebSocket server (port 8765) - receives audio from Chrome extension
- Web UI server (port 48766) - user interface
- Discord audio streaming - sends audio to Discord voice channels

### 3. Auth Server (AWS Lambda)
- Handles Discord OAuth2 authentication
- Provides bot token to authenticated clients
- Returns available Discord servers/channels

## Audio Flow Diagram

```mermaid
graph TD
    subgraph "Browser"
        YTM[YouTube Music Tab]
        CE[Chrome Extension]
        OS[Offscreen Document]
    end
    
    subgraph "Local Client (Go)"
        WS[WebSocket Server :8765]
        WEB[Web UI :48766]
        DS[Discord Streamer]
        AB[Audio Buffer]
    end
    
    subgraph "Cloud"
        AUTH[Auth Server<br/>AWS Lambda]
        DISCORD[Discord Voice Server]
    end
    
    %% Audio Flow
    YTM -->|Tab Audio Capture| CE
    CE -->|Stream ID| OS
    OS -->|PCM Audio<br/>Base64| CE
    CE -->|WebSocket<br/>JSON + Base64| WS
    WS -->|Decoded PCM| AB
    AB -->|PCM Chunks| DS
    DS -->|Opus Encoded| DISCORD
    
    %% Control Flow
    WEB -.->|Auth Request| AUTH
    AUTH -.->|Token + Guilds| WEB
    WEB -.->|Bot Token| DS
    DS -.->|Connect| DISCORD
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant WebUI as Web UI (Go Client)
    participant Auth as Auth Server (Lambda)
    participant Discord as Discord OAuth2
    
    User->>WebUI: Click "Authenticate"
    WebUI->>Auth: Redirect to /api/auth
    Auth->>Discord: OAuth2 Authorization
    User->>Discord: Login & Authorize
    Discord->>Auth: Callback with code
    Auth->>Discord: Exchange code for token
    Discord->>Auth: User token
    Auth->>Discord: Get user guilds
    Auth->>WebUI: Redirect with JWT token
    WebUI->>Auth: GET /api/bot-token
    Auth->>WebUI: Bot token (encrypted)
    WebUI->>WebUI: Store in memory only
```

## Streaming State Management

```mermaid
stateDiagram-v2
    [*] --> Disconnected
    
    Disconnected --> Connected: User connects to<br/>Discord channel
    
    Connected --> Streaming: Chrome extension<br/>starts capture
    
    Streaming --> Paused: YouTube Music<br/>pauses (silence detected)
    
    Paused --> Streaming: YouTube Music<br/>resumes (audio detected)
    
    Streaming --> Connected: User stops<br/>extension capture
    
    Connected --> Disconnected: User disconnects<br/>from Discord
    
    Paused --> Connected: 10 second timeout<br/>(no audio data)
```

## Data Format Flow

```mermaid
graph LR
    subgraph "Chrome Extension"
        A[Float32 Audio<br/>48kHz Stereo] 
        B[Int16 PCM<br/>48kHz Mono]
        C[Base64 String]
    end
    
    subgraph "Go Client"
        D[Base64 String]
        E[PCM Bytes]
        F[Opus Frames<br/>20ms @ 128kbps]
    end
    
    A -->|Convert & Mix| B
    B -->|Encode| C
    C -->|WebSocket| D
    D -->|Decode| E
    E -->|Encode<br/>960 samples/frame| F
    F -->|Send| G[Discord]
```

## WebSocket Message Types

```mermaid
graph TD
    subgraph "Chrome → Go Client"
        M1[audio<br/>Audio data + base64]
        M2[streamStart<br/>Capture started]
        M3[streamStop<br/>Capture stopped]
        M4[streamPause<br/>Music paused]
        M5[streamResume<br/>Music resumed]
    end
    
    subgraph "Go Client → Chrome"
        R1[status<br/>Connection status]
    end
    
    M1 --> WS[WebSocket Server]
    M2 --> WS
    M3 --> WS
    M4 --> WS
    M5 --> WS
    WS --> R1
```

## UI Status Display Logic

```mermaid
graph TD
    DC{Discord<br/>Connected?}
    CS{Chrome<br/>Streaming?}
    
    DC -->|No| ShowDisconnected[Show: Disconnected]
    DC -->|Yes| CS
    
    CS -->|No| ShowConnected[Show: Connected]
    CS -->|Yes| ShowStreaming[Show: Streaming]
    
    style ShowDisconnected fill:#f44
    style ShowConnected fill:#4f4
    style ShowStreaming fill:#44f
```

## Buffer Management

```mermaid
graph LR
    subgraph "Buffers"
        WSB[WebSocket Buffer<br/>1000 messages]
        PCM[PCM Buffer<br/>10 frames]
        DSB[Discord Buffer<br/>1000 chunks]
    end
    
    CE[Chrome Extension] -->|2048 samples/chunk| WSB
    WSB --> PCM
    PCM -->|960 samples/20ms| DSB
    DSB --> Discord
    
    style WSB fill:#ffa
    style PCM fill:#afa
    style DSB fill:#aaf
```

## Error Handling

```mermaid
graph TD
    E1[WebSocket Disconnection] -->|Retry| RC[Reconnect Logic]
    E2[Discord Disconnection] -->|Stop Streaming| SS[Stop State]
    E3[Auth Token Expiry] -->|Re-authenticate| RA[Redirect to Auth]
    E4[Audio Buffer Overflow] -->|Drop Frames| DF[Skip Old Data]
    
    RC --> Success1[Resume Streaming]
    SS --> Success2[Show Disconnected]
    RA --> Success3[New Token]
    DF --> Success4[Continue Stream]
```

## Component Responsibilities

### Chrome Extension (extension/)
- **background.js**: WebSocket connection, capture coordination
- **offscreen.js**: Audio processing, PCM conversion
- **content.js**: UI injection (Discord button)
- **popup.js**: Extension control panel

### Go Client (go-client/)
- **websocket/server.go**: Receives audio, tracks streaming state
- **discord/streamer.go**: Opus encoding, Discord voice connection
- **web/server.go**: Web UI, status API
- **auth/client.go**: Token management, API communication

### Auth Server (auth-server/)
- **lambda.js**: OAuth2 flow, JWT generation, bot token delivery
- Protected endpoints require valid JWT
- Bot token never stored client-side

## Key Design Decisions

1. **PCM Audio Format**: Simplified processing, compatible with Discord
2. **Base64 Transport**: WebSocket text frames, easier debugging
3. **Offscreen Document**: Chrome's requirement for audio capture
4. **20ms Frame Size**: Discord's optimal frame duration
5. **Silence Detection**: Accurate streaming state display
6. **Token Security**: Bot token fetched on-demand, stored in memory only
