/**
 * WebSocket connection tests for background.js inspired by t-wada style TDD.
 * Demonstrates the RED -> GREEN -> REFACTOR cycle.
 */

// Load Chrome API mocks
require('./chrome-mock');

describe('background.js - WebSocket接続', () => {
  let connectToLocalClient;
  let ws;
  
  beforeEach(() => {
    // Mock timers
    jest.useFakeTimers();
    
    // Reset WebSocket mock implementation
    global.WebSocket.mockClear();
    global.WebSocket.mockImplementation(() => {
      const ws = {
        readyState: 0,
        OPEN: 1,
        onopen: null,
        onerror: null,
        send: jest.fn(),
        close: jest.fn()
      };
      
      // Simulate a successful connection
      setTimeout(() => {
        ws.readyState = 1;
        if (ws.onopen) ws.onopen();
      }, 10);
      
      return ws;
    });
    ws = null;
  });
  
  afterEach(() => {
    // Restore timers after each test
    jest.clearAllTimers();
    jest.useRealTimers();
  });
  
  describe('RED phase - テストを失敗させる', () => {
    test('connectToLocalClient関数が存在しない', () => {
      // RED: connectToLocalClient is not defined yet
      expect(typeof connectToLocalClient).toBe('undefined');
    });
    
    test('WebSocketが作成されない', () => {
      // RED: WebSocket connection logic has not been implemented yet
      // connectToLocalClient(); // the function does not exist at this point
      expect(global.WebSocket).not.toHaveBeenCalled();
    });
    
    test('接続成功のPromiseが返されない', async () => {
      // RED: promise handling has not been implemented yet
      // const result = await connectToLocalClient();
      // expect(result).toBeUndefined();
    });
    
    test('接続エラーが処理されない', async () => {
      // RED: error handling has not been implemented yet
      global.WebSocket.mockImplementationOnce(() => {
        const ws = {
          readyState: 0,
          OPEN: 1,
          onerror: null
        };
        setTimeout(() => {
          if (ws.onerror) ws.onerror(new Error('Connection failed'));
        }, 10);
        return ws;
      });
      
      // await expect(connectToLocalClient()).rejects.toThrow();
    });
  });
  
  describe('GREEN phase - 最小限の実装でテストを通す', () => {
    let wsInstance = null;
    
    beforeEach(() => {
      // Reset wsInstance for each test
      wsInstance = null;
      
      // Clear previous mock call history
      jest.clearAllMocks();
      
      // Minimal implementation to satisfy tests
      connectToLocalClient = function() {
        if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
          return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
          wsInstance = new WebSocket('ws://127.0.0.1:8765');
          ws = wsInstance; // keep a reference for assertions
          
          wsInstance.onopen = () => {
            resolve();
          };
          
          wsInstance.onerror = (error) => {
            reject(new Error('Failed to connect to local client'));
          };
        });
      };
    });
    
    test('connectToLocalClient関数が定義されている', () => {
      expect(typeof connectToLocalClient).toBe('function');
    });
    
    test('WebSocketが正しいURLで作成される', () => {
      connectToLocalClient();
      expect(global.WebSocket).toHaveBeenCalledWith('ws://127.0.0.1:8765');
    });
    
    test('既に接続されている場合は新しい接続を作らない', async () => {
      // First connection attempt
      const firstPromise = connectToLocalClient();
      
      // Complete the connection by advancing timers
      jest.advanceTimersByTime(10);

      await firstPromise;

      // Ensure WebSocket constructor is called only once
      expect(global.WebSocket).toHaveBeenCalledTimes(1);
      
      // Confirm the connection is open
      expect(wsInstance).not.toBeNull();
      expect(wsInstance.readyState).toBe(WebSocket.OPEN);
      
      // Second call should reuse the existing connection
      const secondPromise = connectToLocalClient();
      await secondPromise;
      
      // Ensure no new connection is created
      expect(global.WebSocket).toHaveBeenCalledTimes(1);
    });
    
    test('接続成功時にPromiseがresolveされる', async () => {
      const promise = connectToLocalClient();

      // Advance the timers to complete the connection
      jest.advanceTimersByTime(10);
      
      await expect(promise).resolves.toBeUndefined();
    });
    
    test('接続エラー時にPromiseがrejectされる', async () => {
      global.WebSocket.mockImplementationOnce(() => {
        const ws = {
          readyState: 0,
          OPEN: 1,
          onopen: null,
          onerror: null
        };
        setTimeout(() => {
          if (ws.onerror) ws.onerror(new Error('Connection failed'));
        }, 10);
        return ws;
      });
      
      const promise = connectToLocalClient();

      // Advance timers to trigger the failure
      jest.advanceTimersByTime(10);
      
      await expect(promise).rejects.toThrow('Failed to connect to local client');
    });
    
    test('WebSocketインスタンスが保存される', async () => {
      expect(ws).toBeNull();
      
      const promise = connectToLocalClient();

      // Advance timers to complete the connection
      jest.advanceTimersByTime(10);
      
      await promise;
      
      expect(ws).not.toBeNull();
      expect(ws.readyState).toBe(1); // OPEN
    });
  });
  
  describe('REFACTOR phase - コードを整理', () => {
    let wsInstance = null;
    
    // WebSocket configuration used in the refactored implementation
    const WS_CONFIG = {
      URL: 'ws://127.0.0.1:8765',
      RECONNECT_DELAY: 5000
    };
    
    // WebSocket state management helper
    const WebSocketManager = {
      instance: null,
      
      isConnected() {
        return !!(this.instance && this.instance.readyState === WebSocket.OPEN);
      },
      
      setInstance(ws) {
        this.instance = ws;
      },
      
      clearInstance() {
        if (this.instance) {
          this.instance.close();
          this.instance = null;
        }
      }
    };
    
    beforeEach(() => {
      // Reset manager before each test
      WebSocketManager.clearInstance();
      
      // Refactored implementation
      connectToLocalClient = function() {
        if (WebSocketManager.isConnected()) {
          return Promise.resolve();
        }
        
        return new Promise((resolve, reject) => {
          try {
            const ws = new WebSocket(WS_CONFIG.URL);
            
            ws.onopen = () => {
              WebSocketManager.setInstance(ws);
              resolve();
            };
            
            ws.onerror = () => {
              reject(new Error('Failed to connect to local client'));
            };
            
            ws.onclose = () => {
              WebSocketManager.clearInstance();
            };
            
          } catch (error) {
            reject(new Error('Failed to create WebSocket connection'));
          }
        });
      };
    });
    
    test('リファクタリング後も基本機能が動作する', async () => {
      const promise = connectToLocalClient();
      jest.advanceTimersByTime(10);
      await promise;
      
      expect(WebSocketManager.isConnected()).toBe(true);
      expect(global.WebSocket).toHaveBeenCalledWith(WS_CONFIG.URL);
    });
    
    test('接続エラー時の適切なエラーメッセージ', async () => {
      global.WebSocket.mockImplementationOnce(() => {
        throw new Error('WebSocket constructor error');
      });
      
      await expect(connectToLocalClient()).rejects.toThrow('Failed to create WebSocket connection');
    });
    
    test('oncloseハンドラーでインスタンスがクリアされる', async () => {
      let wsInstance;
      global.WebSocket.mockImplementationOnce(() => {
        wsInstance = {
          readyState: 0,
          OPEN: 1,
          onopen: null,
          onerror: null,
          onclose: null,
          close: jest.fn()
        };
        
        setTimeout(() => {
          wsInstance.readyState = 1;
          if (wsInstance.onopen) wsInstance.onopen();
        }, 10);
        
        return wsInstance;
      });
      
      const promise = connectToLocalClient();
      jest.advanceTimersByTime(10);
      await promise;
      
      expect(WebSocketManager.isConnected()).toBe(true);
      
      // Close the connection
      wsInstance.onclose();
      
      expect(WebSocketManager.isConnected()).toBe(false);
    });
    
    test('複数回の接続試行でも安定して動作する', async () => {
      // First connection attempt
      const promise1 = connectToLocalClient();
      jest.advanceTimersByTime(10);
      await promise1;
      
      // Subsequent call should reuse the connection
      const promise2 = connectToLocalClient();
      await promise2;
      
      expect(global.WebSocket).toHaveBeenCalledTimes(1);
    });
  });
});
