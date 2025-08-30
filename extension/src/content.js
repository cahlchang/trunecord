// Button states
let isStreaming = false;
let isSendingAudio = true; // Default: send audio to Discord
let discordButton = null;
let hasPausedOnDisconnect = false;

// Create Discord button
function createDiscordButton() {
  const button = document.createElement('button');
  button.id = 'discord-stream-button';
  button.className = 'discord-stream-button';
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
    <span>Streaming</span>
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
  
  const duration = isWarning ? 5000 : 3000; // Show warning messages longer
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

// Insert button into YouTube Music player
function insertButton() {
  // Look for the player bar
  const playerBar = document.querySelector('ytmusic-player-bar');
  if (!playerBar) {
    setTimeout(insertButton, 1000);
    return;
  }
  
  // Find the left controls and middle controls sections
  const leftControls = playerBar.querySelector('.left-controls');
  const middleControls = playerBar.querySelector('.middle-controls');
  
  if (!leftControls || !middleControls) {
    setTimeout(insertButton, 1000);
    return;
  }
  
  // Check if button already exists
  if (document.getElementById('discord-stream-button')) {
    return;
  }
  
  // Create the button
  discordButton = createDiscordButton();
  
  // Insert the button between left-controls and middle-controls
  // The button will be inserted after left-controls
  leftControls.parentNode.insertBefore(discordButton, middleControls);
  
  // Check initial streaming status
  checkStreamingStatus();
  
  // Listen for music playback events
  observeMusicPlayback();
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
    
    // Pause YouTube Music if playing (only once)
    if (!hasPausedOnDisconnect) {
      hasPausedOnDisconnect = true;
      pauseYouTubeMusic();
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
    
    // Pause YouTube Music
    pauseYouTubeMusic();
  }
});

// Pause YouTube Music playback
function pauseYouTubeMusic() {
  // Find the play/pause button
  const playPauseButton = document.querySelector('tp-yt-paper-icon-button#play-pause-button');
  
  if (playPauseButton) {
    // Check if currently playing by looking at the title attribute
    const isPlaying = playPauseButton.title && 
                     (playPauseButton.title.toLowerCase().includes('pause') || 
                      playPauseButton.title === chrome.i18n.getMessage('pause') ||
                      playPauseButton.getAttribute('aria-label')?.toLowerCase().includes('pause'));
    
    if (isPlaying) {
      // Click the button to pause
      playPauseButton.click();
      console.log('YouTube Music paused due to connection loss');
    }
  }
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', insertButton);
} else {
  insertButton();
}

// Watch for page navigation in YouTube Music (it's a SPA)
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
  let wasPlaying = false;
  
  const checkPlaybackState = () => {
    const playPauseButton = document.querySelector('tp-yt-paper-icon-button#play-pause-button');
    
    if (playPauseButton) {
      const isPlaying = playPauseButton.title && 
                       (playPauseButton.title.toLowerCase().includes('pause') || 
                        playPauseButton.title === chrome.i18n.getMessage('pause') ||
                        playPauseButton.getAttribute('aria-label')?.toLowerCase().includes('pause'));
      
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
  const playerBar = document.querySelector('ytmusic-player-bar');
  if (playerBar) {
    playButtonObserver.observe(playerBar, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['title', 'aria-label']
    });
  }
}