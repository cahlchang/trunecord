// Global state
let connected = false;
let streaming = false;

// DOM elements
let guildSelect, channelSelect, connectBtn, disconnectBtn;
let connectionStatus, streamingStatus;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    setupEventListeners();
    updateStatus();
    
    // Poll status every 2 seconds
    setInterval(updateStatus, 2000);
});

function initializeElements() {
    guildSelect = document.getElementById('guild-select');
    channelSelect = document.getElementById('channel-select');
    connectBtn = document.getElementById('connect-btn');
    disconnectBtn = document.getElementById('disconnect-btn');
    connectionStatus = document.getElementById('connection-status');
    streamingStatus = document.getElementById('streaming-status');
}

function setupEventListeners() {
    if (guildSelect) {
        guildSelect.addEventListener('change', onGuildChange);
    }
    
    if (channelSelect) {
        channelSelect.addEventListener('change', onChannelChange);
    }
}

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
        const response = await fetch(`/api/channels/${guildId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch channels');
        }
        
        const data = await response.json();
        const channels = data.channels || [];
        
        // Filter voice channels (type 2) and sort by position
        const voiceChannels = channels
            .filter(channel => channel.type === undefined || channel.type === 2)
            .sort((a, b) => a.position - b.position);
        
        if (voiceChannels.length === 0) {
            channelSelect.innerHTML = '<option value="">No voice channels available</option>';
            return;
        }
        
        // Populate channel select
        voiceChannels.forEach(channel => {
            const option = document.createElement('option');
            option.value = channel.id;
            option.textContent = channel.name;
            channelSelect.appendChild(option);
        });
        
        channelSelect.disabled = false;
        
    } catch (error) {
        console.error('Error fetching channels:', error);
        channelSelect.innerHTML = '<option value="">Error loading channels</option>';
    }
}

function onChannelChange() {
    const channelId = channelSelect.value;
    connectBtn.disabled = !channelId || connected;
}

async function connect() {
    const guildId = guildSelect.value;
    const channelId = channelSelect.value;
    
    if (!guildId || !channelId) {
        alert('Please select a server and voice channel');
        return;
    }
    
    try {
        connectBtn.disabled = true;
        connectBtn.textContent = 'Connecting...';
        
        const response = await fetch('/api/connect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                guildId: guildId,
                channelId: channelId
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to connect');
        }
        
        const data = await response.json();
        
        if (data.success) {
            connected = true;
            updateUI();
            showNotification('Connected to Discord voice channel!', 'success');
        } else {
            throw new Error(data.message || 'Connection failed');
        }
        
    } catch (error) {
        console.error('Connection error:', error);
        showNotification('Failed to connect: ' + error.message, 'error');
    } finally {
        connectBtn.textContent = 'Connect';
        updateUI();
    }
}

async function disconnect() {
    try {
        disconnectBtn.disabled = true;
        disconnectBtn.textContent = 'Disconnecting...';
        
        const response = await fetch('/api/disconnect', {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error('Failed to disconnect');
        }
        
        const data = await response.json();
        
        if (data.success) {
            connected = false;
            streaming = false;
            updateUI();
            showNotification('Disconnected from Discord', 'success');
        } else {
            throw new Error(data.message || 'Disconnection failed');
        }
        
    } catch (error) {
        console.error('Disconnection error:', error);
        showNotification('Failed to disconnect: ' + error.message, 'error');
    } finally {
        disconnectBtn.textContent = 'Disconnect';
        updateUI();
    }
}

async function updateStatus() {
    try {
        const response = await fetch('/api/status');
        if (!response.ok) {
            return;
        }
        
        const data = await response.json();
        connected = data.connected || false;
        streaming = data.streaming || false;
        
        updateUI();
        
    } catch (error) {
        console.error('Status update error:', error);
    }
}

function updateUI() {
    if (connectionStatus) {
        connectionStatus.textContent = connected ? 'Connected' : 'Disconnected';
        connectionStatus.style.color = connected ? '#57f287' : '#ed4245';
    }
    
    if (streamingStatus) {
        streamingStatus.textContent = streaming ? 'Streaming' : 'Stopped';
        streamingStatus.style.color = streaming ? '#57f287' : '#ed4245';
    }
    
    if (connectBtn) {
        connectBtn.disabled = connected || !channelSelect?.value;
    }
    
    if (disconnectBtn) {
        disconnectBtn.disabled = !connected;
    }
    
    if (guildSelect && channelSelect) {
        guildSelect.disabled = connected;
        channelSelect.disabled = connected || !guildSelect.value;
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '15px 20px',
        borderRadius: '8px',
        color: 'white',
        fontWeight: '500',
        zIndex: '1000',
        maxWidth: '300px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        transform: 'translateX(100%)',
        transition: 'transform 0.3s ease'
    });
    
    // Set background color based on type
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#57f287';
            break;
        case 'error':
            notification.style.backgroundColor = '#ed4245';
            break;
        default:
            notification.style.backgroundColor = '#5865f2';
    }
    
    // Add to DOM
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}