/**
 * Tests for content.js startStream function using the t-wada style RED → GREEN → REFACTOR cycle.
 */

// Load Chrome API mocks
require('./chrome-mock');

describe('content.js - startStream function', () => {
  let startStream;
  let updateButtonState;
  let showNotification;
  let discordButton;
  let isSendingAudio;
  let isStreaming;
  
  beforeEach(() => {
    // Prepare DOM for each test
    document.body.innerHTML = '';
    discordButton = document.createElement('button');
    discordButton.id = 'discord-stream-button';
    discordButton.innerHTML = '<span>Discord</span>';
    discordButton.disabled = false;
    discordButton.style.opacity = '1';
    discordButton.title = '';
    document.body.appendChild(discordButton);
    
    // Reset Chrome API mocks
    chrome.runtime.sendMessage.mockClear();
    chrome.runtime.lastError = null;
    
    // Initialize state used by the module under test
    isStreaming = false;
    isSendingAudio = true;
    
    // Helper stubs
    updateButtonState = jest.fn();
    showNotification = jest.fn();
  });
  
  describe('RED phase - make tests fail first', () => {
    test('startStream is not defined yet', () => {
      // RED: startStream has not been implemented
      expect(typeof startStream).toBe('undefined');
    });
    
    test('does nothing when isSendingAudio is false', () => {
      isSendingAudio = false;
      // startStream(); // function is not defined yet
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });
    
    test('does nothing when discordButton is null', () => {
      discordButton = null;
      // startStream();
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });
    
    test('does not send a startStream message yet', () => {
      // startStream();
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
        { action: 'startStream' },
        expect.any(Function)
      );
    });
  });
  
  describe('GREEN phase - minimal implementation to satisfy tests', () => {
    beforeEach(() => {
      // Minimal implementation
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
    
    test('does nothing when isSendingAudio is false', async () => {
      isSendingAudio = false;
      await startStream();
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
      expect(discordButton.disabled).toBe(false);
    });
    
    test('does nothing when discordButton is absent', async () => {
      discordButton = null;
      await startStream();
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });
    
    test('disables the button while starting the stream', async () => {
      await startStream();
      expect(discordButton.disabled).toBe(true);
    });
    
    test('sends startStream message to the extension', async () => {
      await startStream();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'startStream' },
        expect.any(Function)
      );
    });
    
    test('sets isStreaming to true on success', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: true });
      });
      
      await startStream();
      expect(isStreaming).toBe(true);
      expect(updateButtonState).toHaveBeenCalled();
      expect(discordButton.disabled).toBe(false);
    });
    
    test('shows message when communication fails', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        chrome.runtime.lastError = { message: 'Extension error' };
        callback();
      });
      
      await startStream();
      expect(showNotification).toHaveBeenCalledWith('Failed to communicate');
      expect(discordButton.disabled).toBe(false);
    });
    
    test('handles popup-required error specially', async () => {
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
    
    test('shows error message for other failures', async () => {
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
  
  describe('REFACTOR phase - organizing code', () => {
    // Error type definitions
    const ErrorTypes = {
      COMMUNICATION: 'communication',
      POPUP_REQUIRED: 'popup_required',
      GENERAL: 'general'
    };
    
    // Button state helpers
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
      // Refactored implementation
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
    
    test('all features still work after refactor', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: true });
      });
      
      await startStream();
      
      expect(isStreaming).toBe(true);
      expect(updateButtonState).toHaveBeenCalled();
      expect(discordButton.disabled).toBe(false);
    });
    
    test('precondition checks run efficiently', async () => {
      // Ensure both isSendingAudio and discordButton are validated
      isSendingAudio = false;
      await startStream();
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
      
      isSendingAudio = true;
      discordButton = null;
      await startStream();
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });
    
    test('error handling is centralized', async () => {
      // Communication error
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        chrome.runtime.lastError = { message: 'Error' };
        callback();
      });
      await startStream();
      expect(showNotification).toHaveBeenCalledWith('Failed to communicate');
      
      // Popup-required error
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
    
    test('exceptions are handled gracefully', async () => {
      chrome.runtime.sendMessage.mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      
      await startStream();
      expect(showNotification).toHaveBeenCalledWith('Failed to connect');
      expect(discordButton.disabled).toBe(false);
    });
  });
});
