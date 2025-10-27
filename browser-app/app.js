// Global state
let connected = false;
let streaming = false;
let authenticated = false;
let ws = null;
let userToken = null;
let guilds = [];

// DOM elements
let guildSelect, channelSelect, connectBtn, disconnectBtn;
let connectionStatus, streamingStatus, extensionStatus;
let authSection, controlSection, authBtn;

// API configuration
const API_BASE_URL = 'https://m0j3mh0nyj.execute-api.ap-northeast-1.amazonaws.com/prod';
const WS_PORT = 8765;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    console.log('[Init] Starting application...');
    
    initializeElements();
    setupEventListeners();
    
    // Check if we have a token from OAuth callback
    checkAuthCallback();
    
    // Check authentication status
    checkAuthentication();
    
    // Connect to WebSocket server
    connectWebSocket();
    
    // Update status periodically
    setInterval(updateStatus, 2000);
});

function initializeElements() {
    guildSelect = document.getElementById('guild-select');
    channelSelect = document.getElementById('channel-select');
    connectBtn = document.getElementById('connect-btn');
    disconnectBtn = document.getElementById('disconnect-btn');
    connectionStatus = document.getElementById('connection-status');
    streamingStatus = document.getElementById('streaming-status');
    extensionStatus = document.getElementById('extension-status');
    authSection = document.getElementById('auth-section');
    controlSection = document.getElementById('control-section');
    authBtn = document.getElementById('auth-btn');
}

function setupEventListeners() {
    if (guildSelect) {
        guildSelect.addEventListener('change', onGuildChange);
    }
    
    if (channelSelect) {
        channelSelect.addEventListener('change', onChannelChange);
    }
    
    if (authBtn) {
        authBtn.addEventListener('click', authenticate);
    }
    
    if (connectBtn) {
        connectBtn.addEventListener('click', connect);
    }
    
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', disconnect);
    }
}

// Check for OAuth callback parameters
function checkAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const guildsParam = params.get('guilds');
    
    if (token) {
        console.log('[Auth] Token found in URL parameters');
        userToken = token;
        
        if (guildsParam) {
            try {
                guilds = JSON.parse(guildsParam);
                console.log('[Auth] Guilds parsed:', guilds.length);
            } catch (e) {
                console.error('[Auth] Failed to parse guilds:', e);
                guilds = [];
            }
        }
        
        // Store in localStorage for persistence
        localStorage.setItem('trunecord_token', token);
        if (guilds.length > 0) {
            localStorage.setItem('trunecord_guilds', JSON.stringify(guilds));
        }
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        authenticated = true;
        showControlSection();
        loadGuilds();
        showNotification('Authentication successful!', 'success');
    }
}

// Check authentication status
function checkAuthentication() {
    // Check localStorage for existing token
    const storedToken = localStorage.getItem('trunecord_token');
    const storedGuilds = localStorage.getItem('trunecord_guilds');
    
    if (storedToken) {
        userToken = storedToken;
        authenticated = true;
        
        if (storedGuilds) {
            try {
                guilds = JSON.parse(storedGuilds);
            } catch (e) {
                guilds = [];
            }
        }
        
        console.log('[Auth] Authenticated with stored token');
        showControlSection();
        loadGuilds();
    } else {
        console.log('[Auth] Not authenticated');
        showAuthSection();
    }
}

// Handle authentication
async function authenticate() {
    console.log('[Auth] Starting authentication...');
    
    // Redirect to Lambda auth endpoint with http redirect
    const authURL = `${API_BASE_URL}/api/auth?redirect_protocol=http`;
    window.location.href = authURL;
}

// Logout function
function logout() {
    localStorage.removeItem('trunecord_token');
    localStorage.removeItem('trunecord_guilds');
    userToken = null;
    authenticated = false;
    guilds = [];
    showAuthSection();
    showNotification('Logged out successfully', 'info');
}

// Show authentication section
function showAuthSection() {
    if (authSection) authSection.classList.remove('hidden');
    if (controlSection) controlSection.classList.add('hidden');
}

// Show control section
function showControlSection() {
    if (authSection) authSection.classList.add('hidden');
    if (controlSection) controlSection.classList.remove('hidden');
}

// Load guilds
async function loadGuilds() {
    try {
        if (guilds && guilds.length > 0) {
            // Use stored guilds
            guildSelect.innerHTML = '<option value="">Choose a server...</option>';
            guilds.forEach(guild => {
                const option = document.createElement('option');
                option.value = guild.id;
                option.textContent = guild.name;
                guildSelect.appendChild(option);
            });
            guildSelect.disabled = false;
        } else {
            // Fetch from API if needed
            const response = await fetch(`${API_BASE_URL}/api/guilds`, {
                headers: {
                    'Authorization': `Bearer ${userToken}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                guilds = data.guilds || [];
                
                guildSelect.innerHTML = '<option value="">Choose a server...</option>';
                guilds.forEach(guild => {
                    const option = document.createElement('option');
                    option.value = guild.id;
                    option.textContent = guild.name;
                    guildSelect.appendChild(option);
                });
                guildSelect.disabled = false;
                
                // Store for future use
                localStorage.setItem('trunecord_guilds', JSON.stringify(guilds));
            } else {
                throw new Error('Failed to fetch guilds');
            }
        }
    } catch (error) {
        console.error('[LoadGuilds] Error:', error);
        guildSelect.innerHTML = '<option value="">Error loading servers</option>';
        showNotification('Failed to load Discord servers', 'error');
    }
}

// Handle guild selection change
async function onGuildChange() {
    const guildId = guildSelect.value;
    
    // Reset channel select
    channelSelect.innerHTML = '<option value="">Choose a voice channel...</option>';
    channelSelect.disabled = true;
    connectBtn.disabled = true;
    
    if (!guildId) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/channels/${guildId}`, {
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const channels = data.channels || [];
            
            if (channels.length > 0) {
                // Sort by position
                channels.sort((a, b) => a.position - b.position);
                
                // Populate channel select
                channels.forEach(channel => {
                    const option = document.createElement('option');
                    option.value = channel.id;
                    option.textContent = channel.name;
                    channelSelect.appendChild(option);
                });
                
                channelSelect.disabled = false;
            } else {
                channelSelect.innerHTML = '<option value="">No voice channels available</option>';
            }
        } else {
            throw new Error('Failed to fetch channels');
        }
    } catch (error) {
        console.error('[GetChannels] Error:', error);
        channelSelect.innerHTML = '<option value="">Error loading channels</option>';
        showNotification('Failed to load channels', 'error');
    }
}

// Handle channel selection change
function onChannelChange() {
    const channelId = channelSelect.value;
    connectBtn.disabled = !channelId || connected;
}

// Connect to Discord voice channel
async function connect() {
    const guildId = guildSelect.value;
    const channelId = channelSelect.value;
    
    if (!guildId || !channelId) {
        showNotification('Please select a server and voice channel', 'error');
        return;
    }
    
    try {
        connectBtn.disabled = true;
        connectBtn.textContent = 'Connecting...';
        
        const response = await fetch(`${API_BASE_URL}/api/connect`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify({
                guildId: guildId,
                channelId: channelId
            })
        });
        
        if (response.ok) {
            connected = true;
            updateUI();
            showNotification('Connected to Discord voice channel!', 'success');
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Connection failed');
        }
    } catch (error) {
        console.error('[Connect] Error:', error);
        showNotification('Failed to connect: ' + error.message, 'error');
    } finally {
        connectBtn.textContent = 'Connect to Voice Channel';
        updateUI();
    }
}

// Disconnect from Discord
async function disconnect() {
    try {
        disconnectBtn.disabled = true;
        disconnectBtn.textContent = 'Disconnecting...';
        
        const response = await fetch(`${API_BASE_URL}/api/disconnect`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        });
        
        if (response.ok) {
            connected = false;
            streaming = false;
            updateUI();
            showNotification('Disconnected from Discord', 'success');
        } else {
            throw new Error('Disconnection failed');
        }
    } catch (error) {
        console.error('[Disconnect] Error:', error);
        showNotification('Failed to disconnect: ' + error.message, 'error');
    } finally {
        disconnectBtn.textContent = 'Disconnect';
        updateUI();
    }
}

// Connect to WebSocket server
function connectWebSocket() {
    try {
        ws = new WebSocket(`ws://localhost:${WS_PORT}`);
        
        ws.onopen = () => {
            console.log('[WebSocket] Connected to local server');
            if (extensionStatus) {
                extensionStatus.textContent = 'Connected';
                extensionStatus.classList.add('connected');
                extensionStatus.classList.remove('disconnected');
            }
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            } catch (e) {
                console.error('[WebSocket] Failed to parse message:', e);
            }
        };
        
        ws.onerror = (error) => {
            console.error('[WebSocket] Error:', error);
        };
        
        ws.onclose = () => {
            console.log('[WebSocket] Disconnected');
            if (extensionStatus) {
                extensionStatus.textContent = 'Not Connected';
                extensionStatus.classList.add('disconnected');
                extensionStatus.classList.remove('connected');
            }
            
            // Reconnect after 3 seconds
            setTimeout(connectWebSocket, 3000);
        };
    } catch (error) {
        console.error('[WebSocket] Failed to connect:', error);
        setTimeout(connectWebSocket, 3000);
    }
}

// Handle WebSocket messages
function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'status':
            if (data.streaming !== undefined) {
                streaming = data.streaming;
                updateUI();
            }
            break;
        case 'streamStart':
            streaming = true;
            updateUI();
            break;
        case 'streamStop':
            streaming = false;
            updateUI();
            break;
    }
}

// Update status
async function updateStatus() {
    // Send status request to WebSocket if connected
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'status' }));
    }
    
    updateUI();
}

// Update UI
function updateUI() {
    if (connectionStatus) {
        connectionStatus.textContent = connected ? 'Connected' : 'Disconnected';
        connectionStatus.classList.toggle('connected', connected);
        connectionStatus.classList.toggle('disconnected', !connected);
    }
    
    if (streamingStatus) {
        streamingStatus.textContent = streaming ? 'Streaming' : 'Stopped';
        streamingStatus.classList.toggle('connected', streaming);
        streamingStatus.classList.toggle('disconnected', !streaming);
    }
    
    if (connectBtn) {
        connectBtn.disabled = connected || !channelSelect?.value;
        connectBtn.classList.toggle('hidden', connected);
    }
    
    if (disconnectBtn) {
        disconnectBtn.disabled = !connected;
        disconnectBtn.classList.toggle('hidden', !connected);
    }
    
    if (guildSelect && channelSelect) {
        guildSelect.disabled = connected;
        channelSelect.disabled = connected || !guildSelect.value;
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Add to DOM
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}
