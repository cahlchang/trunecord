// Detect which music service we're on
const musicService = detectMusicService();

// Button states
let isStreaming = false;
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
    playerSelector: '[data-testid="now-playing-widget"], .Root__now-playing-bar, footer[data-testid="now-playing-bar"], .now-playing-bar',
    leftControlsSelector: '[data-testid="player-controls"], .player-controls, [data-testid="control-buttons"]',
    middleControlsSelector: '[data-testid="playback-progressbar"], .playback-bar, [data-testid="playback-position"]',
    playPauseSelector: '[data-testid="control-button-playpause"], button[aria-label*="Play"], button[aria-label*="Pause"]',
    insertPosition: 'afterend',
    isPlayingCheck: (button) => {
      const ariaLabel = button.getAttribute('aria-label');
      return ariaLabel && ariaLabel.toLowerCase().includes('pause');
    }
  },
  appleMusic: {
    name: 'Apple Music',
    playerSelector: '.web-chrome-playback-controls, amp-playback-controls, .bottom-player__controls, [class*="PlaybackControls"]',
    leftControlsSelector: '.web-chrome-playback-controls__buttons, .playback-controls__buttons, [class*="PlaybackControls__Buttons"]',
    middleControlsSelector: '.web-chrome-playback-controls__time, .playback-controls__time, [class*="PlaybackControls__Time"]',
    playPauseSelector: '[data-testid="play-pause-button"], .playback-play-pause-button, button[aria-label*="Play"], button[aria-label*="Pause"]',
    insertPosition: 'afterend',
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
    playerSelector: '#transport, [data-testid="player-bar"], .hydrated-music-player, #nowPlayingBar',
    leftControlsSelector: '#transportControls, [data-testid="transport-controls"], .playbackControls, button[aria-label*="再生"], button[aria-label*="一時停止"]',
    middleControlsSelector: '#nowPlayingSection, [data-testid="now-playing-section"], .trackInfoContainer',
    playPauseSelector: 'button[aria-label*="再生"], button[aria-label*="一時停止"], button[aria-label*="Play"], button[aria-label*="Pause"]',
    insertPosition: 'afterend',
    isPlayingCheck: (button) => {
      const ariaLabel = button.getAttribute('aria-label');
      return ariaLabel && (ariaLabel.includes('一時停止') || ariaLabel.toLowerCase().includes('pause'));
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
  
  // Discord icon SVG (will be shown when not streaming)
  const discordIcon = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="discord-icon">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  `;
  
  // Stop icon SVG (will be shown when streaming)
  const stopIcon = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="stop-icon" style="display:none;">
      <rect x="5" y="5" width="14" height="14" rx="2" ry="2"/>
    </svg>
  `;
  
  button.innerHTML = `${discordIcon}${stopIcon}<span>${chrome.i18n.getMessage('disconnected') || 'Disconnected'}</span>`;
  button.title = chrome.i18n.getMessage('clickExtensionIcon') || 'Chrome拡張アイコンをクリックして開始';
  
  button.addEventListener('click', toggleStream);
  
  return button;
}

// Toggle streaming
async function toggleStream() {
  if (!discordButton) return;
  
  // If not streaming, show message to use extension
  if (!isStreaming) {
    showNotification('⚠️ ' + (chrome.i18n.getMessage('clickExtensionIcon') || 'Chrome拡張アイコンをクリックして開始してください'), true);
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
        showNotification(chrome.i18n.getMessage('streamingStopped') || 'ストリーミングを停止しました');
      }
      discordButton.disabled = false;
    });
  } catch (error) {
    showNotification(chrome.i18n.getMessage('failedToConnect') || '接続に失敗しました');
    discordButton.disabled = false;
  }
}

// This function is no longer used - streaming starts from extension popup only
// Kept for compatibility with older code
async function startStream() {
  if (!discordButton) return;
  showNotification('⚠️ ' + (chrome.i18n.getMessage('clickExtensionIcon') || 'Chrome拡張アイコンをクリックして開始してください'), true);
}

// Update button appearance
function updateButtonState() {
  if (!discordButton) return;
  
  const span = discordButton.querySelector('span');
  const discordIcon = discordButton.querySelector('.discord-icon');
  const stopIcon = discordButton.querySelector('.stop-icon');
  
  if (isStreaming) {
    // Streaming state - show stop icon and "接続中" text
    discordButton.classList.add('streaming');
    discordButton.classList.remove('disconnected');
    span.textContent = chrome.i18n.getMessage('connected') || '接続中';
    discordButton.title = chrome.i18n.getMessage('clickToStop') || 'クリックして停止';
    
    // CSS (.streaming) handles icon switching automatically
  } else {
    // Not streaming - show Discord icon and "未接続" text
    discordButton.classList.remove('streaming');
    discordButton.classList.add('disconnected');
    span.textContent = chrome.i18n.getMessage('disconnected') || '未接続';
    discordButton.title = chrome.i18n.getMessage('clickExtensionIcon') || 'Chrome拡張アイコンをクリックして開始';
    
    // CSS (.streaming removal) handles icon switching automatically
  }
}

// Show notification
function showNotification(message, isWarning = false) {
  const notification = document.createElement('div');
  notification.className = 'discord-notification' + (isWarning ? ' warning' : '');
  notification.textContent = message;
  
  // For Apple Music, show notification at the top
  if (musicService === 'appleMusic') {
    notification.classList.add('top-notification');
  }
  
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
    console.log('trunecord: Music service not supported:', window.location.hostname);
    return;
  }
  
  // Check if button already exists
  if (document.getElementById('discord-stream-button')) {
    return;
  }
  
  // Create the button
  discordButton = createDiscordButton();
  
  // Find the player bar based on service
  let playerBar = null;
  let insertLocation = null;
  
  switch (musicService) {
    case 'spotify': {
      // Spotify: Find the player controls container
      playerBar = document.querySelector('[data-testid="player-controls"]') || 
                 document.querySelector('.player-controls') ||
                 document.querySelector('footer [data-testid="control-buttons"]') ||
                 document.querySelector('footer');
      
      if (playerBar) {
        // Try to find the shuffle button or first button group
        const shuffleButton = playerBar.querySelector('[data-testid="control-button-shuffle"]');
        const skipBackButton = playerBar.querySelector('[data-testid="control-button-skip-back"]');
        
        if (shuffleButton) {
          insertLocation = shuffleButton.parentElement;
        } else if (skipBackButton) {
          insertLocation = skipBackButton.parentElement;
        } else {
          insertLocation = playerBar;
        }
      }
      break;
    }

    case 'amazonMusic': {
      // Amazon Music: Find the best location in the player bar
      // Strategy 1: Look for the volume control area (right side of player)
      const volumeControl = document.querySelector('[aria-label*="ボリューム"], [aria-label*="Volume"], [class*="volume"], #volumeSlider');
      if (volumeControl) {
        // Insert before volume control
        const volumeContainer = volumeControl.closest('div');
        if (volumeContainer) {
          volumeContainer.insertAdjacentElement('beforebegin', discordButton);
          console.log('trunecord: Button inserted before Amazon Music volume control');
          checkStreamingStatus();
          observeMusicPlayback();
          return;
        }
      }
      
      // Strategy 2: Find the footer player area
      const footerPlayer = document.querySelector('footer music-app-player, footer [class*="player"], footer');
      if (footerPlayer) {
        // Look for the right side controls
        const rightControls = footerPlayer.querySelector('[class*="right"], [class*="end"], [class*="volume"]');
        if (rightControls) {
          rightControls.insertAdjacentElement('afterbegin', discordButton);
          console.log('trunecord: Button inserted in Amazon Music right controls');
          checkStreamingStatus();
          observeMusicPlayback();
          return;
        }
      }
      
      // Strategy 3: Find the transport area and add to the end
      const transportArea = document.querySelector('#transport, #transportControls, [class*="transport"]');
      if (transportArea) {
        // Create a container for our button
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: inline-flex; align-items: center; margin-left: 16px;';
        buttonContainer.appendChild(discordButton);
        transportArea.appendChild(buttonContainer);
        console.log('trunecord: Button added to Amazon Music transport area');
        checkStreamingStatus();
        observeMusicPlayback();
        return;
      }
      
      // Fallback: Add as fixed element if player not found
      discordButton.style.cssText = `
        position: fixed !important;
        bottom: 20px !important;
        right: 20px !important;
        z-index: 9999 !important;
        height: 40px !important;
        padding: 0 20px !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        background-color: #5865f2 !important;
        color: white !important;
        border: 2px solid rgba(255, 255, 255, 0.3) !important;
        border-radius: 20px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
      `;
      document.body.appendChild(discordButton);
      console.log('trunecord: Button added as fixed element for Amazon Music');
      checkStreamingStatus();
      observeMusicPlayback();
      break;
    }

    case 'appleMusic': {
      // Apple Music: Position button below the play button in control bar
      // Find the media control buttons group (previous, play, next)
      const findPlaybackControls = () => {
        // Look for the play button in the header control bar
        const headerElement = document.querySelector('header, [role="banner"]');
        if (!headerElement) return null;
        
        // Find all buttons and look for the play button specifically
        const allButtons = Array.from(headerElement.querySelectorAll('button'));
        
        // Find play button by aria-label or by position in center
        let playButton = allButtons.find(btn => {
          const ariaLabel = btn.getAttribute('aria-label') || '';
          return ariaLabel.includes('再生') || ariaLabel.includes('一時停止') || 
                 ariaLabel.includes('Play') || ariaLabel.includes('Pause');
        });
        
        // If not found by label, find center buttons
        if (!playButton) {
          const centerX = window.innerWidth / 2;
          const centerButtons = allButtons.filter(btn => {
            const rect = btn.getBoundingClientRect();
            return Math.abs(rect.left + rect.width / 2 - centerX) < 150;
          });
          
          // Usually the play button is the middle one of the center controls
          if (centerButtons.length >= 3) {
            playButton = centerButtons[1]; // Middle button (play/pause)
          } else if (centerButtons.length > 0) {
            playButton = centerButtons[0];
          }
        }
        
        return playButton;
      };
      
      const playButton = findPlaybackControls();
      
      if (playButton) {
        const playRect = playButton.getBoundingClientRect();
        
        // Create a floating button below the play button
        discordButton.style.cssText = `
          position: fixed !important;
          left: ${playRect.left + (playRect.width / 2)}px !important;
          top: ${playRect.bottom + 8}px !important;
          z-index: 10000 !important;
          height: 28px !important;
          padding: 0 16px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          background-color: #5865f2 !important;
          color: white !important;
          border: 2px solid rgba(255, 255, 255, 0.3) !important;
          border-radius: 14px !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
          backdrop-filter: blur(10px) !important;
          transform: translateX(-50%) !important;
        `;
        document.body.appendChild(discordButton);
        console.log('trunecord: Button positioned below play control button');
        
        // Update position when window resizes
        const updatePosition = () => {
          const updatedPlayButton = findPlaybackControls();
          if (updatedPlayButton) {
            const rect = updatedPlayButton.getBoundingClientRect();
            discordButton.style.left = `${rect.left + (rect.width / 2)}px`;
            discordButton.style.top = `${rect.bottom + 8}px`;
          }
        };
        
        window.addEventListener('resize', updatePosition);
        
        checkStreamingStatus();
        observeMusicPlayback();
        return;
      }
      
      // Fallback: Fixed position below where play button typically is
      discordButton.style.cssText = `
        position: fixed !important;
        left: calc(50% - 50px) !important;
        top: 55px !important;
        z-index: 10000 !important;
        height: 28px !important;
        padding: 0 16px !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        background-color: #5865f2 !important;
        color: white !important;
        border: 2px solid rgba(255, 255, 255, 0.3) !important;
        border-radius: 14px !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
        backdrop-filter: blur(10px) !important;
      `;
      document.body.appendChild(discordButton);
      console.log('trunecord: Button added below play controls (fallback position)');
      checkStreamingStatus();
      observeMusicPlayback();
      break;
    }

    case 'youtube': {
      // YouTube Music: Original implementation
      playerBar = document.querySelector(config.playerSelector);
      if (playerBar) {
        const leftControls = playerBar.querySelector(config.leftControlsSelector);
        if (leftControls) {
          const middleControls = playerBar.querySelector(config.middleControlsSelector);
          if (middleControls) {
            leftControls.parentNode.insertBefore(discordButton, middleControls);
          } else {
            leftControls.insertAdjacentElement('afterend', discordButton);
          }
        } else {
          playerBar.prepend(discordButton);
        }
        console.log('trunecord: Button inserted into YouTube Music player bar');
        checkStreamingStatus();
        observeMusicPlayback();
        return;
      }
      break;
    }
  }
  
  // Insert the button if we found a location
  if (insertLocation) {
    // Insert after the first child (usually after previous/play buttons)
    if (insertLocation.children && insertLocation.children.length > 0) {
      // Find the skip forward button or last control button
      const skipForward = insertLocation.querySelector('[data-testid="control-button-skip-forward"]') ||
                         insertLocation.querySelector('[aria-label*="次へ"]') ||
                         insertLocation.querySelector('[aria-label*="Next"]');
      
      if (skipForward) {
        skipForward.insertAdjacentElement('afterend', discordButton);
      } else if (insertLocation.children.length >= 3) {
        // Insert after the third button (usually after play/pause)
        insertLocation.children[2].insertAdjacentElement('afterend', discordButton);
      } else {
        insertLocation.appendChild(discordButton);
      }
    } else {
      insertLocation.appendChild(discordButton);
    }
    
    console.log(`trunecord: Button inserted into ${config.name} player`);
  } else {
    console.log('trunecord: Player controls not found, retrying...');
    setTimeout(insertButton, 1000);
    return;
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
  // No longer needed - styling is handled in CSS
}

// Check streaming status
async function checkStreamingStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getStreamStatus' });
    isStreaming = !!(response && response.isStreaming === true);
    updateButtonState();
  } catch (error) {
    // Failed to check streaming status
    console.error('Failed to check streaming status:', error);
    isStreaming = false;
    updateButtonState();
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

// Clean up observer on page unload
window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
window.addEventListener('beforeunload', () => observer.disconnect(), { once: true });

// Observe music playback events (currently not used, but kept for future features)
function observeMusicPlayback() {
  // This function is no longer needed as streaming is only started from extension popup
  // Kept for potential future use
}

// Log current service on load
console.log(`trunecord: Detected music service - ${getServiceConfig()?.name || 'Unknown'}`);