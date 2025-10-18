// Chrome API mock
global.chrome = {
  runtime: {
    id: 'mock-extension-id',
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    },
    lastError: null,
    getURL: jest.fn(path => `chrome-extension://mock-id/${path}`)
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  i18n: {
    getMessage: jest.fn((key) => {
      const messages = {
        'streaming': 'Discord',
        'stop': 'Stop',
        'normalPlayback': 'Normal',
        'audioSendingEnabled': 'Audio will be sent to Discord',
        'audioSendingDisabled': 'Audio will play normally',
        'failedToCommunicate': 'Failed to communicate',
        'failedToConnect': 'Failed to connect'
      };
      return messages[key] || key;
    })
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
    onRemoved: {
      addListener: jest.fn()
    }
  },
  offscreen: {
    createDocument: jest.fn(),
    closeDocument: jest.fn(),
    hasDocument: jest.fn()
  },
  tabCapture: {
    getMediaStreamId: jest.fn()
  }
};

// WebSocket mock
global.WebSocket = jest.fn().mockImplementation(() => {
  const ws = {
    readyState: 0, // CONNECTING
    OPEN: 1,
    CONNECTING: 0,
    send: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    onopen: null,
    onerror: null,
    onclose: null,
    onmessage: null
  };
  
  // Simulate connection
  setTimeout(() => {
    ws.readyState = 1; // OPEN
    if (ws.onopen) ws.onopen();
  }, 10);
  
  return ws;
});

// Add static properties
global.WebSocket.OPEN = 1;
global.WebSocket.CONNECTING = 0;
global.WebSocket.CLOSING = 2;
global.WebSocket.CLOSED = 3;
