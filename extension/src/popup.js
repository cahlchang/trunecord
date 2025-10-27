const VERSION_API_URL = 'https://m0j3mh0nyj.execute-api.ap-northeast-1.amazonaws.com/prod/api/version';
const DEFAULT_GO_CLIENT_DOWNLOAD_URL = 'https://github.com/cahlchang/trunecord/releases/latest';
const DEFAULT_EXTENSION_DOWNLOAD_URL = 'https://chromewebstore.google.com/detail/trunecord/dhmegdkoembgmlhekieedhkilbnjmjee';

let goClientDownloadUrl = DEFAULT_GO_CLIENT_DOWNLOAD_URL;
let extensionDownloadUrl = DEFAULT_EXTENSION_DOWNLOAD_URL;

// Initialize localization
function initializeLocalization() {
  document.getElementById('popup-title').textContent = chrome.i18n.getMessage('popupTitle');
  document.getElementById('status-text').textContent = chrome.i18n.getMessage('checkingConnection');
  document.getElementById('to-start-streaming').textContent = chrome.i18n.getMessage('toStartStreaming');
  document.getElementById('download-client').textContent = chrome.i18n.getMessage('downloadLatestClient') || 'Download the latest local client (GitHub Releases)';
  document.getElementById('open-client').textContent = chrome.i18n.getMessage('openLocalClientApp');
  document.getElementById('step-2').textContent = chrome.i18n.getMessage('goToMusicService') || chrome.i18n.getMessage('goToYouTubeMusic');
  document.getElementById('step-3').textContent = chrome.i18n.getMessage('clickDiscordButton');
  const updateButton = document.getElementById('update-extension');
  updateButton.textContent = chrome.i18n.getMessage('updateExtensionButton') || 'Update extension';
  updateButton.dataset.url = extensionDownloadUrl;
}

function compareVersions(a = '', b = '') {
  const sanitize = (value) => (typeof value === 'string' ? value.trim() : '');
  const parse = (value) =>
    sanitize(value)
      .split('.')
      .map((part) => (/^\d+$/.test(part) ? parseInt(part, 10) : 0));

  const partsA = parse(a);
  const partsB = parse(b);
  const maxLength = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLength; i += 1) {
    const valueA = partsA[i] ?? 0;
    const valueB = partsB[i] ?? 0;
    if (valueA < valueB) return -1;
    if (valueA > valueB) return 1;
  }

  return 0;
}

// Check connection status
async function checkConnection() {
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');

  try {
    const response = await chrome.runtime.sendMessage({ action: 'checkLocalClientConnection' });
    if (response && response.connected) {
      statusIndicator.classList.add('connected');
      statusText.textContent = chrome.i18n.getMessage('localClientConnected');
      return;
    }

    statusIndicator.classList.remove('connected');
    if (response && response.checking) {
      statusText.textContent = chrome.i18n.getMessage('checkingConnection');
      return;
    }
    statusText.textContent = chrome.i18n.getMessage('localClientNotRunning');
    if (response && response.error) {
      console.warn('Local client connection error:', response.error);
    }
  } catch (error) {
    statusIndicator.classList.remove('connected');
    statusText.textContent = chrome.i18n.getMessage('localClientNotRunning');

    if (error && error.message) {
      console.error('Failed to determine local client status:', error);
    }
  }
}

async function checkForUpdates() {
  const banner = document.getElementById('update-banner');
  const title = document.getElementById('update-title');
  const description = document.getElementById('update-description');
  const notes = document.getElementById('update-notes');
  const updateButton = document.getElementById('update-extension');

  try {
    const response = await fetch(VERSION_API_URL, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Version endpoint returned ${response.status}`);
    }

    const payload = await response.json();
    const manifest = chrome.runtime.getManifest();
    const currentExtensionVersion = manifest?.version || '0.0.0';

    const extensionInfo = payload?.chromeExtension || {};
    const goClientInfo = payload?.goClient || {};

    if (typeof goClientInfo.downloadUrl === 'string' && goClientInfo.downloadUrl.trim().length > 0) {
      goClientDownloadUrl = goClientInfo.downloadUrl.trim();
    }

    if (typeof goClientInfo.latestVersion === 'string' && goClientInfo.latestVersion.trim().length > 0) {
      const baseLabel = chrome.i18n.getMessage('downloadLatestClient') || 'Download the latest local client (GitHub Releases)';
      document.getElementById('download-client').textContent = `${baseLabel} · v${goClientInfo.latestVersion.trim()}`;
    }

    const latestExtensionVersion = (extensionInfo.latestVersion || '').trim() || currentExtensionVersion;
    const minimumExtensionVersion = (extensionInfo.minimumVersion || '').trim() || latestExtensionVersion;

    const requiresUpdate = compareVersions(currentExtensionVersion, minimumExtensionVersion) < 0;
    const recommendsUpdate = compareVersions(currentExtensionVersion, latestExtensionVersion) < 0;

    if (requiresUpdate || recommendsUpdate) {
      if (typeof extensionInfo.downloadUrl === 'string' && extensionInfo.downloadUrl.trim().length > 0) {
        extensionDownloadUrl = extensionInfo.downloadUrl.trim();
      }

      const releaseNotes = (extensionInfo.releaseNotes || '').trim();
      const isForced = requiresUpdate;

      const forcedTitle = chrome.i18n.getMessage('extensionUpdateRequired') || 'Update required';
      const optionalTitle = chrome.i18n.getMessage('extensionUpdateAvailable') || 'Update available';

      const forcedDescriptionTemplate = chrome.i18n.getMessage('extensionUpdateRequiredDescription')
        || 'Extension v%CURRENT_VERSION% is no longer supported. Please update to v%LATEST_VERSION% to continue streaming.';
      const optionalDescriptionTemplate = chrome.i18n.getMessage('extensionUpdateAvailableDescription')
        || 'A newer extension version (v%LATEST_VERSION%) is available. You are running v%CURRENT_VERSION%.';

      const applyPlaceholders = (template) => template
        .replace(/%CURRENT_VERSION%/g, currentExtensionVersion)
        .replace(/%LATEST_VERSION%/g, latestExtensionVersion);

      title.textContent = isForced ? forcedTitle : optionalTitle;
      description.textContent = applyPlaceholders(isForced ? forcedDescriptionTemplate : optionalDescriptionTemplate);

      if (releaseNotes) {
        notes.style.display = 'block';
        notes.textContent = releaseNotes;
      } else {
        notes.style.display = 'none';
      }

      updateButton.dataset.url = extensionDownloadUrl;
      banner.classList.remove('hidden');
    } else {
      updateButton.dataset.url = extensionDownloadUrl;
      banner.classList.add('hidden');
    }
  } catch (error) {
    console.warn('Failed to perform version check:', error);
  }
}

// Download latest client link
document.getElementById('download-client').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: goClientDownloadUrl || DEFAULT_GO_CLIENT_DOWNLOAD_URL });
});

document.getElementById('update-extension').addEventListener('click', (e) => {
  e.preventDefault();
  const targetUrl = e.currentTarget.dataset.url || extensionDownloadUrl || DEFAULT_EXTENSION_DOWNLOAD_URL;
  chrome.tabs.create({ url: targetUrl });
});

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
checkForUpdates();

// Recheck every 2 seconds
setInterval(checkConnection, 2000);
