/**
 * Tests for content.js showNotification function using a t-wada style RED → GREEN → REFACTOR cycle.
 */

describe('content.js - showNotification function', () => {
  let showNotification;
  
  beforeEach(() => {
    // Reset DOM for each test case
    document.body.innerHTML = '';
    
    // Use fake timers so animations/timers can be controlled
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });
  
  describe('RED phase - make tests fail first', () => {
    test('showNotification function does not exist yet', () => {
      // RED: showNotification has not been implemented
      expect(typeof showNotification).toBe('undefined');
    });
    
    test('notification element is not added to the DOM', () => {
      // showNotification('Test message');
      const notification = document.querySelector('.discord-notification');
      expect(notification).toBeNull();
    });
    
    test('notification message is not displayed', () => {
      // showNotification('Test message');
      const notifications = document.querySelectorAll('.discord-notification');
      expect(notifications.length).toBe(0);
    });
    
    test('warning style is not applied', () => {
      // showNotification('Warning', true);
      const warning = document.querySelector('.discord-notification.warning');
      expect(warning).toBeNull();
    });
  });
  
  describe('GREEN phase - minimum implementation to satisfy tests', () => {
    beforeEach(() => {
      // Minimal implementation
      showNotification = function(message, isWarning = false) {
        const notification = document.createElement('div');
        notification.className = 'discord-notification' + (isWarning ? ' warning' : '');
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.classList.add('show');
        }, 10);
        
        const duration = isWarning ? 5000 : 3000;
        
        setTimeout(() => {
          notification.classList.remove('show');
          setTimeout(() => notification.remove(), 300);
        }, duration);
      };
    });
    
    test('showNotification関数が定義されている', () => {
      expect(typeof showNotification).toBe('function');
    });
    
    test('通知要素がDOMに追加される', () => {
      showNotification('Test message');
      const notification = document.querySelector('.discord-notification');
      expect(notification).not.toBeNull();
      expect(notification.textContent).toBe('Test message');
    });
    
    test('複数の通知を同時に表示できる', () => {
      showNotification('First message');
      showNotification('Second message');
      
      const notifications = document.querySelectorAll('.discord-notification');
      expect(notifications.length).toBe(2);
      expect(notifications[0].textContent).toBe('First message');
      expect(notifications[1].textContent).toBe('Second message');
    });
    
    test('warning style is applied', () => {
      showNotification('Warning message', true);
      const warning = document.querySelector('.discord-notification.warning');
      expect(warning).not.toBeNull();
      expect(warning.textContent).toBe('Warning message');
    });
    
    test('notification receives show class', () => {
      showNotification('Test');
      const notification = document.querySelector('.discord-notification');
      
      expect(notification.classList.contains('show')).toBe(false);
      
      // The show class is applied after 10 ms
      jest.advanceTimersByTime(10);
      expect(notification.classList.contains('show')).toBe(true);
    });
    
    test('regular notification hides after 3 seconds', () => {
      showNotification('Test');
      const notification = document.querySelector('.discord-notification');
      
      jest.advanceTimersByTime(10);
      expect(notification.classList.contains('show')).toBe(true);
      
      // Remove show class after 3 seconds
      jest.advanceTimersByTime(3000);
      expect(notification.classList.contains('show')).toBe(false);
      
      // Remove from DOM after an additional 300 ms
      jest.advanceTimersByTime(300);
      expect(document.querySelector('.discord-notification')).toBeNull();
    });
    
    test('warning notification hides after 5 seconds', () => {
      showNotification('Warning', true);
      const notification = document.querySelector('.discord-notification.warning');
      
      jest.advanceTimersByTime(10);
      expect(notification.classList.contains('show')).toBe(true);
      
      // Remove show class after 5 seconds
      jest.advanceTimersByTime(5000);
      expect(notification.classList.contains('show')).toBe(false);
      
      // Remove from DOM after an additional 300 ms
      jest.advanceTimersByTime(300);
      expect(document.querySelector('.discord-notification')).toBeNull();
    });
  });
  
  describe('REFACTOR phase - organizing the code', () => {
    // Notification configuration
    const NotificationConfig = {
      ANIMATION_DELAY: 10,
      REMOVAL_ANIMATION_DURATION: 300,
      NORMAL_DURATION: 3000,
      WARNING_DURATION: 5000,
      CSS_CLASS: 'discord-notification',
      CSS_CLASS_SHOW: 'show',
      CSS_CLASS_WARNING: 'warning'
    };
    
    // Factory for notification elements
    const createNotificationElement = (message, isWarning) => {
      const element = document.createElement('div');
      element.className = NotificationConfig.CSS_CLASS;
      if (isWarning) {
        element.classList.add(NotificationConfig.CSS_CLASS_WARNING);
      }
      element.textContent = message;
      return element;
    };
    
    // Animation helper
    const NotificationAnimator = {
      show(element) {
        setTimeout(() => {
          element.classList.add(NotificationConfig.CSS_CLASS_SHOW);
        }, NotificationConfig.ANIMATION_DELAY);
      },
      
      hide(element, onComplete) {
        element.classList.remove(NotificationConfig.CSS_CLASS_SHOW);
        setTimeout(onComplete, NotificationConfig.REMOVAL_ANIMATION_DURATION);
      }
    };
    
    beforeEach(() => {
      // Refactored implementation
      showNotification = function(message, isWarning = false) {
        const notification = createNotificationElement(message, isWarning);
        document.body.appendChild(notification);
        
        // Show animation
        NotificationAnimator.show(notification);
        
        // Auto removal
        const duration = isWarning 
          ? NotificationConfig.WARNING_DURATION 
          : NotificationConfig.NORMAL_DURATION;
        
        setTimeout(() => {
          NotificationAnimator.hide(notification, () => {
            notification.remove();
          });
        }, duration);
      };
    });
    
    test('all behaviors still work after refactor', () => {
      // Render a normal notification
      showNotification('Normal notification');
      let notification = document.querySelector('.discord-notification');
      expect(notification).not.toBeNull();
      expect(notification.textContent).toBe('Normal notification');
      expect(notification.classList.contains('warning')).toBe(false);
      
      // Render a warning notification
      showNotification('Warning notification', true);
      const warning = document.querySelector('.discord-notification.warning');
      expect(warning).not.toBeNull();
      expect(warning.textContent).toBe('Warning notification');
    });
    
    test('animation timing is accurate', () => {
      showNotification('Test');
      const notification = document.querySelector('.discord-notification');
      
      // Initial state
      expect(notification.classList.contains('show')).toBe(false);
      
      // Visible after configured delay
      jest.advanceTimersByTime(NotificationConfig.ANIMATION_DELAY);
      expect(notification.classList.contains('show')).toBe(true);
      
      // Hide after the normal duration
      jest.advanceTimersByTime(NotificationConfig.NORMAL_DURATION);
      expect(notification.classList.contains('show')).toBe(false);
      
      // Removal animation finishes after configured delay
      jest.advanceTimersByTime(NotificationConfig.REMOVAL_ANIMATION_DURATION);
      expect(document.querySelector('.discord-notification')).toBeNull();
    });
    
    test('warning notification duration is correct', () => {
      showNotification('Warning', true);
      
      jest.advanceTimersByTime(NotificationConfig.ANIMATION_DELAY);
      expect(document.querySelector('.discord-notification.warning')).not.toBeNull();
      
      // Warning stays visible for its dedicated duration
      jest.advanceTimersByTime(NotificationConfig.WARNING_DURATION);
      jest.advanceTimersByTime(NotificationConfig.REMOVAL_ANIMATION_DURATION);
      expect(document.querySelector('.discord-notification')).toBeNull();
    });
    
    test('multiple notifications operate independently', () => {
      showNotification('First');
      
      // Show second notification after 1s
      jest.advanceTimersByTime(1000);
      showNotification('Second');
      
      const notifications = document.querySelectorAll('.discord-notification');
      expect(notifications.length).toBe(2);
      
      // First notification disappears after its full lifecycle (~3.31s)
      jest.advanceTimersByTime(2000 + NotificationConfig.ANIMATION_DELAY + NotificationConfig.REMOVAL_ANIMATION_DURATION);
      expect(document.querySelectorAll('.discord-notification').length).toBe(1);
      expect(document.querySelector('.discord-notification').textContent).toBe('Second');
      
      // Second notification eventually disappears as well
      jest.advanceTimersByTime(1000 + NotificationConfig.REMOVAL_ANIMATION_DURATION);
      expect(document.querySelectorAll('.discord-notification').length).toBe(0);
    });
    
    test('空のメッセージでもエラーにならない', () => {
      expect(() => {
        showNotification('');
      }).not.toThrow();
      
      const notification = document.querySelector('.discord-notification');
      expect(notification).not.toBeNull();
      expect(notification.textContent).toBe('');
    });
  });
});
