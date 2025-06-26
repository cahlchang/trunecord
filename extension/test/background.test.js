// Mock Chrome APIs
const mockChrome = {
  offscreen: {
    hasDocument: jest.fn(),
    createDocument: jest.fn(),
    closeDocument: jest.fn()
  },
  tabCapture: {
    getMediaStreamId: jest.fn()
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
    onRemoved: {
      addListener: jest.fn()
    }
  },
  runtime: {
    onMessage: {
      addListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    },
    sendMessage: jest.fn(),
    lastError: null
  }
};

global.chrome = mockChrome;
global.WebSocket = jest.fn();

// Mock tabs.query to return empty array by default
mockChrome.tabs.query.mockResolvedValue([]);

// Import after mocking
const { startCapture, stopCapture, connectToLocalClient } = require('../src/background.js');

describe('Background Script', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset WebSocket mock
    global.WebSocket.mockImplementation(function(url) {
      this.readyState = WebSocket.CONNECTING;
      this.send = jest.fn();
      this.close = jest.fn();
      
      // Simulate connection after a delay
      setTimeout(() => {
        this.readyState = WebSocket.OPEN;
        if (this.onopen) this.onopen();
      }, 10);
      
      return this;
    });
    global.WebSocket.OPEN = 1;
    global.WebSocket.CONNECTING = 0;
  });

  describe('Offscreen Document Management', () => {
    test('should create offscreen document if not exists', async () => {
      mockChrome.offscreen.hasDocument.mockResolvedValue(false);
      mockChrome.offscreen.createDocument.mockResolvedValue(undefined);
      mockChrome.tabCapture.getMediaStreamId.mockImplementation(({ targetTabId }) => 
        Promise.resolve(`stream-${targetTabId}`)
      );
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: true });
      });

      await startCapture(123);

      expect(mockChrome.offscreen.hasDocument).toHaveBeenCalled();
      expect(mockChrome.offscreen.createDocument).toHaveBeenCalledWith({
        url: 'src/offscreen.html',
        reasons: ['USER_MEDIA'],
        justification: 'Capturing audio from tab'
      });
    });

    test('should close existing offscreen document before creating new one', async () => {
      mockChrome.offscreen.hasDocument.mockResolvedValue(true);
      mockChrome.offscreen.closeDocument.mockResolvedValue(undefined);
      mockChrome.offscreen.createDocument.mockResolvedValue(undefined);
      mockChrome.tabCapture.getMediaStreamId.mockResolvedValue('stream-123');
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: true });
      });

      await startCapture(123);

      expect(mockChrome.offscreen.closeDocument).toHaveBeenCalled();
      expect(mockChrome.offscreen.createDocument).toHaveBeenCalled();
    });

    test('should handle multiple capture requests gracefully', async () => {
      mockChrome.offscreen.hasDocument.mockResolvedValue(false);
      mockChrome.offscreen.createDocument.mockResolvedValue(undefined);
      mockChrome.tabCapture.getMediaStreamId.mockResolvedValue('stream-123');
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: true });
      });

      // Start multiple captures
      const promise1 = startCapture(123);
      const promise2 = startCapture(456);

      await Promise.all([promise1, promise2]);

      // Should stop first capture before starting second
      expect(mockChrome.offscreen.createDocument).toHaveBeenCalledTimes(2);
    });
  });

  describe('WebSocket Connection', () => {
    test('should connect to local client on port 8765', async () => {
      await connectToLocalClient();
      
      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:8765');
    });

    test('should not create multiple WebSocket connections', async () => {
      const promise1 = connectToLocalClient();
      const promise2 = connectToLocalClient();
      
      await Promise.all([promise1, promise2]);
      
      expect(global.WebSocket).toHaveBeenCalledTimes(1);
    });

    test('should send streamStart message when capture starts', async () => {
      mockChrome.offscreen.hasDocument.mockResolvedValue(false);
      mockChrome.offscreen.createDocument.mockResolvedValue(undefined);
      mockChrome.tabCapture.getMediaStreamId.mockResolvedValue('stream-123');
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: true });
      });

      const ws = await connectToLocalClient();
      await new Promise(resolve => setTimeout(resolve, 20)); // Wait for connection
      
      await startCapture(123);

      expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'streamStart' }));
    });
  });

  describe('Error Handling', () => {
    test('should handle offscreen document creation failure', async () => {
      mockChrome.offscreen.hasDocument.mockResolvedValue(false);
      mockChrome.offscreen.createDocument.mockRejectedValue(new Error('Creation failed'));
      
      await expect(startCapture(123)).rejects.toThrow();
    });

    test('should handle WebSocket connection failure', async () => {
      global.WebSocket.mockImplementation(function() {
        setTimeout(() => {
          if (this.onerror) this.onerror(new Error('Connection failed'));
        }, 10);
        return this;
      });

      await expect(connectToLocalClient()).rejects.toThrow('Failed to connect to local client');
    });

    test('should cleanup on tab close', async () => {
      mockChrome.tabs.query.mockResolvedValue([]);
      mockChrome.offscreen.hasDocument.mockResolvedValue(true);
      
      // Simulate tab removal
      const removeListener = mockChrome.tabs.onRemoved.addListener.mock.calls[0][0];
      await removeListener(123, {});

      expect(mockChrome.tabs.query).toHaveBeenCalledWith({ url: "https://music.youtube.com/*" });
    });
  });
});