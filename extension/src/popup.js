// Initialize localization
function initializeLocalization() {
  document.getElementById('popup-title').textContent = chrome.i18n.getMessage('popupTitle');
  document.getElementById('status-text').textContent = chrome.i18n.getMessage('checkingConnection');
  document.getElementById('to-start-streaming').textContent = chrome.i18n.getMessage('toStartStreaming');
  document.getElementById('open-client').textContent = chrome.i18n.getMessage('openLocalClientApp');
  document.getElementById('step-2').textContent = chrome.i18n.getMessage('goToMusicService') || chrome.i18n.getMessage('goToYouTubeMusic');
  document.getElementById('step-3').textContent = chrome.i18n.getMessage('clickDiscordButton');
}

// Check connection status
async function checkConnection() {
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  
  try {
    // Try to connect to local client
    const ws = new WebSocket('ws://localhost:8765');
    
    ws.onopen = () => {
      statusIndicator.classList.add('connected');
      statusText.textContent = chrome.i18n.getMessage('localClientConnected');
      ws.close();
    };
    
    ws.onerror = () => {
      statusIndicator.classList.remove('connected');
      statusText.textContent = chrome.i18n.getMessage('localClientNotRunning');
    };
    
    ws.onclose = () => {
      if (!statusIndicator.classList.contains('connected')) {
        statusIndicator.classList.remove('connected');
        statusText.textContent = chrome.i18n.getMessage('localClientNotRunning');
      }
    };
  } catch (error) {
    statusIndicator.classList.remove('connected');
    statusText.textContent = chrome.i18n.getMessage('localClientNotRunning');
  }
}

// Open local client link
document.getElementById('open-client').addEventListener('click', (e) => {
  e.preventDefault();
  // Note: Extensions can't directly launch desktop apps
  // This would need to be handled differently in production
  alert(chrome.i18n.getMessage('launchClientManually'));
});

// Add manual capture button for supported music service tabs
async function addCaptureButton() {
  const info = document.querySelector('.info');
  
  // Check if we're on a supported music service
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab || !activeTab.url) {
    return;
  }
  
  const supportedServices = [
    'music.youtube.com',
    'open.spotify.com',
    'music.apple.com',
    'music.amazon.com',
    'music.amazon.co.jp'
  ];
  
  const isSupported = supportedServices.some(service => activeTab.url.includes(service));
  if (!isSupported) {
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
      ${isStreaming ? chrome.i18n.getMessage('stopStreamingButton') : chrome.i18n.getMessage('startStreamingButton')}
    </button>
    <p style="font-size: 12px; color: #888; margin-top: 8px;">
      ${chrome.i18n.getMessage('controlMusicStreaming') || chrome.i18n.getMessage('controlYouTubeMusicStreaming')}
    </p>
  `;
  
  info.appendChild(captureSection);
  
  document.getElementById('manual-capture').addEventListener('click', async () => {
    const button = document.getElementById('manual-capture');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = chrome.i18n.getMessage('starting');
    
    try {
      // Check if already streaming
      const statusResponse = await chrome.runtime.sendMessage({ action: 'getStreamStatus' });
      
      if (statusResponse && statusResponse.isStreaming) {
        // If already streaming, stop it
        const response = await chrome.runtime.sendMessage({ action: 'stopStream' });
        if (response.success) {
          button.textContent = chrome.i18n.getMessage('streamingStopped');
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
        button.textContent = chrome.i18n.getMessage('streamingStarted');
        setTimeout(() => {
          window.close();
        }, 1000);
      } else {
        // Show user-friendly error messages
        let errorMessage = response.error || chrome.i18n.getMessage('unknownError');
        if (errorMessage.includes('Cannot capture a tab with an active stream')) {
          errorMessage = chrome.i18n.getMessage('streamAlreadyActive');
        }
        button.textContent = chrome.i18n.getMessage('failed') + ': ' + errorMessage;
        button.style.backgroundColor = '#f04747';
        setTimeout(() => {
          button.textContent = originalText;
          button.disabled = false;
          button.style.backgroundColor = '';
        }, 3000);
      }
    } catch (error) {
      button.textContent = chrome.i18n.getMessage('error') + ': ' + error.message;
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 3000);
    }
  });
}

// Initialize on popup open
initializeLocalization();
checkConnection();
addCaptureButton();

// Recheck every 2 seconds
setInterval(checkConnection, 2000);