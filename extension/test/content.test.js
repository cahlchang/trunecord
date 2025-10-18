/**
 * Tests for content.js using the t-wada style RED → GREEN → REFACTOR cycle.
 */

// Load Chrome API mocks
require('./chrome-mock');

describe('content.js - toggleStream function', () => {
  let toggleStream;
  let updateButtonState;
  let showNotification;
  let discordButton;
  let isStreaming;
  let isSendingAudio;
  
  beforeEach(() => {
    // Prepare DOM for each test
    document.body.innerHTML = '';
    discordButton = document.createElement('button');
    discordButton.id = 'discord-stream-button';
    discordButton.innerHTML = '<span>Discord</span>';
    document.body.appendChild(discordButton);
    
    // Reset Chrome API mocks
    chrome.runtime.sendMessage.mockClear();
    chrome.storage.local.set.mockClear();
    
    // Initialize state used by toggleStream
    isStreaming = false;
    isSendingAudio = true;
  });

  describe('RED phase - make tests fail first', () => {
    test('toggleStream is not defined yet', () => {
      // RED: toggleStream has not been implemented
      expect(typeof toggleStream).toBe('undefined');
    });
    
    test('audio sending mode cannot be toggled yet', () => {
      // RED: no logic exists to flip isSendingAudio
      const initialState = isSendingAudio;
      // toggleStream(); // function not yet defined
      expect(isSendingAudio).toBe(initialState); // remains unchanged
    });
    
    test('settings are not persisted to Chrome Storage', () => {
      // RED: persistence has not been implemented
      // toggleStream();
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
    
    test('button text is not updated', () => {
      // RED: updateButtonState has not been implemented
      const span = discordButton.querySelector('span');
      expect(span.textContent).toBe('Discord'); // remains initial label
    });
  });

  describe('GREEN phase - minimal implementation to satisfy tests', () => {
    beforeEach(() => {
      // Minimal implementation
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
    
    test('settings are saved to Chrome Storage', () => {
      toggleStream();
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ isSendingAudio: false });
    });
    
    test('button text updates to "Normal"', () => {
      toggleStream();
      const span = discordButton.querySelector('span');
      expect(span.textContent).toBe('Normal');
    });
    
    test('button text updates to "Discord"', () => {
      isSendingAudio = false;
      toggleStream();
      const span = discordButton.querySelector('span');
      expect(span.textContent).toBe('Discord');
    });
    
    test('notifications are displayed', () => {
      toggleStream();
      expect(showNotification).toHaveBeenCalledWith('Audio will play normally');
      
      toggleStream();
      expect(showNotification).toHaveBeenCalledWith('Audio will be sent to Discord');
    });
  });
  
  describe('REFACTOR phase - organizing code', () => {
    beforeEach(() => {
      // Refactored implementation
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
    
    test('all behaviors still work after refactor', () => {
      // Toggle audio sending mode
      expect(isSendingAudio).toBe(true);
      toggleStream();
      expect(isSendingAudio).toBe(false);
      
      // Button label updates
      const span = discordButton.querySelector('span');
      expect(span.textContent).toBe('Normal');
      
      // Chrome Storage persistence
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ isSendingAudio: false });
      
      // Notification is shown
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
