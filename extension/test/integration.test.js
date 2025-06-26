/**
 * Integration tests for trunecord Chrome Extension
 * Tests the critical flows and edge cases
 */

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
    query: jest.fn().mockResolvedValue([]),
    sendMessage: jest.fn().mockResolvedValue(undefined),
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

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.send = jest.fn();
    this.close = jest.fn();
    
    // Store instance for tests
    MockWebSocket.lastInstance = this;
    
    // Simulate connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 10);
  }
  
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
}

global.chrome = mockChrome;
global.WebSocket = MockWebSocket;

// Import the module
let backgroundModule;

beforeAll(() => {
  // Clear module cache
  jest.resetModules();
  backgroundModule = require('../src/background.js');
});

describe('trunecord Extension Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockWebSocket.lastInstance = null;
    
    // Reset Chrome API mocks
    mockChrome.offscreen.hasDocument.mockResolvedValue(false);
    mockChrome.offscreen.createDocument.mockResolvedValue(undefined);
    mockChrome.offscreen.closeDocument.mockResolvedValue(undefined);
    mockChrome.tabCapture.getMediaStreamId.mockResolvedValue('stream-test-123');
    mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
      // Simulate offscreen document response
      setTimeout(() => {
        if (callback) callback({ success: true });
      }, 10);
    });
  });

  describe('Double-click Prevention', () => {
    test('should handle rapid multiple start requests gracefully', async () => {
      // Simulate rapid clicks
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(backgroundModule.startCapture(123));
      }
      
      await Promise.all(promises);
      
      // Should only create offscreen document once
      expect(mockChrome.offscreen.createDocument).toHaveBeenCalledTimes(1);
    });

    test('should handle start while already streaming', async () => {
      // First start
      await backgroundModule.startCapture(123);
      
      // Second start should reuse existing capture
      const secondStart = await backgroundModule.startCapture(123);
      
      expect(secondStart).toBe(true);
    });

    test('should properly cleanup when stopping during startup', async () => {
      // Start capture but don't wait
      const startPromise = backgroundModule.startCapture(123);
      
      // Immediately stop
      await backgroundModule.stopCapture();
      
      // Original start should complete without errors
      await expect(startPromise).resolves.toBe(true);
    });
  });

  describe('WebSocket Connection Management', () => {
    test('should establish WebSocket connection before capturing', async () => {
      await backgroundModule.startCapture(123);
      
      expect(MockWebSocket.lastInstance).toBeTruthy();
      expect(MockWebSocket.lastInstance.url).toBe('ws://localhost:8765');
    });

    test('should send streamStart message when capture begins', async () => {
      await backgroundModule.startCapture(123);
      
      // Wait for WebSocket to be ready
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(MockWebSocket.lastInstance.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'streamStart' })
      );
    });

    test('should handle WebSocket reconnection', async () => {
      await backgroundModule.startCapture(123);
      const firstWs = MockWebSocket.lastInstance;
      
      // Simulate WebSocket disconnect
      firstWs.readyState = MockWebSocket.CLOSED;
      if (firstWs.onclose) firstWs.onclose();
      
      // Start new capture
      await backgroundModule.startCapture(456);
      
      // Should create new WebSocket
      expect(MockWebSocket.lastInstance).not.toBe(firstWs);
    });
  });

  describe('Offscreen Document Lifecycle', () => {
    test('should close existing offscreen document before creating new one', async () => {
      mockChrome.offscreen.hasDocument.mockResolvedValue(true);
      
      await backgroundModule.startCapture(123);
      
      expect(mockChrome.offscreen.closeDocument).toHaveBeenCalled();
      expect(mockChrome.offscreen.createDocument).toHaveBeenCalled();
    });

    test('should handle offscreen document creation failure', async () => {
      mockChrome.offscreen.createDocument.mockRejectedValue(
        new Error('User denied permission')
      );
      
      await expect(backgroundModule.startCapture(123)).rejects.toThrow();
    });

    test('should cleanup offscreen document on stop', async () => {
      await backgroundModule.startCapture(123);
      
      mockChrome.offscreen.hasDocument.mockResolvedValue(true);
      await backgroundModule.stopCapture();
      
      expect(mockChrome.offscreen.closeDocument).toHaveBeenCalled();
    });
  });

  describe('Message Passing', () => {
    test('should handle audio data messages', async () => {
      await backgroundModule.startCapture(123);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Get the message handler
      const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      
      // Simulate audio data message
      const sendResponse = jest.fn();
      messageHandler(
        { type: 'audioData', audio: 'base64data' },
        { tab: { id: 123 } },
        sendResponse
      );
      
      expect(MockWebSocket.lastInstance.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'audio', audio: 'base64data' })
      );
    });

    test('should handle stream pause/resume messages', async () => {
      await backgroundModule.startCapture(123);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      
      // Pause
      messageHandler({ type: 'streamPause' }, {}, jest.fn());
      expect(MockWebSocket.lastInstance.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'streamPause' })
      );
      
      // Resume
      messageHandler({ type: 'streamResume' }, {}, jest.fn());
      expect(MockWebSocket.lastInstance.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'streamResume' })
      );
    });
  });

  describe('Error Recovery', () => {
    test('should recover from offscreen document communication timeout', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        // Don't call callback - simulate timeout
      });
      
      await expect(backgroundModule.startCapture(123)).rejects.toThrow('Timeout');
    });

    test('should handle tab removal during streaming', async () => {
      await backgroundModule.startCapture(123);
      
      // Get tab removed handler
      const tabRemovedHandler = mockChrome.tabs.onRemoved.addListener.mock.calls[0][0];
      
      // Simulate tab removal
      mockChrome.tabs.query.mockResolvedValue([]); // No more YouTube Music tabs
      await tabRemovedHandler(123, {});
      
      // Should stop capture
      expect(mockChrome.offscreen.closeDocument).toHaveBeenCalled();
    });

    test('should continue working after errors', async () => {
      // First attempt fails
      mockChrome.offscreen.createDocument.mockRejectedValueOnce(
        new Error('Temporary failure')
      );
      
      await expect(backgroundModule.startCapture(123)).rejects.toThrow();
      
      // Second attempt should work
      mockChrome.offscreen.createDocument.mockResolvedValue(undefined);
      await expect(backgroundModule.startCapture(123)).resolves.toBe(true);
    });
  });
});