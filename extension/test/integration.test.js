const fs = require('fs');
const path = require('path');

const VERSION = fs.readFileSync(path.resolve(__dirname, '../../VERSION.txt'), 'utf8').trim();

const createBackground = require('../src/background-core');

const READY_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
};

function createMockWebSocket() {
  const socket = {
    readyState: READY_STATE.CONNECTING,
    send: jest.fn(),
    close: jest.fn(function () {
      socket.readyState = READY_STATE.CLOSED;
      if (socket.onclose) socket.onclose();
    }),
  };
  setTimeout(() => {
    socket.readyState = READY_STATE.OPEN;
    if (socket.onopen) socket.onopen();
  }, 0);
  return socket;
}

function createIntegrationAdapter() {
  const messageListeners = [];
  const tabRemovedListeners = [];

  const adapter = {
    createWebSocket: jest.fn(() => createMockWebSocket()),
    offscreen: {
      hasDocument: jest.fn().mockResolvedValue(false),
      createDocument: jest.fn(async () => {
        setTimeout(() => {
          messageListeners.forEach((handler) => handler({ action: 'offscreenReady' }, {}, jest.fn()));
        }, 0);
        return undefined;
      }),
      closeDocument: jest.fn().mockResolvedValue(undefined),
    },
    tabCapture: {
      getMediaStreamId: jest.fn().mockResolvedValue('stream-id'),
    },
    runtime: {
      id: 'test-extension-id',
		getManifest: jest.fn(() => ({ version: VERSION })),
      getURL: jest.fn((path) => path),
      sendMessage: jest.fn((message) => {
        if (message?.action === 'startCapture') {
          return Promise.resolve({ success: true });
        }
        if (message?.action === 'stopCapture') {
          return Promise.resolve({ success: true });
        }
        return Promise.resolve({ success: true });
      }),
      addMessageListener: jest.fn((handler) => messageListeners.push(handler)),
      addInstalledListener: jest.fn(),
      addStartupListener: jest.fn(),
      addSuspendListener: jest.fn(),
    },
    tabs: {
      query: jest.fn().mockResolvedValue([]),
      sendMessage: jest.fn().mockResolvedValue(undefined),
      addRemovedListener: jest.fn((handler) => tabRemovedListeners.push(handler)),
    },
    notifications: {
      create: jest.fn().mockResolvedValue(undefined),
    },
    storage: null,
    __listeners: {
      messageListeners,
      tabRemovedListeners,
    },
  };

  return adapter;
}

describe('background-core integration', () => {
  let adapter;
  let background;

  beforeEach(() => {
    adapter = createIntegrationAdapter();
    background = createBackground(adapter);
    background.registerEventListeners();
  });

  async function flushAsync() {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  test('handles rapid multiple start requests gracefully', async () => {
    const tabId = 10;
    const starts = Array.from({ length: 5 }, () => background.startCapture(tabId));
    await Promise.all(starts);
    await flushAsync();

    expect(adapter.offscreen.createDocument).toHaveBeenCalledTimes(1);
    expect(adapter.runtime.sendMessage).toHaveBeenCalledWith({ action: 'startCapture', streamId: 'stream-id' });
  });

  test('message handler forwards audio data and pause/resume events', async () => {
    const tabId = 20;
    await background.startCapture(tabId);
    await flushAsync();

    const handler = adapter.__listeners.messageListeners[0];
    const socket = adapter.createWebSocket.mock.results[0].value;
    const offscreenSender = { id: 'test-extension-id', url: 'chrome-extension://test/offscreen.html' };

    handler({ type: 'audioData', audio: 'payload' }, offscreenSender, jest.fn());
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'audio', audio: 'payload' }));

    handler({ type: 'streamPause' }, offscreenSender, jest.fn());
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'streamPause' }));

    handler({ type: 'streamResume' }, offscreenSender, jest.fn());
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'streamResume' }));
  });

  test('stopCapture cleans up even when offscreen stop fails', async () => {
    const tabId = 30;
    adapter.offscreen.hasDocument
      .mockReset()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    adapter.runtime.sendMessage.mockImplementation((message) => {
      if (message?.action === 'stopCapture') {
        return Promise.reject(new Error('offscreen unavailable'));
      }
      return Promise.resolve({ success: true });
    });

    await background.startCapture(tabId);
    await flushAsync();

    await expect(background.stopCapture()).resolves.toBeUndefined();
    expect(adapter.offscreen.closeDocument).toHaveBeenCalled();
  });

  test('resumeFromSavedState attempts restart and falls back on failure', async () => {
    // Provide simple in-memory session storage
    const state = { value: { tabId: 40 } };
    adapter.storage = {
      session: {
        get: jest.fn(async (key) => (key === 'trunecordStreamingState' ? state.value : null)),
        set: jest.fn(async (key, value) => {
          if (key === 'trunecordStreamingState') {
            state.value = value;
          }
        }),
        remove: jest.fn(async () => {
          state.value = null;
        }),
      },
    };

    background = createBackground(adapter);

    // Successful resume
    await background.resumeFromSavedState();
    await flushAsync();
    expect(adapter.runtime.sendMessage).toHaveBeenCalledWith({ action: 'startCapture', streamId: 'stream-id' });

    // Simulate failure next time
    adapter.offscreen.hasDocument
      .mockReset()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    await background.stopCapture();
    adapter.runtime.sendMessage.mockImplementationOnce(() => Promise.resolve({ success: false, error: 'denied' }));
    state.value = { tabId: 40 };
    const result = await background.resumeFromSavedState();
    expect(result.restored).toBe(false);
    expect(adapter.notifications.create).toHaveBeenCalled();
  });

  describe('local client connection status runtime message', () => {
    let handler;

    beforeEach(() => {
      background.registerEventListeners();
      handler = adapter.__listeners.messageListeners[0];
    });

    test('returns connected true when WebSocket opens', async () => {
      const sendResponse = jest.fn();
      const keepChannelOpen = handler({ action: 'checkLocalClientConnection' }, {}, sendResponse);

      expect(keepChannelOpen).toBe(true);
      for (let i = 0; i < 6; i += 1) {
        await flushAsync();
      }
      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ connected: true, checking: false }));
    });

    test('returns connected false when WebSocket connection fails', async () => {
      adapter.createWebSocket.mockImplementation(() => {
        throw new Error('connection refused');
      });

      const sendResponse = jest.fn();
      const keepChannelOpen = handler({ action: 'checkLocalClientConnection' }, {}, sendResponse);

      expect(keepChannelOpen).toBe(true);
      for (let i = 0; i < 6; i += 1) {
        await flushAsync();
      }
      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ connected: false, checking: false }));
    });

    // Additional connection edge cases are covered by explicit error handling tests above.
  });
});
