(function (global) {
  if (global.__TRUNECORD_BACKGROUND_CORE__) {
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = global.__TRUNECORD_BACKGROUND_CORE__;
    }
    return;
  }

  let createStateManager;
  if (typeof require === 'function') {
    ({ createStateManager } = require('./state-manager'));
  } else if (global.createStateManager) {
    createStateManager = global.createStateManager;
  } else {
    throw new Error('createStateManager is not available');
  }

  const READY_STATE_CONNECTING = 0;
  const READY_STATE_OPEN = 1;
  const READY_STATE_CLOSED = 3;
  const LOCAL_CLIENT_WEBSOCKET_URLS = ['ws://127.0.0.1:8765', 'ws://localhost:8765', 'ws://[::1]:8765'];
  const CONNECTION_CHECK_INTERVAL_MS = 2000;
  const CONNECTION_TIMEOUT_MS = 3000;
  const OFFSCREEN_MESSAGE_MAX_RETRIES = 5;
  const OFFSCREEN_MESSAGE_RETRY_DELAY_MS = 200;
  const OFFSCREEN_READY_TIMEOUT_MS = 2000;
  const CONNECTION_FAILURE_THRESHOLD = 3;

  function createBackground(adapter) {
    const stateManager = createStateManager(adapter.storage);

    let ws = null;
    let isStreaming = false;
    let isCreatingOffscreen = false;
    let capturePromise = null;
    let connectionCheckInterval = null;
    let currentStreamingTabId = null;
    let connectionPromise = null;
    let connectionState = 'disconnected';
    let lastConnectionError = null;
    let isOffscreenReady = false;
    let offscreenReadyResolvers = [];
    let offscreenReadyFallbackTimer = null;
    let connectionFailureCount = 0;

    function log(...args) {
      console.log('[trunecord]', ...args);
    }

    function setConnectionState(state) {
      if (connectionState !== state) {
        connectionState = state;
        log(`Local client connection state: ${state}`);
      }
    }

    function setLastConnectionError(message) {
      lastConnectionError = message || null;
    }

    async function createOffscreenDocument() {
      if (isCreatingOffscreen) {
        log('Offscreen document creation already in progress');
        return;
      }

      isCreatingOffscreen = true;

      try {
        resetOffscreenReady();
        if (await adapter.offscreen.hasDocument()) {
          await adapter.offscreen.closeDocument();
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        // ignore: no existing document
      }

      try {
        await adapter.offscreen.createDocument({
          url: 'src/offscreen.html',
          reasons: ['USER_MEDIA'],
          justification: 'Capturing audio from tab',
        });
        await waitForOffscreenReady();
        log('Offscreen document created successfully');
      } finally {
        isCreatingOffscreen = false;
      }
    }

    function clearConnectionCheck() {
      if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
        connectionCheckInterval = null;
      }
    }

    function startConnectionCheck() {
      clearConnectionCheck();

    connectionCheckInterval = setInterval(() => {
      if (ws && ws.readyState === READY_STATE_OPEN) {
        connectionFailureCount = 0;
        try {
          ws.send(JSON.stringify({ type: 'ping' }));
        } catch (error) {
          console.error('Failed to send ping:', error);
        }
      } else if (ws && ws.readyState === READY_STATE_CONNECTING) {
        connectionFailureCount = 0;
      } else if (isStreaming) {
        connectionFailureCount += 1;
        if (connectionFailureCount >= CONNECTION_FAILURE_THRESHOLD) {
          log('Connection check failed repeatedly, stopping capture');
          stopCapture()
            .catch((error) => console.error('Failed to stop after connection failure:', error));
          connectionFailureCount = 0;
        }
      }
    }, CONNECTION_CHECK_INTERVAL_MS);
    }

    function teardownWebSocket(options = {}) {
      const { skipClose = false } = options;
      if (ws) {
        try {
          if (!skipClose) {
            ws.close();
          }
        } catch (error) {
          console.error('Error closing WebSocket:', error);
        }
        ws = null;
      }
      setConnectionState('disconnected');
      clearConnectionCheck();
    }

    async function connectToLocalClient() {
      if (ws && ws.readyState === READY_STATE_OPEN) {
        setConnectionState('connected');
        setLastConnectionError(null);
        return ws;
      }

      if (connectionPromise) {
        return connectionPromise;
      }

      teardownWebSocket();

      const attemptConnection = (url) =>
        new Promise((resolve, reject) => {
          let settled = false;
          setConnectionState('connecting');
          setLastConnectionError(null);

          try {
            ws = adapter.createWebSocket(url);
          } catch (error) {
            console.error(`Failed to create WebSocket for ${url}:`, error);
            setConnectionState('disconnected');
            setLastConnectionError(error?.message || 'Failed to connect to local client');
            reject(error);
            return;
          }

          const timeoutId = setTimeout(() => {
            if (!settled) {
              settled = true;
              console.error(`WebSocket connection to ${url} timed out`);
              setConnectionState('disconnected');
              setLastConnectionError('Connection attempt timed out');
              teardownWebSocket({ skipClose: true });
              reject(new Error('Failed to connect to local client'));
            }
          }, CONNECTION_TIMEOUT_MS);

      ws.onopen = () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutId);
        log(`WebSocket connected to local client via ${url}`);
        setConnectionState('connected');
        setLastConnectionError(null);
        connectionFailureCount = 0;
        startConnectionCheck();
        resolve(ws);
      };

          ws.onerror = (error) => {
            if (settled) {
              return;
            }
            settled = true;
            clearTimeout(timeoutId);
            console.error(`WebSocket error for ${url}:`, error);
            setConnectionState('disconnected');
            setLastConnectionError(error?.message || 'Failed to connect to local client');
            teardownWebSocket({ skipClose: true });
            reject(new Error('Failed to connect to local client'));
          };

      ws.onclose = () => {
        clearTimeout(timeoutId);
        log(`WebSocket disconnected from local client (url: ${url})`);
        const wasSettled = settled;
        settled = true;
        setConnectionState('disconnected');
        connectionFailureCount += 1;
        if (!wasSettled) {
          setLastConnectionError('Connection closed');
          teardownWebSocket({ skipClose: true });
          reject(new Error('Failed to connect to local client'));
          return;
            }
            setLastConnectionError('Connection lost');
            teardownWebSocket({ skipClose: true });
            if (isStreaming) {
              log('Connection lost during streaming, stopping capture');
              stopCapture()
                .then(() => notifyConnectionLost())
                .catch((error) => console.error('Failed to stop capture after disconnect:', error));
            }
          };

          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              handleWebSocketMessage(data);
            } catch (error) {
              // Ignore malformed messages
            }
          };
        });

      connectionPromise = (async () => {
        let lastError = null;
        for (const url of LOCAL_CLIENT_WEBSOCKET_URLS) {
          try {
            return await attemptConnection(url);
          } catch (error) {
            lastError = error;
            console.warn(`WebSocket connection attempt failed for ${url}:`, error?.message || error);
          }
        }
        throw lastError || new Error('Failed to connect to local client');
      })().finally(() => {
        connectionPromise = null;
      });

      return connectionPromise;
    }

    async function getLocalClientConnectionStatus() {
      try {
        if ((!ws || ws.readyState === READY_STATE_CLOSED) && !connectionPromise && !isStreaming) {
          await connectToLocalClient();
        }
      } catch (error) {
        // Connection attempt failed; state and error already recorded
      }

      const readyState = ws?.readyState ?? READY_STATE_CLOSED;
      const connected = readyState === READY_STATE_OPEN;
      const checking = connectionState === 'connecting';
      return {
        connected,
        checking,
        error: connected ? null : lastConnectionError,
      };
    }

    async function sendMessageToOffscreenOnce(message) {
      let timer;
      return new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error('Timeout waiting for offscreen response'));
        }, 5000);

        adapter.runtime
          .sendMessage(message)
          .then((response) => {
            clearTimeout(timer);
            if (!response) {
              reject(new Error('No response from offscreen document'));
              return;
            }
            resolve(response);
          })
          .catch((error) => {
            clearTimeout(timer);
            reject(error);
          });
      });
    }

    async function sendMessageToOffscreen(message, attempt = 0) {
      try {
        return await sendMessageToOffscreenOnce(message);
      } catch (error) {
        const shouldRetry =
          attempt + 1 < OFFSCREEN_MESSAGE_MAX_RETRIES &&
          typeof error?.message === 'string' &&
          error.message.includes('Receiving end does not exist');

        if (shouldRetry) {
          const delay = OFFSCREEN_MESSAGE_RETRY_DELAY_MS * Math.pow(2, attempt);
          console.warn(
            `Retrying offscreen message (attempt ${attempt + 1}/${OFFSCREEN_MESSAGE_MAX_RETRIES}) after error:`,
            error?.message || error
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          return sendMessageToOffscreen(message, attempt + 1);
        }

        throw error;
      }
    }

    function resetOffscreenReady() {
      isOffscreenReady = false;
      offscreenReadyResolvers = [];
      if (offscreenReadyFallbackTimer) {
        clearTimeout(offscreenReadyFallbackTimer);
        offscreenReadyFallbackTimer = null;
      }
    }

    function markOffscreenReady() {
      isOffscreenReady = true;
      if (offscreenReadyFallbackTimer) {
        clearTimeout(offscreenReadyFallbackTimer);
        offscreenReadyFallbackTimer = null;
      }
      offscreenReadyResolvers.forEach((resolve) => resolve());
      offscreenReadyResolvers = [];
    }

    function waitForOffscreenReady() {
      if (isOffscreenReady) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        offscreenReadyResolvers.push(resolve);
        if (!offscreenReadyFallbackTimer) {
          offscreenReadyFallbackTimer = setTimeout(() => {
            offscreenReadyFallbackTimer = null;
            markOffscreenReady();
          }, OFFSCREEN_READY_TIMEOUT_MS);
        }
      });
    }

    async function startCapture(tabId) {
      if (capturePromise) {
        log('Capture already in progress, waiting for completion');
        return capturePromise;
      }

      capturePromise = (async () => {
        if (isStreaming) {
          log('Stopping existing capture first');
          await stopCapture();
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        const socket = await connectToLocalClient();
        await createOffscreenDocument();
        await new Promise((resolve) => setTimeout(resolve, 100));

        const streamId = await adapter.tabCapture.getMediaStreamId({
          targetTabId: tabId,
          consumerTabId: null,
        });

        const response = await sendMessageToOffscreen({
          action: 'startCapture',
          streamId,
        });

        if (!response.success) {
          throw new Error(response.error || 'Failed to start capture');
        }

        isStreaming = true;
        currentStreamingTabId = tabId;
        await stateManager.save(tabId);

        if (socket && socket.readyState === READY_STATE_OPEN) {
          socket.send(JSON.stringify({ type: 'streamStart' }));
        }

        try {
          await adapter.tabs.sendMessage(tabId, {
            action: 'streamingStateChanged',
            isStreaming: true,
          });
        } catch (error) {
          console.warn('Failed to notify tab about streaming state change:', error?.message || error);
        }

        return true;
      })();

      try {
        return await capturePromise;
      } catch (error) {
        await stopCapture();
        throw error;
      } finally {
        capturePromise = null;
      }
    }

    async function stopCapture() {
      if (!isStreaming) {
        log('Not currently streaming, nothing to stop');
        return;
      }

      isStreaming = false;
      connectionFailureCount = 0;

      try {
        if (await adapter.offscreen.hasDocument()) {
          try {
            await sendMessageToOffscreen({ action: 'stopCapture' });
          } catch (error) {
            console.error('Failed to notify offscreen document to stop:', error);
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
          await adapter.offscreen.closeDocument();
        }
      } catch (error) {
        console.error('Error stopping capture:', error);
      }
      resetOffscreenReady();

      const socket = ws;
      if (socket && socket.readyState === READY_STATE_OPEN) {
        try {
          socket.send(JSON.stringify({ type: 'streamStop' }));
        } catch (error) {
          console.error('Failed to send streamStop:', error);
        }
      }

      await broadcastToMusicTabs(
        {
          action: 'streamingStateChanged',
          isStreaming: false,
        },
        'Error notifying tabs about streaming state change'
      );

      currentStreamingTabId = null;
      await stateManager.clear();
    }

    async function broadcastToMusicTabs(message, errorMessage = 'Error broadcasting to tabs') {
      try {
        const tabs = await adapter.tabs.query({ url: 'https://music.youtube.com/*' });
        await Promise.all(
          tabs.map((tab) =>
            adapter.tabs
              .sendMessage(tab.id, message)
              .catch(() => {})
          )
        );
      } catch (error) {
        console.error(`${errorMessage}:`, error);
      }
    }

    function getExtensionId() {
      if (adapter?.runtime && typeof adapter.runtime.id === 'string' && adapter.runtime.id.length > 0) {
        return adapter.runtime.id;
      }
      if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.id === 'string' && chrome.runtime.id.length > 0) {
        return chrome.runtime.id;
      }
      return null;
    }

    function isTrustedStreamSender(sender) {
      if (!sender) {
        return false;
      }

      const extensionId = getExtensionId();
      if (extensionId) {
        if (sender.id && sender.id !== extensionId) {
          return false;
        }
        if (sender.id === extensionId) {
          return true;
        }
      }

      if (sender.tab && typeof sender.tab.url === 'string' && sender.tab.url.startsWith('https://music.youtube.com/')) {
        return true;
      }

      return false;
    }

    function handleWebSocketMessage(data) {
      switch (data.type) {
        case 'handshake': {
          const manifest = adapter.runtime.getManifest();
          const version = manifest?.version || '0.0.0';
          try {
            ws?.send(
              JSON.stringify({
                type: 'handshake',
                version,
              })
            );
          } catch (error) {
            console.error('Failed to send handshake:', error);
          }
          break;
        }
        case 'versionMismatch': {
          console.warn('Version mismatch:', data.message);
          adapter.notifications.create('trunecord-version-mismatch', {
            type: 'basic',
            iconUrl: adapter.runtime.getURL ? adapter.runtime.getURL('icons/icon.svg') : '',
            title: 'trunecord - Version mismatch',
            message: data.message,
            priority: 2,
          });
          break;
        }
        case 'waitingModeStop': {
          log('Received waiting mode stop signal');
          stopCapture()
            .then(() => notifyWaitingModeStop())
            .catch((error) => console.error('Failed to stop after waiting mode:', error));
          break;
        }
        default:
          break;
      }
    }

    async function notifyConnectionLost() {
      await broadcastToMusicTabs(
        {
          action: 'connectionLost',
          isStreaming: false,
        },
        'Error notifying tabs about connection loss'
      );
    }

    async function notifyWaitingModeStop() {
      await broadcastToMusicTabs(
        {
          action: 'waitingModeStop',
          isStreaming: false,
        },
        'Error notifying tabs about waiting mode stop'
      );
    }

    function handleRuntimeMessage(request, sender, sendResponse) {
      switch (request.action) {
        case 'startStream':
          sendResponse({
            success: false,
            error: 'Please use the extension popup to start streaming (click the extension icon)',
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
        case 'offscreenReady':
          markOffscreenReady();
          sendResponse({ success: true });
          return true;
        case 'checkLocalClientConnection':
          getLocalClientConnectionStatus()
            .then((status) => sendResponse(status))
            .catch((error) => sendResponse({ connected: false, checking: false, error: error.message }));
          return true;
        case 'getStreamStatus':
          sendResponse({ isStreaming });
          return true;
        default: {
          if (typeof request.type === 'string') {
            if (!isTrustedStreamSender(sender)) {
              console.warn('Ignoring message from untrusted sender');
              return false;
            }

            if (request.type === 'audioData') {
              if (ws && ws.readyState === READY_STATE_OPEN) {
                try {
                  ws.send(
                    JSON.stringify({
                      type: 'audio',
                      audio: request.audio,
                    })
                  );
                } catch (error) {
                  console.error('Failed to forward audio chunk:', error);
                }
              }
              return false;
            }
            if (request.type === 'streamPause') {
              if (ws && ws.readyState === READY_STATE_OPEN) {
                ws.send(JSON.stringify({ type: 'streamPause' }));
              }
              return false;
            }
            if (request.type === 'streamResume') {
              if (ws && ws.readyState === READY_STATE_OPEN) {
                ws.send(JSON.stringify({ type: 'streamResume' }));
              }
              return false;
            }
          }
          sendResponse({ success: false, error: 'Unknown action' });
          return true;
        }
      }
    }

    function handleTabRemoved(tabId) {
      if (!isStreaming || tabId !== currentStreamingTabId) {
        return;
      }
      stopCapture().catch((error) => console.error('Failed to stop after tab removal:', error));
    }

    async function resumeFromSavedState() {
      const tabId = await stateManager.restore();
      if (tabId == null) {
        return { restored: false };
      }

      try {
        await startCapture(tabId);
        return { restored: true, tabId };
      } catch (error) {
        console.error('Auto-resume failed:', error);
        await stateManager.clear();
        adapter.notifications.create('trunecord-resume-failed', {
          type: 'basic',
          iconUrl: adapter.runtime.getURL ? adapter.runtime.getURL('icons/icon.svg') : '',
          title: 'trunecord - Resume failed',
          message: 'Please reopen the popup to restart streaming.',
          priority: 1,
        });
        return { restored: false, error };
      }
    }

    function registerEventListeners() {
      adapter.runtime.addMessageListener(handleRuntimeMessage);
      adapter.tabs.addRemovedListener(handleTabRemoved);
      adapter.runtime.addInstalledListener(() => {
        resumeFromSavedState().catch(() => {});
      });
      adapter.runtime.addStartupListener(() => {
        resumeFromSavedState().catch(() => {});
      });
      adapter.runtime.addSuspendListener(() => {
        if (currentStreamingTabId != null) {
          stateManager.save(currentStreamingTabId).catch((error) =>
            console.error('Failed to persist state on suspend:', error)
          );
        }
        teardownWebSocket();
      });
    }

    return {
      startCapture,
      stopCapture,
      connectToLocalClient,
      registerEventListeners,
      resumeFromSavedState,
      _internal: {
        get isStreaming() {
          return isStreaming;
        },
        get currentStreamingTabId() {
          return currentStreamingTabId;
        },
      },
    };
  }

  global.__TRUNECORD_BACKGROUND_CORE__ = createBackground;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createBackground;
  } else {
    global.createBackground = createBackground;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
