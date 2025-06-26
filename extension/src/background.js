// Connection state
let ws = null;
let isStreaming = false;
let offscreenDocument = null;

// Create offscreen document if needed
async function createOffscreenDocument() {
  try {
    if (await chrome.offscreen.hasDocument()) {
      await chrome.offscreen.closeDocument();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (error) {
    // Document doesn't exist, continue
  }
  
  await chrome.offscreen.createDocument({
    url: 'src/offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Capturing audio from tab'
  });
}

// Connect to local client
function connectToLocalClient() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    ws = new WebSocket('ws://localhost:8765');
    
    ws.onopen = () => {
      resolve();
    };
    
    ws.onerror = (error) => {
      reject(new Error('Failed to connect to local client'));
    };
    
    ws.onclose = () => {
      ws = null;
      if (isStreaming) {
        stopCapture();
      }
    };
  });
}

// Start audio capture
async function startCapture(tabId) {
  try {
    if (isStreaming) {
      await stopCapture();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Connect to local client first
    await connectToLocalClient();
    
    // Create offscreen document
    await createOffscreenDocument();
    
    // Get media stream ID for the tab
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tabId,
      consumerTabId: null // Important: null means offscreen document
    });
    
    // Send streamId to offscreen document
    const response = await sendMessageToOffscreen({
      action: 'startCapture',
      streamId: streamId
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to start capture');
    }
    
    isStreaming = true;
    
    
    chrome.tabs.sendMessage(tabId, {
      action: 'streamingStateChanged',
      isStreaming: true
    });
    
    return true;
  } catch (error) {
    stopCapture();
    throw error;
  }
}

async function sendMessageToOffscreen(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!response) {
        reject(new Error('No response from offscreen document'));
      } else {
        resolve(response);
      }
    });
    
    setTimeout(() => {
      reject(new Error('Timeout waiting for offscreen response'));
    }, 5000);
  });
}

// Stop audio capture
async function stopCapture() {
  try {
    // Send message to offscreen document to stop capture
    if (await chrome.offscreen.hasDocument()) {
      await sendMessageToOffscreen({
        action: 'stopCapture'
      });
      
      // Close the offscreen document after stopping
      await chrome.offscreen.closeDocument();
    }
  } catch (error) {
    // Error stopping capture, continue cleanup
  }
  
  isStreaming = false;
  
  
  // Notify all YouTube Music tabs
  const tabs = await chrome.tabs.query({ url: "https://music.youtube.com/*" });
  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'streamingStateChanged',
      isStreaming: false
    });
  }
}

// Unified message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'audioData') {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'audio',
        audio: request.audio
      }));
    }
    return false;
  }
  
  // Handle other messages
  switch (request.action) {
    case 'startStream':
      sendResponse({ 
        success: false, 
        error: 'Please use the extension popup to start streaming (click the extension icon)' 
      });
      return true;
      
    case 'startStreamFromPopup':
      startCapture(request.tabId)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'stopStream':
      stopCapture()
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'getStreamStatus':
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'status' }));
      }
      sendResponse({ isStreaming });
      return true;
      
    default:
      sendResponse({ 
        success: false, 
        error: 'Unknown action' 
      });
      return true;
  }
});

// Handle tab close
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (isStreaming) {
    chrome.tabs.query({ url: "https://music.youtube.com/*" }, (tabs) => {
      if (tabs.length === 0) {
        stopCapture();
      }
    });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  // Extension installed
});