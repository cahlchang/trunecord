// Connection state
let ws = null;
let isStreaming = false;
let offscreenDocument = null;
let isCreatingOffscreen = false;
let capturePromise = null;
let reconnectInterval = null;
let connectionCheckInterval = null;

// Create offscreen document if needed
async function createOffscreenDocument() {
  // Prevent multiple simultaneous creation attempts
  if (isCreatingOffscreen) {
    console.log('Offscreen document creation already in progress');
    return;
  }
  
  isCreatingOffscreen = true;
  
  try {
    if (await chrome.offscreen.hasDocument()) {
      await chrome.offscreen.closeDocument();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (error) {
    // Document doesn't exist, continue
  }
  
  try {
    await chrome.offscreen.createDocument({
      url: 'src/offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Capturing audio from tab'
    });
    console.log('Offscreen document created successfully');
  } finally {
    isCreatingOffscreen = false;
  }
}

// Connect to local client
function connectToLocalClient() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    return Promise.resolve();
  }
  
  // Clear any existing intervals
  clearReconnectInterval();
  clearConnectionCheckInterval();
  
  return new Promise((resolve, reject) => {
    ws = new WebSocket('ws://localhost:8765');
    
    ws.onopen = () => {
      console.log('WebSocket connected to local client');
      startConnectionCheck();
      resolve();
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      reject(new Error('Failed to connect to local client'));
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected from local client');
      ws = null;
      clearConnectionCheckInterval();
      
      if (isStreaming) {
        console.log('Connection lost during streaming, stopping capture');
        stopCapture().then(() => {
          notifyConnectionLost();
        });
      }
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'pong') {
          // Response to our ping - connection is alive
        } else if (data.type === 'waitingModeStop') {
          // Stop streaming due to waiting mode (someone joined voice channel)
          console.log('Received waiting mode stop signal - stopping streaming and pausing YouTube Music');
          stopCapture().then(() => {
            notifyWaitingModeStop();
          });
        }
      } catch (e) {
        // Ignore parsing errors
      }
    };
  });
}

// Start audio capture
async function startCapture(tabId) {
  // If already capturing, return existing promise
  if (capturePromise) {
    console.log('Capture already in progress, waiting for completion');
    return capturePromise;
  }
  
  capturePromise = doStartCapture(tabId);
  
  // Clean up promise when done
  capturePromise.finally(() => {
    capturePromise = null;
  });
  
  return capturePromise;
}

async function doStartCapture(tabId) {
  try {
    if (isStreaming) {
      console.log('Stopping existing capture first');
      await stopCapture();
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Connect to local client first
    await connectToLocalClient();
    
    // Create offscreen document
    await createOffscreenDocument();
    
    // Wait a bit for offscreen document to be ready
    await new Promise(resolve => setTimeout(resolve, 100));
    
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
    
    // Notify local client about stream start
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'streamStart' }));
    }
    
    chrome.tabs.sendMessage(tabId, {
      action: 'streamingStateChanged',
      isStreaming: true
    });
    
    return true;
  } catch (error) {
    console.error('Capture error:', error);
    await stopCapture();
    throw error;
  }
}

async function sendMessageToOffscreen(message) {
  return new Promise((resolve, reject) => {
    let timeoutId;
    
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
    
    chrome.runtime.sendMessage(message, (response) => {
      cleanup();
      
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!response) {
        reject(new Error('No response from offscreen document'));
      } else {
        resolve(response);
      }
    });
    
    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Timeout waiting for offscreen response'));
    }, 5000);
  });
}

// Stop audio capture
async function stopCapture() {
  if (!isStreaming) {
    console.log('Not currently streaming, nothing to stop');
    return;
  }
  
  isStreaming = false;
  capturePromise = null;
  
  try {
    // Send message to offscreen document to stop capture
    if (await chrome.offscreen.hasDocument()) {
      try {
        await sendMessageToOffscreen({
          action: 'stopCapture'
        });
      } catch (e) {
        console.error('Error sending stop message to offscreen:', e);
      }
      
      // Close the offscreen document after stopping
      await new Promise(resolve => setTimeout(resolve, 100));
      await chrome.offscreen.closeDocument();
    }
  } catch (error) {
    console.error('Error stopping capture:', error);
  }
  
  // Notify local client about stream stop
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'streamStop' }));
  }
  
  // Notify all YouTube Music tabs
  try {
    const tabs = await chrome.tabs.query({ url: "https://music.youtube.com/*" });
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'streamingStateChanged',
        isStreaming: false
      }).catch(() => {
        // Tab might not be ready, ignore
      });
    }
  } catch (error) {
    console.error('Error notifying tabs:', error);
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
  
  if (request.type === 'streamPause') {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'streamPause' }));
    }
    return false;
  }
  
  if (request.type === 'streamResume') {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'streamResume' }));
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

// Connection monitoring functions
function startConnectionCheck() {
  clearConnectionCheckInterval();
  
  connectionCheckInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    } else if (isStreaming) {
      // Connection lost but still marked as streaming
      console.log('Connection check failed, stopping capture');
      stopCapture();
    }
  }, 5000); // Check every 5 seconds
}

function clearConnectionCheckInterval() {
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
    connectionCheckInterval = null;
  }
}

function clearReconnectInterval() {
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
    reconnectInterval = null;
  }
}

// Notify tabs about connection loss
async function notifyConnectionLost() {
  try {
    const tabs = await chrome.tabs.query({ url: "https://music.youtube.com/*" });
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'connectionLost',
        isStreaming: false
      }).catch(() => {
        // Tab might not be ready, ignore
      });
    }
  } catch (error) {
    console.error('Error notifying tabs about connection loss:', error);
  }
}

// Notify tabs about waiting mode stop
async function notifyWaitingModeStop() {
  try {
    const tabs = await chrome.tabs.query({ url: "https://music.youtube.com/*" });
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'waitingModeStop',
        isStreaming: false
      }).catch(() => {
        // Tab might not be ready, ignore
      });
    }
  } catch (error) {
    console.error('Error notifying tabs about waiting mode stop:', error);
  }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    startCapture,
    stopCapture,
    connectToLocalClient
  };
}