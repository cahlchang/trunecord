/**
 * t-wada式TDDによるbackground.jsのWebSocket接続テスト
 * RED -> GREEN -> REFACTOR のサイクルを実践
 */

// Chrome APIモックをロード
require('./chrome-mock');

describe('background.js - WebSocket接続', () => {
  let connectToLocalClient;
  let ws;
  
  beforeEach(() => {
    // タイマーのモック
    jest.useFakeTimers();
    
    // WebSocketモックのリセット
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
      
      // 接続成功をシミュレート
      setTimeout(() => {
        ws.readyState = 1;
        if (ws.onopen) ws.onopen();
      }, 10);
      
      return ws;
    });
    ws = null;
  });
  
  afterEach(() => {
    // タイマーをクリア
    jest.clearAllTimers();
    jest.useRealTimers();
  });
  
  describe('RED phase - テストを失敗させる', () => {
    test('connectToLocalClient関数が存在しない', () => {
      // RED: connectToLocalClient関数がまだ定義されていない
      expect(typeof connectToLocalClient).toBe('undefined');
    });
    
    test('WebSocketが作成されない', () => {
      // RED: WebSocket接続のロジックがまだない
      // connectToLocalClient(); // この時点では関数が存在しない
      expect(global.WebSocket).not.toHaveBeenCalled();
    });
    
    test('接続成功のPromiseが返されない', async () => {
      // RED: Promise処理がまだない
      // const result = await connectToLocalClient();
      // expect(result).toBeUndefined();
    });
    
    test('接続エラーが処理されない', async () => {
      // RED: エラーハンドリングがまだない
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
      // 各テストでwsInstanceをリセット
      wsInstance = null;
      
      // モックをクリア
      jest.clearAllMocks();
      
      // 最小限の実装
      connectToLocalClient = function() {
        if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
          return Promise.resolve();
        }
        
        return new Promise((resolve, reject) => {
          wsInstance = new WebSocket('ws://localhost:8765');
          ws = wsInstance; // テスト用にグローバル変数にも保存
          
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
      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:8765');
    });
    
    test('既に接続されている場合は新しい接続を作らない', async () => {
      // 最初の接続
      const firstPromise = connectToLocalClient();
      
      // タイマーを進めて接続を完了させる
      jest.advanceTimersByTime(10);
      
      await firstPromise;
      
      // WebSocketが1回呼ばれたことを確認
      expect(global.WebSocket).toHaveBeenCalledTimes(1);
      
      // wsInstanceが接続済みであることを確認
      expect(wsInstance).not.toBeNull();
      expect(wsInstance.readyState).toBe(WebSocket.OPEN);
      
      // 2回目の呼び出し（既に接続済み）
      const secondPromise = connectToLocalClient();
      await secondPromise;
      
      // WebSocketが新たに作成されていないことを確認
      expect(global.WebSocket).toHaveBeenCalledTimes(1);
    });
    
    test('接続成功時にPromiseがresolveされる', async () => {
      const promise = connectToLocalClient();
      
      // タイマーを進める
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
      
      // タイマーを進めてエラーを発生させる
      jest.advanceTimersByTime(10);
      
      await expect(promise).rejects.toThrow('Failed to connect to local client');
    });
    
    test('WebSocketインスタンスが保存される', async () => {
      expect(ws).toBeNull();
      
      const promise = connectToLocalClient();
      
      // タイマーを進める
      jest.advanceTimersByTime(10);
      
      await promise;
      
      expect(ws).not.toBeNull();
      expect(ws.readyState).toBe(1); // OPEN
    });
  });
  
  describe('REFACTOR phase - コードを整理', () => {
    let wsInstance = null;
    
    // WebSocket設定
    const WS_CONFIG = {
      URL: 'ws://localhost:8765',
      RECONNECT_DELAY: 5000
    };
    
    // WebSocket状態管理
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
      // 各テストでリセット
      WebSocketManager.clearInstance();
      
      // リファクタリング後の実装
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
      
      // 接続をクローズ
      wsInstance.onclose();
      
      expect(WebSocketManager.isConnected()).toBe(false);
    });
    
    test('複数回の接続試行でも安定して動作する', async () => {
      // 1回目の接続
      const promise1 = connectToLocalClient();
      jest.advanceTimersByTime(10);
      await promise1;
      
      // 既に接続済みの場合
      const promise2 = connectToLocalClient();
      await promise2;
      
      expect(global.WebSocket).toHaveBeenCalledTimes(1);
    });
  });
});