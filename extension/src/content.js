// Detect which music service we're on
const musicService = detectMusicService();

// Button states
let isStreaming = false;
let isSendingAudio = true; // Default: send audio to Discord
let discordButton = null;
let hasPausedOnDisconnect = false;

// Service configurations
const serviceConfigs = {
  youtube: {
    name: 'YouTube Music',
    playerSelector: 'ytmusic-player-bar',
    leftControlsSelector: '.left-controls',
    middleControlsSelector: '.middle-controls',
    playPauseSelector: 'tp-yt-paper-icon-button#play-pause-button',
    isPlayingCheck: (button) => {
      return button.title && 
             (button.title.toLowerCase().includes('pause') || 
              button.title === chrome.i18n.getMessage('pause') ||
              button.getAttribute('aria-label')?.toLowerCase().includes('pause'));
    }
  },
  spotify: {
    name: 'Spotify',
    playerSelector: '[data-testid="now-playing-widget"], .Root__now-playing-bar',
    leftControlsSelector: '[data-testid="player-controls"], .player-controls',
    middleControlsSelector: '[data-testid="playback-progressbar"], .playback-bar',
    playPauseSelector: '[data-testid="control-button-playpause"], .player-controls__buttons button[data-testid="control-button-playpause"]',
    insertPosition: 'afterend',
    isPlayingCheck: (button) => {
      const ariaLabel = button.getAttribute('aria-label');
      return ariaLabel && ariaLabel.toLowerCase().includes('pause');
    }
  },
  appleMusic: {
    name: 'Apple Music',
    playerSelector: '.web-chrome-playback-controls, amp-playback-controls',
    leftControlsSelector: '.web-chrome-playback-controls__buttons, .playback-controls__buttons',
    middleControlsSelector: '.web-chrome-playback-controls__time, .playback-controls__time',
    playPauseSelector: '[data-testid="play-pause-button"], .playback-play-pause-button',
    isPlayingCheck: (button) => {
      const ariaLabel = button.getAttribute('aria-label');
      const classList = button.classList;
      return (ariaLabel && ariaLabel.toLowerCase().includes('pause')) ||
             classList.contains('is-playing') ||
             classList.contains('playing');
    }
  },
  amazonMusic: {
    name: 'Amazon Music',
    playerSelector: '#transport, [data-testid="player-bar"]',
    leftControlsSelector: '#transportControls, [data-testid="transport-controls"]',
    middleControlsSelector: '#nowPlayingSection, [data-testid="now-playing-section"]',
    playPauseSelector: '[aria-label*="Play"], [aria-label*="Pause"], [data-testid="play-button"]',
    insertPosition: 'afterend',
    isPlayingCheck: (button) => {
      const ariaLabel = button.getAttribute('aria-label');
      return ariaLabel && ariaLabel.toLowerCase().includes('pause');
    }
  }
};

// Detect which music service we're on
function detectMusicService() {
  const hostname = window.location.hostname;
  
  if (hostname.includes('music.youtube.com')) {
    return 'youtube';
  } else if (hostname.includes('spotify.com')) {
    return 'spotify';
  } else if (hostname.includes('music.apple.com')) {
    return 'appleMusic';
  } else if (hostname.includes('music.amazon.com') || hostname.includes('music.amazon.co.jp')) {
    return 'amazonMusic';
  }
  
  return null;
}

// Get current service configuration
function getServiceConfig() {
  return serviceConfigs[musicService] || null;
}

// Create Discord button
function createDiscordButton() {
  const button = document.createElement('button');
  button.id = 'discord-stream-button';
  button.className = 'discord-stream-button';
  
  // Add service-specific class for styling
  if (musicService) {
    button.classList.add(`discord-stream-button-${musicService}`);
  }
  
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
    <span>Discord</span>
  `;
  
  button.addEventListener('click', toggleStream);
  
  return button;
}

// Toggle streaming
async function toggleStream() {
  if (!discordButton) return;
  
  // If not streaming, toggle the sending mode
  if (!isStreaming) {
    isSendingAudio = !isSendingAudio;
    updateButtonState();
    
    // Save preference
    chrome.storage.local.set({ isSendingAudio: isSendingAudio });
    
    const message = isSendingAudio 
      ? chrome.i18n.getMessage('audioSendingEnabled') || 'Audio will be sent to Discord'
      : chrome.i18n.getMessage('audioSendingDisabled') || 'Audio will play normally';
    showNotification(message);
    return;
  }
  
  // If streaming, stop the stream
  discordButton.disabled = true;
  
  try {
    chrome.runtime.sendMessage({ action: 'stopStream' }, (response) => {
      if (chrome.runtime.lastError) {
        discordButton.disabled = false;
        return;
      }
      
      if (response && response.success) {
        isStreaming = false;
        updateButtonState();
      }
      discordButton.disabled = false;
    });
  } catch (error) {
    showNotification(chrome.i18n.getMessage('failedToConnect'));
    discordButton.disabled = false;
  }
}

// Start streaming (called from different action)
async function startStream() {
  if (!discordButton || !isSendingAudio) return;
  
  discordButton.disabled = true;
  
  try {
    chrome.runtime.sendMessage({ action: 'startStream' }, (response) => {
      if (chrome.runtime.lastError) {
        showNotification(chrome.i18n.getMessage('failedToCommunicate'));
        discordButton.disabled = false;
        return;
      }
      
      if (response && response.success) {
        isStreaming = true;
        updateButtonState();
        const config = getServiceConfig();
        showNotification(`Streaming ${config?.name || 'music'} to Discord`);
      } else if (response) {
        if (response.error && response.error.includes('extension popup')) {
          showNotification('⚠️ ' + chrome.i18n.getMessage('clickExtensionIcon'), true);
          discordButton.style.opacity = '0.6';
          discordButton.title = chrome.i18n.getMessage('clickExtensionIcon');
        } else {
          showNotification(response.error || chrome.i18n.getMessage('failedToStartStreaming'));
        }
      }
      discordButton.disabled = false;
    });
  } catch (error) {
    showNotification(chrome.i18n.getMessage('failedToConnect'));
    discordButton.disabled = false;
  }
}

// Update button appearance
function updateButtonState() {
  if (!discordButton) return;
  
  const span = discordButton.querySelector('span');
  
  if (isStreaming) {
    discordButton.classList.add('streaming');
    discordButton.classList.remove('disabled-mode');
    span.textContent = chrome.i18n.getMessage('stop') || 'Stop';
  } else if (!isSendingAudio) {
    discordButton.classList.remove('streaming');
    discordButton.classList.add('disabled-mode');
    span.textContent = chrome.i18n.getMessage('normalPlayback') || 'Normal';
  } else {
    discordButton.classList.remove('streaming');
    discordButton.classList.remove('disabled-mode');
    span.textContent = chrome.i18n.getMessage('streaming') || 'Discord';
  }
}

// Show notification
function showNotification(message, isWarning = false) {
  const notification = document.createElement('div');
  notification.className = 'discord-notification' + (isWarning ? ' warning' : '');
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  const duration = isWarning ? 5000 : 3000;
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

// Insert button into music player
function insertButton() {
  const config = getServiceConfig();
  if (!config) {
    console.log('Music service not supported:', window.location.hostname);
    return;
  }
  
  // Look for the player bar
  const playerBar = document.querySelector(config.playerSelector);
  if (!playerBar) {
    setTimeout(insertButton, 1000);
    return;
  }
  
  // Check if button already exists
  if (document.getElementById('discord-stream-button')) {
    return;
  }
  
  // Find the controls sections based on service
  const leftControls = playerBar.querySelector(config.leftControlsSelector);
  
  if (!leftControls) {
    setTimeout(insertButton, 1000);
    return;
  }
  
  // Create the button
  discordButton = createDiscordButton();
  
  // Insert the button based on service configuration
  if (config.insertPosition === 'afterend') {
    // For Spotify and Amazon Music, insert after the left controls
    leftControls.insertAdjacentElement('afterend', discordButton);
  } else {
    // For YouTube Music and Apple Music, try to insert between controls
    const middleControls = playerBar.querySelector(config.middleControlsSelector);
    if (middleControls) {
      leftControls.parentNode.insertBefore(discordButton, middleControls);
    } else {
      // Fallback: insert after left controls
      leftControls.insertAdjacentElement('afterend', discordButton);
    }
  }
  
  // Apply service-specific styling adjustments
  applyServiceSpecificStyling();
  
  // Check initial streaming status
  checkStreamingStatus();
  
  // Listen for music playback events
  observeMusicPlayback();
}

// Apply service-specific styling adjustments
function applyServiceSpecificStyling() {
  if (!discordButton) return;
  
  switch (musicService) {
    case 'spotify':
      // Spotify specific adjustments
      discordButton.style.marginLeft = '8px';
      discordButton.style.marginRight = '8px';
      break;
    case 'appleMusic':
      // Apple Music specific adjustments
      discordButton.style.marginLeft = '12px';
      discordButton.style.marginRight = '12px';
      break;
    case 'amazonMusic':
      // Amazon Music specific adjustments
      discordButton.style.marginLeft = '10px';
      discordButton.style.marginRight = '10px';
      break;
  }
}

// Check streaming status
async function checkStreamingStatus() {
  try {
    // Load saved preference
    const result = await chrome.storage.local.get(['isSendingAudio']);
    if (result.isSendingAudio !== undefined) {
      isSendingAudio = result.isSendingAudio;
    }
    
    const response = await chrome.runtime.sendMessage({ action: 'getStreamStatus' });
    isStreaming = response.isStreaming;
    updateButtonState();
  } catch (error) {
    // Failed to check streaming status
    console.error('Failed to check streaming status:', error);
  }
}

// Listen for streaming state changes from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'streamingStateChanged') {
    isStreaming = request.isStreaming;
    updateButtonState();
    
    // Reset pause flag when streaming starts
    if (isStreaming) {
      hasPausedOnDisconnect = false;
    }
  } else if (request.action === 'connectionLost') {
    isStreaming = false;
    updateButtonState();
    showNotification(chrome.i18n.getMessage('connectionLost') || 'Connection to local client lost');
    
    // Reset button opacity and title
    if (discordButton) {
      discordButton.style.opacity = '1';
      discordButton.title = '';
    }
    
    // Pause music if playing (only once)
    if (!hasPausedOnDisconnect) {
      hasPausedOnDisconnect = true;
      pauseMusic();
    }
  } else if (request.action === 'waitingModeStop') {
    isStreaming = false;
    updateButtonState();
    showNotification(chrome.i18n.getMessage('waitingModeStop') || 'Someone joined the voice channel - streaming stopped');
    
    // Reset button opacity and title
    if (discordButton) {
      discordButton.style.opacity = '1';
      discordButton.title = '';
    }
    
    // Pause music
    pauseMusic();
  }
});

// Pause music playback
function pauseMusic() {
  const config = getServiceConfig();
  if (!config) return;
  
  // Find the play/pause button
  const playPauseButton = document.querySelector(config.playPauseSelector);
  
  if (playPauseButton && config.isPlayingCheck) {
    const isPlaying = config.isPlayingCheck(playPauseButton);
    
    if (isPlaying) {
      // Click the button to pause
      playPauseButton.click();
      console.log(`${config.name} paused due to connection loss`);
    }
  }
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', insertButton);
} else {
  insertButton();
}

// Watch for page navigation (SPAs)
const observer = new MutationObserver(() => {
  if (!document.getElementById('discord-stream-button')) {
    insertButton();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Observe music playback events
function observeMusicPlayback() {
  const config = getServiceConfig();
  if (!config) return;
  
  let wasPlaying = false;
  
  const checkPlaybackState = () => {
    const playPauseButton = document.querySelector(config.playPauseSelector);
    
    if (playPauseButton && config.isPlayingCheck) {
      const isPlaying = config.isPlayingCheck(playPauseButton);
      
      // If just started playing and audio sending is enabled but not streaming
      if (isPlaying && !wasPlaying && isSendingAudio && !isStreaming) {
        // Automatically start streaming
        startStream();
      }
      
      wasPlaying = isPlaying;
    }
  };
  
  // Check periodically
  setInterval(checkPlaybackState, 1000);
  
  // Also observe play button changes
  const playButtonObserver = new MutationObserver(checkPlaybackState);
  const playerBar = document.querySelector(config.playerSelector);
  if (playerBar) {
    playButtonObserver.observe(playerBar, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['title', 'aria-label', 'class']
    });
  }
}

// Log current service on load
console.log(`trunecord: Detected music service - ${getServiceConfig()?.name || 'Unknown'}`);