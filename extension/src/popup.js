// Check connection status
async function checkConnection() {
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  
  try {
    // Try to connect to local client
    const ws = new WebSocket('ws://localhost:8765');
    
    ws.onopen = () => {
      statusIndicator.classList.add('connected');
      statusText.textContent = 'Local client connected';
      ws.close();
    };
    
    ws.onerror = () => {
      statusIndicator.classList.remove('connected');
      statusText.textContent = 'Local client not running';
    };
    
    ws.onclose = () => {
      if (!statusIndicator.classList.contains('connected')) {
        statusIndicator.classList.remove('connected');
        statusText.textContent = 'Local client not running';
      }
    };
  } catch (error) {
    statusIndicator.classList.remove('connected');
    statusText.textContent = 'Local client not running';
  }
}

// Open local client link
document.getElementById('open-client').addEventListener('click', (e) => {
  e.preventDefault();
  // Note: Extensions can't directly launch desktop apps
  // This would need to be handled differently in production
  alert('Please launch the Music to Discord client application manually.');
});

// Add manual capture button for YouTube Music tabs
async function addCaptureButton() {
  const info = document.querySelector('.info');
  
  // Check if we're on YouTube Music
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab || !activeTab.url || !activeTab.url.includes('music.youtube.com')) {
    return;
  }
  
  // Check current streaming status
  const statusResponse = await chrome.runtime.sendMessage({ action: 'getStreamStatus' });
  const isStreaming = statusResponse && statusResponse.isStreaming;
  
  const captureSection = document.createElement('div');
  captureSection.style.marginTop = '16px';
  captureSection.innerHTML = `
    <button id="manual-capture" style="
      width: 100%;
      padding: 10px;
      background-color: ${isStreaming ? '#f04747' : '#5865f2'};
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    ">
      ${isStreaming ? 'Stop Streaming' : 'Start Streaming'}
    </button>
    <p style="font-size: 12px; color: #888; margin-top: 8px;">
      Control YouTube Music streaming to Discord
    </p>
  `;
  
  info.appendChild(captureSection);
  
  document.getElementById('manual-capture').addEventListener('click', async () => {
    const button = document.getElementById('manual-capture');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Starting...';
    
    try {
      // Check if already streaming
      const statusResponse = await chrome.runtime.sendMessage({ action: 'getStreamStatus' });
      
      if (statusResponse && statusResponse.isStreaming) {
        // If already streaming, stop it
        const response = await chrome.runtime.sendMessage({ action: 'stopStream' });
        if (response.success) {
          button.textContent = 'Streaming stopped';
          setTimeout(() => {
            window.close();
          }, 1000);
        }
        return;
      }
      
      // This will work because it's triggered by user action in the popup
      const response = await chrome.runtime.sendMessage({ 
        action: 'startStreamFromPopup',
        tabId: activeTab.id
      });
      
      if (response.success) {
        button.textContent = 'Streaming started!';
        setTimeout(() => {
          window.close();
        }, 1000);
      } else {
        // Show user-friendly error messages
        let errorMessage = response.error || 'Unknown error';
        if (errorMessage.includes('Cannot capture a tab with an active stream')) {
          errorMessage = 'Stream already active. Please try again.';
        }
        button.textContent = 'Failed: ' + errorMessage;
        button.style.backgroundColor = '#f04747';
        setTimeout(() => {
          button.textContent = originalText;
          button.disabled = false;
          button.style.backgroundColor = '';
        }, 3000);
      }
    } catch (error) {
      button.textContent = 'Error: ' + error.message;
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 3000);
    }
  });
}

// Check connection on popup open
checkConnection();
addCaptureButton();

// Recheck every 2 seconds
setInterval(checkConnection, 2000);