const createBackground = require('../src/background-core');

const READY_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
};

function createMockWebSocketFactory() {
  const sockets = [];
  const factory = jest.fn((url) => {
    const socket = {
      url,
      readyState: READY_STATE.CONNECTING,
      send: jest.fn(),
      close: jest.fn(() => {
        socket.readyState = READY_STATE.CLOSED;
        if (socket.onclose) socket.onclose();
      }),
    };
    sockets.push(socket);
    setTimeout(() => {
      socket.readyState = READY_STATE.OPEN;
      if (socket.onopen) socket.onopen();
    }, 0);
    return socket;
  });
  factory.getLast = () => sockets[sockets.length - 1] || null;
  return factory;
}

function createMockAdapter() {
  const messageListeners = [];
  const tabRemovedListeners = [];
  const installedListeners = [];
  const startupListeners = [];
  const suspendListeners = [];

  const createWebSocket = createMockWebSocketFactory();

  const adapter = {
    createWebSocket,
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
      getMediaStreamId: jest.fn().mockImplementation(({ targetTabId }) => Promise.resolve(`stream-${targetTabId}`)),
    },
    runtime: {
      id: 'test-extension-id',
		getManifest: jest.fn(() => ({ version: '1.3.4' })),
      getURL: jest.fn((path) => path),
      sendMessage: jest.fn(() => Promise.resolve({ success: true })),
      addMessageListener: jest.fn((handler) => messageListeners.push(handler)),
      addInstalledListener: jest.fn((handler) => installedListeners.push(handler)),
      addStartupListener: jest.fn((handler) => startupListeners.push(handler)),
      addSuspendListener: jest.fn((handler) => suspendListeners.push(handler)),
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
      installedListeners,
      startupListeners,
      suspendListeners,
    },
  };

  return adapter;
}

describe('background-core', () => {
  let adapter;
  let background;

  beforeEach(() => {
    adapter = createMockAdapter();
    background = createBackground(adapter);
  });

  async function flushAsync() {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  test('startCapture creates offscreen document and sends streamStart', async () => {
    const tabId = 123;

    await background.startCapture(tabId);
    await flushAsync();

    expect(adapter.offscreen.createDocument).toHaveBeenCalledTimes(1);
    expect(adapter.tabCapture.getMediaStreamId).toHaveBeenCalledWith({ targetTabId: tabId, consumerTabId: null });
    const socket = adapter.createWebSocket.getLast();
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'streamStart' }));
    expect(adapter.tabs.sendMessage).toHaveBeenCalledWith(tabId, { action: 'streamingStateChanged', isStreaming: true });
  });

  test('startCapture restarts capture when called twice sequentially', async () => {
    const tabId = 456;

    await background.startCapture(tabId);
    await flushAsync();

    adapter.runtime.sendMessage.mockResolvedValueOnce({ success: true });
    await background.startCapture(tabId);
    await flushAsync();

    expect(adapter.offscreen.createDocument).toHaveBeenCalledTimes(2);
  });

  test('stopCapture notifies tabs and clears state', async () => {
    const tabId = 789;
    adapter.tabs.query.mockResolvedValue([{ id: tabId }]);

    await background.startCapture(tabId);
    await flushAsync();

    adapter.offscreen.hasDocument.mockResolvedValueOnce(true);
    await background.stopCapture();
    expect(adapter.offscreen.closeDocument).toHaveBeenCalled();
    expect(adapter.tabs.sendMessage).toHaveBeenCalledWith(tabId, { action: 'streamingStateChanged', isStreaming: false });
  });

  test('startCapture propagates errors when offscreen creation fails', async () => {
    adapter.offscreen.createDocument.mockRejectedValueOnce(new Error('Creation failed'));

    await expect(background.startCapture(101)).rejects.toThrow('Creation failed');
  });

  test('registerEventListeners attaches runtime and tab listeners', () => {
    background.registerEventListeners();

    expect(adapter.runtime.addMessageListener).toHaveBeenCalled();
    expect(adapter.tabs.addRemovedListener).toHaveBeenCalled();
  });
});
