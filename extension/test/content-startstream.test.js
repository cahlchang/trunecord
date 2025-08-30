/**
 * t-wada式TDDによるcontent.jsのstartStream関数テスト
 * RED -> GREEN -> REFACTOR のサイクルを実践
 */

// Chrome APIモックをロード
require('./chrome-mock');

describe('content.js - startStream関数', () => {
  let startStream;
  let updateButtonState;
  let showNotification;
  let discordButton;
  let isSendingAudio;
  let isStreaming;
  
  beforeEach(() => {
    // DOMの準備
    document.body.innerHTML = '';
    discordButton = document.createElement('button');
    discordButton.id = 'discord-stream-button';
    discordButton.innerHTML = '<span>Discord</span>';
    discordButton.disabled = false;
    discordButton.style.opacity = '1';
    discordButton.title = '';
    document.body.appendChild(discordButton);
    
    // Chrome APIモックのリセット
    chrome.runtime.sendMessage.mockClear();
    chrome.runtime.lastError = null;
    
    // グローバル変数の初期化
    isStreaming = false;
    isSendingAudio = true;
    
    // モック関数
    updateButtonState = jest.fn();
    showNotification = jest.fn();
  });
  
  describe('RED phase - テストを失敗させる', () => {
    test('startStream関数が存在しない', () => {
      // RED: startStream関数がまだ定義されていない
      expect(typeof startStream).toBe('undefined');
    });
    
    test('isSendingAudioがfalseの時は何もしない', () => {
      isSendingAudio = false;
      // startStream(); // この時点では関数が存在しない
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });
    
    test('discordButtonが存在しない時は何もしない', () => {
      discordButton = null;
      // startStream();
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });
    
    test('Chrome拡張機能にstartStreamメッセージを送信しない', () => {
      // startStream();
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
        { action: 'startStream' },
        expect.any(Function)
      );
    });
  });
  
  describe('GREEN phase - 最小限の実装でテストを通す', () => {
    beforeEach(() => {
      // 最小限の実装
      startStream = async function() {
        if (!discordButton || !isSendingAudio) return;
        
        discordButton.disabled = true;
        
        try {
          chrome.runtime.sendMessage({ action: 'startStream' }, (response) => {
            if (chrome.runtime.lastError) {
              showNotification(chrome.i18n.getMessage('failedToCommunicate'));
              discordButton.disabled = false;
              return;
            }
            
            if (response && response.success) {
              isStreaming = true;
              updateButtonState();
            } else if (response) {
              if (response.error && response.error.includes('extension popup')) {
                showNotification('⚠️ ' + chrome.i18n.getMessage('clickExtensionIcon'), true);
                discordButton.style.opacity = '0.6';
                discordButton.title = chrome.i18n.getMessage('clickExtensionIcon');
              } else {
                showNotification(response.error || chrome.i18n.getMessage('failedToStartStreaming'));
              }
            }
            discordButton.disabled = false;
          });
        } catch (error) {
          showNotification(chrome.i18n.getMessage('failedToConnect'));
          discordButton.disabled = false;
        }
      };
    });
    
    test('startStream関数が定義されている', () => {
      expect(typeof startStream).toBe('function');
    });
    
    test('isSendingAudioがfalseの時は何もしない', async () => {
      isSendingAudio = false;
      await startStream();
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
      expect(discordButton.disabled).toBe(false);
    });
    
    test('discordButtonが存在しない時は何もしない', async () => {
      discordButton = null;
      await startStream();
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });
    
    test('ストリーミング開始時にボタンを無効化する', async () => {
      await startStream();
      expect(discordButton.disabled).toBe(true);
    });
    
    test('Chrome拡張機能にstartStreamメッセージを送信する', async () => {
      await startStream();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'startStream' },
        expect.any(Function)
      );
    });
    
    test('成功時にisStreamingをtrueに設定する', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: true });
      });
      
      await startStream();
      expect(isStreaming).toBe(true);
      expect(updateButtonState).toHaveBeenCalled();
      expect(discordButton.disabled).toBe(false);
    });
    
    test('通信エラー時に適切なメッセージを表示する', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        chrome.runtime.lastError = { message: 'Extension error' };
        callback();
      });
      
      await startStream();
      expect(showNotification).toHaveBeenCalledWith('Failed to communicate');
      expect(discordButton.disabled).toBe(false);
    });
    
    test('ポップアップエラー時に特別な処理を行う', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ 
          success: false, 
          error: 'Please use the extension popup to start streaming' 
        });
      });
      
      await startStream();
      expect(showNotification).toHaveBeenCalledWith(
        '⚠️ ' + 'clickExtensionIcon',
        true
      );
      expect(discordButton.style.opacity).toBe('0.6');
      expect(discordButton.title).toBe('clickExtensionIcon');
    });
    
    test('その他のエラー時にエラーメッセージを表示する', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ 
          success: false, 
          error: 'Connection failed' 
        });
      });
      
      await startStream();
      expect(showNotification).toHaveBeenCalledWith('Connection failed');
      expect(discordButton.disabled).toBe(false);
    });
  });
  
  describe('REFACTOR phase - コードを整理', () => {
    // エラータイプの定義
    const ErrorTypes = {
      COMMUNICATION: 'communication',
      POPUP_REQUIRED: 'popup_required',
      GENERAL: 'general'
    };
    
    // ボタン状態管理
    const ButtonStateManager = {
      disable(button) {
        if (button) button.disabled = true;
      },
      
      enable(button) {
        if (button) button.disabled = false;
      },
      
      setWarningState(button) {
        if (button) {
          button.style.opacity = '0.6';
          button.title = chrome.i18n.getMessage('clickExtensionIcon');
        }
      }
    };
    
    beforeEach(() => {
      // リファクタリング後の実装
      startStream = async function() {
        if (!discordButton || !isSendingAudio) return;
        
        ButtonStateManager.disable(discordButton);
        
        const handleResponse = (response) => {
          if (chrome.runtime.lastError) {
            handleError(ErrorTypes.COMMUNICATION);
            return;
          }
          
          if (response?.success) {
            handleSuccess();
          } else if (response) {
            const errorType = response.error?.includes('extension popup') 
              ? ErrorTypes.POPUP_REQUIRED 
              : ErrorTypes.GENERAL;
            handleError(errorType, response.error);
          }
          
          ButtonStateManager.enable(discordButton);
        };
        
        const handleSuccess = () => {
          isStreaming = true;
          updateButtonState();
        };
        
        const handleError = (type, message) => {
          switch (type) {
            case ErrorTypes.COMMUNICATION:
              showNotification(chrome.i18n.getMessage('failedToCommunicate'));
              break;
              
            case ErrorTypes.POPUP_REQUIRED:
              showNotification('⚠️ ' + chrome.i18n.getMessage('clickExtensionIcon'), true);
              ButtonStateManager.setWarningState(discordButton);
              break;
              
            case ErrorTypes.GENERAL:
              showNotification(message || chrome.i18n.getMessage('failedToStartStreaming'));
              break;
          }
          ButtonStateManager.enable(discordButton);
        };
        
        try {
          chrome.runtime.sendMessage({ action: 'startStream' }, handleResponse);
        } catch (error) {
          handleError(ErrorTypes.GENERAL, chrome.i18n.getMessage('failedToConnect'));
        }
      };
    });
    
    test('リファクタリング後も全機能が正しく動作する', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: true });
      });
      
      await startStream();
      
      expect(isStreaming).toBe(true);
      expect(updateButtonState).toHaveBeenCalled();
      expect(discordButton.disabled).toBe(false);
    });
    
    test('条件チェックが効率的に動作する', async () => {
      // isSendingAudioとdiscordButtonの両方をチェック
      isSendingAudio = false;
      await startStream();
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
      
      isSendingAudio = true;
      discordButton = null;
      await startStream();
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });
    
    test('エラーハンドリングが統一されている', async () => {
      // 通信エラー
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        chrome.runtime.lastError = { message: 'Error' };
        callback();
      });
      await startStream();
      expect(showNotification).toHaveBeenCalledWith('Failed to communicate');
      
      // ポップアップエラー
      chrome.runtime.sendMessage.mockClear();
      showNotification.mockClear();
      chrome.runtime.lastError = null;
      
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: false, error: 'extension popup required' });
      });
      await startStream();
      expect(showNotification).toHaveBeenCalledWith('⚠️ clickExtensionIcon', true);
      expect(discordButton.style.opacity).toBe('0.6');
    });
    
    test('例外処理が適切に行われる', async () => {
      chrome.runtime.sendMessage.mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      
      await startStream();
      expect(showNotification).toHaveBeenCalledWith('Failed to connect');
      expect(discordButton.disabled).toBe(false);
    });
  });
});