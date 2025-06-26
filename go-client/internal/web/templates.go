package web

const indexTemplate = `<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{.Title}}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        :root {
            --bs-body-bg: #0d1117;
            --bs-body-color: #c9d1d9;
            --discord-blurple: #5865f2;
            --discord-green: #57f287;
            --discord-red: #ed4245;
        }
        
        body {
            background-color: var(--bs-body-bg);
            color: var(--bs-body-color);
            min-height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .hero-section {
            background: linear-gradient(135deg, #1a1f2e 0%, #0d1117 100%);
            padding: 3rem 0;
            margin-bottom: 3rem;
            position: relative;
            overflow: hidden;
        }
        
        .hero-section::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%235865f2' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
            opacity: 0.5;
        }
        
        .hero-section .container {
            position: relative;
            z-index: 1;
        }
        
        .brand-title {
            font-size: 3rem;
            font-weight: 700;
            background: linear-gradient(135deg, var(--discord-blurple) 0%, #7983ff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .card {
            background-color: #161b22;
            border: 1px solid #30363d;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }
        
        .btn-discord {
            background-color: var(--discord-blurple);
            color: white;
            border: none;
            padding: 12px 24px;
            font-weight: 600;
            transition: all 0.3s ease;
        }
        
        .btn-discord:hover {
            background-color: #4752c4;
            color: white;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(88, 101, 242, 0.4);
        }
        
        .btn-success {
            background-color: var(--discord-green);
            border: none;
            color: #000;
            font-weight: 600;
        }
        
        .btn-success:hover {
            background-color: #3ba55c;
            color: #000;
        }
        
        .btn-danger {
            background-color: var(--discord-red);
            border: none;
            font-weight: 600;
        }
        
        .btn-danger:hover {
            background-color: #c23616;
        }
        
        .form-select, .form-control {
            background-color: #0d1117;
            border: 1px solid #30363d;
            color: var(--bs-body-color);
        }
        
        .form-select:focus, .form-control:focus {
            background-color: #0d1117;
            border-color: var(--discord-blurple);
            color: var(--bs-body-color);
            box-shadow: 0 0 0 0.25rem rgba(88, 101, 242, 0.25);
        }
        
        .status-indicator {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.375rem 0.75rem;
            border-radius: 999px;
            font-size: 0.875rem;
            font-weight: 600;
        }
        
        .status-indicator.connected {
            background-color: rgba(87, 242, 135, 0.2);
            color: var(--discord-green);
        }
        
        .status-indicator.disconnected {
            background-color: rgba(237, 66, 69, 0.2);
            color: var(--discord-red);
        }
        
        .alert-error {
            background-color: rgba(237, 66, 69, 0.2);
            border: 1px solid var(--discord-red);
            color: var(--discord-red);
        }
        
        .instructions-box {
            background-color: rgba(88, 101, 242, 0.1);
            border: 1px solid rgba(88, 101, 242, 0.3);
            border-radius: 8px;
            padding: 1.5rem;
        }
        
        .spinner-border {
            width: 1rem;
            height: 1rem;
            border-width: 0.15em;
        }
    </style>
</head>
<body>
    <div class="hero-section">
        <div class="container text-center">
            <h1 class="brand-title mb-3">
                <i class="fas fa-music me-3"></i>trunecord
            </h1>
            <p class="lead text-secondary">(Music to Discord) - Stream trunecord voice channels</p>
        </div>
    </div>

    <div class="container">
        {{if .Error}}
            <div class="alert alert-error alert-dismissible fade show mb-4" role="alert">
                <i class="fas fa-exclamation-circle me-2"></i>{{.Error}}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        {{end}}
        
        {{if not .Token}}
            <div class="row justify-content-center">
                <div class="col-md-6">
                    <div class="card text-center">
                        <div class="card-body py-5">
                            <i class="fab fa-discord fa-4x mb-4" style="color: var(--discord-blurple);"></i>
                            <h2 class="card-title mb-3">Authenticate with Discord</h2>
                            <p class="card-text text-secondary mb-4">
                                To start streaming, you need to authenticate with Discord first.
                            </p>
                            <a href="/auth" class="btn btn-discord btn-lg">
                                <i class="fab fa-discord me-2"></i>Authenticate with Discord
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        {{else}}
            <div class="row justify-content-center">
                <div class="col-md-8">
                    <div class="card mb-4">
                        <div class="card-header bg-transparent border-bottom">
                            <h3 class="mb-0">
                                <i class="fas fa-headphones-alt me-2"></i>Discord Voice Connection
                            </h3>
                        </div>
                        <div class="card-body">
                            <div class="row mb-4">
                                <div class="col-6 text-center">
                                    <small class="text-secondary d-block mb-1">Connection</small>
                                    <span id="connection-status" class="status-indicator disconnected">
                                        <i class="fas fa-circle fa-xs"></i>Disconnected
                                    </span>
                                </div>
                                <div class="col-6 text-center">
                                    <small class="text-secondary d-block mb-1">Streaming</small>
                                    <span id="streaming-status" class="status-indicator disconnected">
                                        <i class="fas fa-circle fa-xs"></i>Stopped
                                    </span>
                                </div>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">Select Server</label>
                                <select id="guild-select" class="form-select form-select-lg">
                                    <option value="">Choose a server...</option>
                                    {{range .Guilds}}<option value="{{.ID}}">{{.Name}}</option>{{end}}
                                </select>
                            </div>
                            
                            <div class="mb-4">
                                <label class="form-label">Select Voice Channel</label>
                                <select id="channel-select" class="form-select form-select-lg" disabled>
                                    <option value="">Choose a voice channel...</option>
                                </select>
                            </div>
                            
                            <div class="d-flex gap-3 justify-content-center">
                                <button id="connect-btn" class="btn btn-success btn-lg" disabled>
                                    <i class="fas fa-plug me-2"></i>Connect
                                </button>
                                <button id="disconnect-btn" class="btn btn-danger btn-lg" disabled>
                                    <i class="fas fa-plug-circle-xmark me-2"></i>Disconnect
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="instructions-box">
                        <h5 class="mb-3">
                            <i class="fas fa-info-circle me-2"></i>Instructions
                        </h5>
                        <ol class="mb-0">
                            <li>Select a Discord server from the dropdown</li>
                            <li>Choose a voice channel where you want to stream</li>
                            <li>Click "Connect" to join the voice channel</li>
                            <li>Go to YouTube Music and click the Discord button to start streaming</li>
                        </ol>
                    </div>
                </div>
            </div>
        {{end}}
    </div>
    
    <script>
        // Basic JavaScript for the form
        document.addEventListener('DOMContentLoaded', function() {
            const guildSelect = document.getElementById('guild-select');
            const channelSelect = document.getElementById('channel-select');
            const connectBtn = document.getElementById('connect-btn');
            const disconnectBtn = document.getElementById('disconnect-btn');
            const connectionStatus = document.getElementById('connection-status');
            const streamingStatus = document.getElementById('streaming-status');
            
            if (guildSelect) {
                guildSelect.addEventListener('change', async function() {
                    const guildId = this.value;
                    channelSelect.innerHTML = '<option value="">Loading channels...</option>';
                    channelSelect.disabled = true;
                    connectBtn.disabled = true;
                    
                    if (guildId) {
                        try {
                            const response = await fetch('/api/channels/' + guildId);
                            const data = await response.json();
                            
                            channelSelect.innerHTML = '<option value="">Choose a voice channel...</option>';
                            
                            if (data.channels && data.channels.length > 0) {
                                data.channels.forEach(channel => {
                                    const option = document.createElement('option');
                                    option.value = channel.id;
                                    option.textContent = channel.name;
                                    channelSelect.appendChild(option);
                                });
                                channelSelect.disabled = false;
                            } else {
                                channelSelect.innerHTML = '<option value="">No voice channels found</option>';
                            }
                        } catch (error) {
                            console.error('Error loading channels:', error);
                            channelSelect.innerHTML = '<option value="">Error loading channels</option>';
                        }
                    }
                });
            }
            
            if (channelSelect) {
                channelSelect.addEventListener('change', function() {
                    connectBtn.disabled = !this.value;
                });
            }
            
            if (connectBtn) {
                connectBtn.addEventListener('click', async function() {
                    const guildId = guildSelect.value;
                    const channelId = channelSelect.value;
                    
                    if (!guildId || !channelId) return;
                    
                    connectBtn.disabled = true;
                    connectBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Connecting...';
                    
                    try {
                        const response = await fetch('/api/connect', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ guildId, channelId })
                        });
                        
                        const data = await response.json();
                        if (data.success) {
                            updateConnectionStatus(true);
                            connectBtn.disabled = true;
                            disconnectBtn.disabled = false;
                            guildSelect.disabled = true;
                            channelSelect.disabled = true;
                        } else {
                            throw new Error(data.message || 'Connection failed');
                        }
                    } catch (error) {
                        alert('Connection error: ' + error.message);
                        connectBtn.disabled = false;
                    } finally {
                        connectBtn.innerHTML = '<i class="fas fa-plug me-2"></i>Connect';
                    }
                });
            }
            
            if (disconnectBtn) {
                disconnectBtn.addEventListener('click', async function() {
                    disconnectBtn.disabled = true;
                    disconnectBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Disconnecting...';
                    
                    try {
                        const response = await fetch('/api/disconnect', { method: 'POST' });
                        const data = await response.json();
                        if (data.success) {
                            updateConnectionStatus(false);
                            connectBtn.disabled = false;
                            disconnectBtn.disabled = true;
                            guildSelect.disabled = false;
                            channelSelect.disabled = false;
                        }
                    } catch (error) {
                        alert('Disconnection error: ' + error.message);
                        disconnectBtn.disabled = false;
                    } finally {
                        disconnectBtn.innerHTML = '<i class="fas fa-plug-circle-xmark me-2"></i>Disconnect';
                    }
                });
            }
            
            function updateConnectionStatus(connected) {
                if (connectionStatus) {
                    if (connected) {
                        connectionStatus.className = 'status-indicator connected';
                        connectionStatus.innerHTML = '<i class="fas fa-circle fa-xs"></i>Connected';
                    } else {
                        connectionStatus.className = 'status-indicator disconnected';
                        connectionStatus.innerHTML = '<i class="fas fa-circle fa-xs"></i>Disconnected';
                    }
                }
            }
            
            function updateStreamingStatus(streaming) {
                if (streamingStatus) {
                    if (streaming) {
                        streamingStatus.className = 'status-indicator connected';
                        streamingStatus.innerHTML = '<i class="fas fa-circle fa-xs"></i>Streaming';
                    } else {
                        streamingStatus.className = 'status-indicator disconnected';
                        streamingStatus.innerHTML = '<i class="fas fa-circle fa-xs"></i>Stopped';
                    }
                }
            }
            
            // Poll status
            async function checkStatus() {
                try {
                    const response = await fetch('/api/status');
                    const status = await response.json();
                    updateConnectionStatus(status.connected);
                    updateStreamingStatus(status.streaming);
                    
                    if (status.connected) {
                        connectBtn.disabled = true;
                        disconnectBtn.disabled = false;
                        guildSelect.disabled = true;
                        channelSelect.disabled = true;
                    } else {
                        disconnectBtn.disabled = true;
                        guildSelect.disabled = false;
                    }
                } catch (error) {
                    console.error('Status check error:', error);
                }
            }
            
            // Check status on load and every 2 seconds
            checkStatus();
            setInterval(checkStatus, 2000);
        });
    </script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>`

const successTemplate = `<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
    <meta charset="UTF-8">
    <title>{{.Title}}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        body { 
            background-color: #0d1117; 
            color: #c9d1d9; 
            min-height: 100vh; 
            display: flex; 
            align-items: center; 
            justify-content: center;
        }
        .success-card {
            background-color: #161b22;
            border: 1px solid #30363d;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
            max-width: 500px;
        }
        .success-icon {
            color: #57f287;
            font-size: 4rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-card text-center p-5">
            <i class="fas fa-check-circle success-icon mb-4"></i>
            <h1 class="mb-3">{{.Success}}</h1>
            <p class="text-secondary mb-4">Found {{len .Guilds}} server(s) where you can stream.</p>
            <p class="text-secondary">Redirecting to main page...</p>
            <div class="spinner-border text-primary mt-3" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    </div>
    <script>
        setTimeout(() => window.location.href = '/', 2000);
    </script>
</body>
</html>`
