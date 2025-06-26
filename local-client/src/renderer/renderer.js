// State management
let authData = null;
let selectedGuild = null;
let selectedChannel = null;
let isConnected = false;
let extensionConnected = false;

// DOM Elements
const authSection = document.getElementById('auth-section');
const authStatus = document.getElementById('auth-status');
const authBtn = document.getElementById('auth-btn');
const serverSection = document.getElementById('server-section');
const guildSelect = document.getElementById('guild-select');
const channelSelect = document.getElementById('channel-select');
const connectionSection = document.getElementById('connection-section');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const connectBtn = document.getElementById('connect-btn');
const sourcesSection = document.getElementById('sources-section');
const ytMusicStatus = document.getElementById('yt-music-status');
const testSection = document.getElementById('test-section');
const testAudioBtn = document.getElementById('test-audio-btn');
const testStatus = document.getElementById('test-status');

// Initialize
async function init() {
  console.log('Initializing renderer...');
  // Load stored data
  const storedData = await window.electronAPI.getStoredData();
  
  if (storedData.token) {
    authData = {
      token: storedData.token,
      guilds: storedData.guilds
    };
    updateAuthUI(true);
    
    if (storedData.selectedGuild) {
      selectedGuild = storedData.selectedGuild;
      selectedChannel = storedData.selectedChannel;
      await populateGuilds();
      guildSelect.value = selectedGuild;
      await populateChannels();
      channelSelect.value = selectedChannel;
    } else {
      await populateGuilds();
    }
  } else {
    // If no token, show auth button
    updateAuthUI(false);
  }
  
  // Initialize connection UI
  updateConnectionUI('disconnected');
  
  // Set up WebSocket to monitor extension connection
  monitorExtensionConnection();
  
  // Listen for auth success from main process
  window.electronAPI.onAuthSuccess(async (data) => {
    authData = data;
    await window.electronAPI.saveAuthData(data);
    updateAuthUI(true);
    await populateGuilds();
  });
}

// Update auth UI
function updateAuthUI(authenticated) {
  if (authenticated) {
    authStatus.innerHTML = `
      <p style="color: #43b581;">Authenticated</p>
      <button id="logout-btn" class="btn btn-danger">Logout</button>
    `;
    
    document.getElementById('logout-btn').addEventListener('click', logout);
    
    serverSection.style.display = 'block';
    connectionSection.style.display = 'block';
    sourcesSection.style.display = 'block';
  } else {
    authStatus.innerHTML = `
      <p>Not authenticated</p>
      <button id="auth-btn" class="btn btn-primary">Login with Discord</button>
    `;
    
    document.getElementById('auth-btn').addEventListener('click', startAuth);
    
    serverSection.style.display = 'none';
    connectionSection.style.display = 'none';
    sourcesSection.style.display = 'none';
  }
}

// Start authentication
async function startAuth() {
  await window.electronAPI.startAuthFlow();
}

// Logout
async function logout() {
  authData = null;
  selectedGuild = null;
  selectedChannel = null;
  
  // Clear stored data
  await window.electronAPI.saveAuthData({ token: null, guilds: [] });
  await window.electronAPI.saveSelection({ guildId: null, channelId: null });
  
  if (isConnected) {
    await disconnect();
  }
  
  updateAuthUI(false);
}

// Populate guild dropdown
async function populateGuilds() {
  guildSelect.innerHTML = '<option value="">Select a server...</option>';
  
  if (authData && authData.guilds) {
    authData.guilds.forEach(guild => {
      const option = document.createElement('option');
      option.value = guild.id;
      option.textContent = guild.name;
      guildSelect.appendChild(option);
    });
  }
}

// Populate channel dropdown
async function populateChannels() {
  channelSelect.innerHTML = '<option value="">Select a channel...</option>';
  channelSelect.disabled = true;
  
  if (!selectedGuild) return;
  
  const result = await window.electronAPI.getChannels(selectedGuild);
  
  if (result.success && result.channels) {
    channelSelect.disabled = false;
    result.channels.forEach(channel => {
      const option = document.createElement('option');
      option.value = channel.id;
      option.textContent = channel.name;
      channelSelect.appendChild(option);
    });
  }
}

// Connect to Discord
async function connect() {
  console.log('Connect button clicked');
  console.log('Selected guild:', selectedGuild);
  console.log('Selected channel:', selectedChannel);
  
  if (!selectedGuild || !selectedChannel) {
    alert('Please select a server and channel first');
    return;
  }
  
  updateConnectionUI('connecting');
  
  const result = await window.electronAPI.connectDiscord({
    guildId: selectedGuild,
    channelId: selectedChannel
  });
  
  if (result.success) {
    isConnected = true;
    updateConnectionUI('connected');
  } else {
    let errorMessage = result.error || 'Unknown error';
    
    // Provide more helpful error messages
    if (errorMessage.includes('Guild not found')) {
      errorMessage = 'Bot is not in the selected server. Please invite the bot to your server first.';
    } else if (errorMessage.includes('Channel not found')) {
      errorMessage = 'Voice channel not found. Please refresh and select a valid voice channel.';
    } else if (errorMessage.includes('CONNECT permission')) {
      errorMessage = 'Bot does not have permission to connect to this voice channel.';
    } else if (errorMessage.includes('SPEAK permission')) {
      errorMessage = 'Bot does not have permission to speak in this voice channel.';
    } else if (errorMessage.includes('No authentication token')) {
      errorMessage = 'Not authenticated. Please login with Discord first.';
    }
    
    alert(`Failed to connect: ${errorMessage}`);
    updateConnectionUI('disconnected');
  }
}

// Disconnect from Discord
async function disconnect() {
  await window.electronAPI.disconnectDiscord();
  isConnected = false;
  updateConnectionUI('disconnected');
}

// Update connection UI
function updateConnectionUI(status) {
  console.log('Updating connection UI to:', status);
  
  switch (status) {
    case 'connected':
      statusIndicator.className = 'status-indicator connected';
      statusText.textContent = 'Connected';
      connectBtn.textContent = 'Disconnect';
      connectBtn.className = 'btn btn-danger';
      connectBtn.onclick = disconnect;
      connectBtn.disabled = false;
      testSection.style.display = 'block';
      break;
      
    case 'connecting':
      statusIndicator.className = 'status-indicator connecting';
      statusText.textContent = 'Connecting...';
      connectBtn.disabled = true;
      break;
      
    case 'disconnected':
      statusIndicator.className = 'status-indicator';
      statusText.textContent = 'Disconnected';
      connectBtn.textContent = 'Connect to Discord';
      connectBtn.className = 'btn btn-success';
      connectBtn.onclick = connect;
      connectBtn.disabled = false;
      testSection.style.display = 'none';
      console.log('Connect button onclick set to:', connect);
      break;
  }
}

// Monitor extension connection
function monitorExtensionConnection() {
  const ws = new WebSocket('ws://localhost:8765');
  
  ws.onopen = () => {
    extensionConnected = true;
    ytMusicStatus.textContent = 'Extension connected';
    ytMusicStatus.className = 'source-status active';
  };
  
  ws.onclose = () => {
    extensionConnected = false;
    ytMusicStatus.textContent = 'Extension not detected';
    ytMusicStatus.className = 'source-status';
    
    // Retry connection after 5 seconds
    setTimeout(monitorExtensionConnection, 5000);
  };
  
  ws.onerror = () => {
    // Connection error, will retry
  };
}

// Event listeners
guildSelect.addEventListener('change', async (e) => {
  selectedGuild = e.target.value;
  selectedChannel = null;
  channelSelect.value = '';
  
  await window.electronAPI.saveSelection({ 
    guildId: selectedGuild, 
    channelId: null 
  });
  
  await populateChannels();
});

channelSelect.addEventListener('change', async (e) => {
  selectedChannel = e.target.value;
  
  await window.electronAPI.saveSelection({ 
    guildId: selectedGuild, 
    channelId: selectedChannel 
  });
});

// Test audio button event listener
testAudioBtn.addEventListener('click', async () => {
  testAudioBtn.disabled = true;
  testStatus.textContent = 'Generating test audio...';
  
  try {
    const result = await window.electronAPI.sendTestAudio();
    
    if (result.success) {
      testStatus.textContent = 'Test audio sent successfully!';
      testStatus.style.color = '#43b581';
    } else {
      testStatus.textContent = `Failed: ${result.error}`;
      testStatus.style.color = '#f04747';
    }
  } catch (error) {
    testStatus.textContent = `Error: ${error.message}`;
    testStatus.style.color = '#f04747';
  }
  
  testAudioBtn.disabled = false;
  
  // Clear status after 3 seconds
  setTimeout(() => {
    testStatus.textContent = '';
  }, 3000);
});

// Initialize on load
init();