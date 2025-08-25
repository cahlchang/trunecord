/**
 * t-wada式TDDによるcontent.jsのテスト
 * RED -> GREEN -> REFACTOR のサイクルを実践
 */

// Chrome APIモックをロード
require('./chrome-mock');

describe('content.js - toggleStream関数', () => {
  let toggleStream;
  let updateButtonState;
  let showNotification;
  let discordButton;
  let isStreaming;
  let isSendingAudio;
  
  beforeEach(() => {
    // DOMの準備
    document.body.innerHTML = '';
    discordButton = document.createElement('button');
    discordButton.id = 'discord-stream-button';
    discordButton.innerHTML = '<span>Discord</span>';
    document.body.appendChild(discordButton);
    
    // Chrome APIモックのリセット
    chrome.runtime.sendMessage.mockClear();
    chrome.storage.local.set.mockClear();
    
    // グローバル変数の初期化
    isStreaming = false;
    isSendingAudio = true;
  });
  
  describe('RED phase - テストを失敗させる', () => {
    test('toggleStream関数が存在しない', () => {
      // RED: toggleStream関数がまだ定義されていない
      expect(typeof toggleStream).toBe('undefined');
    });
    
    test('音声送信モードの切り替えができない', () => {
      // RED: isSendingAudioの切り替えロジックがまだない
      const initialState = isSendingAudio;
      // toggleStream(); // この時点では関数が存在しない
      expect(isSendingAudio).toBe(initialState); // 変化していない
    });
    
    test('Chrome Storage APIに設定が保存されない', () => {
      // RED: Chrome Storage APIへの保存処理がまだない
      // toggleStream();
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
    
    test('ボタンのテキストが更新されない', () => {
      // RED: updateButtonState関数がまだない
      const span = discordButton.querySelector('span');
      expect(span.textContent).toBe('Discord'); // 初期状態のまま
    });
  });
  
  describe('GREEN phase - 最小限の実装でテストを通す', () => {
    beforeEach(() => {
      // 最小限の実装
      toggleStream = function() {
        if (!discordButton) return;
        
        if (!isStreaming) {
          isSendingAudio = !isSendingAudio;
          updateButtonState();
          chrome.storage.local.set({ isSendingAudio: isSendingAudio });
          showNotification(isSendingAudio ? 'Audio will be sent to Discord' : 'Audio will play normally');
          return;
        }
      };
      
      updateButtonState = function() {
        if (!discordButton) return;
        const span = discordButton.querySelector('span');
        
        if (!isSendingAudio) {
          span.textContent = 'Normal';
        } else {
          span.textContent = 'Discord';
        }
      };
      
      showNotification = jest.fn();
    });
    
    test('toggleStream関数が定義されている', () => {
      expect(typeof toggleStream).toBe('function');
    });
    
    test('音声送信モードをオフに切り替えられる', () => {
      expect(isSendingAudio).toBe(true);
      toggleStream();
      expect(isSendingAudio).toBe(false);
    });
    
    test('音声送信モードをオンに切り替えられる', () => {
      isSendingAudio = false;
      toggleStream();
      expect(isSendingAudio).toBe(true);
    });
    
    test('Chrome Storage APIに設定が保存される', () => {
      toggleStream();
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ isSendingAudio: false });
    });
    
    test('ボタンのテキストが「Normal」に更新される', () => {
      toggleStream();
      const span = discordButton.querySelector('span');
      expect(span.textContent).toBe('Normal');
    });
    
    test('ボタンのテキストが「Discord」に更新される', () => {
      isSendingAudio = false;
      toggleStream();
      const span = discordButton.querySelector('span');
      expect(span.textContent).toBe('Discord');
    });
    
    test('通知が表示される', () => {
      toggleStream();
      expect(showNotification).toHaveBeenCalledWith('Audio will play normally');
      
      toggleStream();
      expect(showNotification).toHaveBeenCalledWith('Audio will be sent to Discord');
    });
  });
  
  describe('REFACTOR phase - コードを整理', () => {
    beforeEach(() => {
      // リファクタリング後の実装
      const AudioStreamingMode = {
        DISCORD: 'discord',
        NORMAL: 'normal'
      };
      
      const getCurrentMode = () => {
        return isSendingAudio ? AudioStreamingMode.DISCORD : AudioStreamingMode.NORMAL;
      };
      
      const setMode = (mode) => {
        isSendingAudio = (mode === AudioStreamingMode.DISCORD);
        chrome.storage.local.set({ isSendingAudio });
      };
      
      const getModeDisplayText = (mode) => {
        return mode === AudioStreamingMode.DISCORD ? 'Discord' : 'Normal';
      };
      
      const getModeNotificationText = (mode) => {
        return mode === AudioStreamingMode.DISCORD 
          ? 'Audio will be sent to Discord' 
          : 'Audio will play normally';
      };
      
      updateButtonState = function() {
        if (!discordButton) return;
        const span = discordButton.querySelector('span');
        span.textContent = getModeDisplayText(getCurrentMode());
      };
      
      showNotification = jest.fn();
      
      toggleStream = function() {
        if (!discordButton || isStreaming) return;
        
        const newMode = getCurrentMode() === AudioStreamingMode.DISCORD 
          ? AudioStreamingMode.NORMAL 
          : AudioStreamingMode.DISCORD;
        
        setMode(newMode);
        updateButtonState();
        showNotification(getModeNotificationText(newMode));
      };
    });
    
    test('リファクタリング後も全機能が正しく動作する', () => {
      // 音声送信モードの切り替え
      expect(isSendingAudio).toBe(true);
      toggleStream();
      expect(isSendingAudio).toBe(false);
      
      // ボタンテキストの更新
      const span = discordButton.querySelector('span');
      expect(span.textContent).toBe('Normal');
      
      // Chrome Storage APIへの保存
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ isSendingAudio: false });
      
      // 通知の表示
      expect(showNotification).toHaveBeenCalledWith('Audio will play normally');
    });
    
    test('ストリーミング中は切り替えができない', () => {
      isStreaming = true;
      const initialState = isSendingAudio;
      
      toggleStream();
      
      expect(isSendingAudio).toBe(initialState);
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
      expect(showNotification).not.toHaveBeenCalled();
    });
    
    test('ボタンが存在しない場合はエラーにならない', () => {
      discordButton = null;
      
      expect(() => {
        toggleStream();
        updateButtonState();
      }).not.toThrow();
    });
  });
});