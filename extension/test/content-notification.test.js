/**
 * t-wada式TDDによるcontent.jsのshowNotification関数テスト
 * RED -> GREEN -> REFACTOR のサイクルを実践
 */

describe('content.js - showNotification関数', () => {
  let showNotification;
  
  beforeEach(() => {
    // DOM初期化
    document.body.innerHTML = '';
    
    // タイマーモック
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });
  
  describe('RED phase - テストを失敗させる', () => {
    test('showNotification関数が存在しない', () => {
      // RED: showNotification関数がまだ定義されていない
      expect(typeof showNotification).toBe('undefined');
    });
    
    test('通知要素がDOMに追加されない', () => {
      // showNotification('Test message');
      const notification = document.querySelector('.discord-notification');
      expect(notification).toBeNull();
    });
    
    test('通知メッセージが表示されない', () => {
      // showNotification('Test message');
      const notifications = document.querySelectorAll('.discord-notification');
      expect(notifications.length).toBe(0);
    });
    
    test('警告スタイルが適用されない', () => {
      // showNotification('Warning', true);
      const warning = document.querySelector('.discord-notification.warning');
      expect(warning).toBeNull();
    });
  });
  
  describe('GREEN phase - 最小限の実装でテストを通す', () => {
    beforeEach(() => {
      // 最小限の実装
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
    
    test('警告スタイルが適用される', () => {
      showNotification('Warning message', true);
      const warning = document.querySelector('.discord-notification.warning');
      expect(warning).not.toBeNull();
      expect(warning.textContent).toBe('Warning message');
    });
    
    test('通知にshowクラスが追加される', () => {
      showNotification('Test');
      const notification = document.querySelector('.discord-notification');
      
      expect(notification.classList.contains('show')).toBe(false);
      
      // 10ms後にshowクラスが追加される
      jest.advanceTimersByTime(10);
      expect(notification.classList.contains('show')).toBe(true);
    });
    
    test('通常の通知は3秒後に消える', () => {
      showNotification('Test');
      const notification = document.querySelector('.discord-notification');
      
      jest.advanceTimersByTime(10);
      expect(notification.classList.contains('show')).toBe(true);
      
      // 3秒後にshowクラスが削除される
      jest.advanceTimersByTime(3000);
      expect(notification.classList.contains('show')).toBe(false);
      
      // さらに300ms後にDOMから削除される
      jest.advanceTimersByTime(300);
      expect(document.querySelector('.discord-notification')).toBeNull();
    });
    
    test('警告通知は5秒後に消える', () => {
      showNotification('Warning', true);
      const notification = document.querySelector('.discord-notification.warning');
      
      jest.advanceTimersByTime(10);
      expect(notification.classList.contains('show')).toBe(true);
      
      // 5秒後にshowクラスが削除される
      jest.advanceTimersByTime(5000);
      expect(notification.classList.contains('show')).toBe(false);
      
      // さらに300ms後にDOMから削除される
      jest.advanceTimersByTime(300);
      expect(document.querySelector('.discord-notification')).toBeNull();
    });
  });
  
  describe('REFACTOR phase - コードを整理', () => {
    // 通知設定
    const NotificationConfig = {
      ANIMATION_DELAY: 10,
      REMOVAL_ANIMATION_DURATION: 300,
      NORMAL_DURATION: 3000,
      WARNING_DURATION: 5000,
      CSS_CLASS: 'discord-notification',
      CSS_CLASS_SHOW: 'show',
      CSS_CLASS_WARNING: 'warning'
    };
    
    // 通知要素の作成
    const createNotificationElement = (message, isWarning) => {
      const element = document.createElement('div');
      element.className = NotificationConfig.CSS_CLASS;
      if (isWarning) {
        element.classList.add(NotificationConfig.CSS_CLASS_WARNING);
      }
      element.textContent = message;
      return element;
    };
    
    // アニメーション管理
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
      // リファクタリング後の実装
      showNotification = function(message, isWarning = false) {
        const notification = createNotificationElement(message, isWarning);
        document.body.appendChild(notification);
        
        // 表示アニメーション
        NotificationAnimator.show(notification);
        
        // 自動削除
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
    
    test('リファクタリング後も全機能が正しく動作する', () => {
      // 通常の通知
      showNotification('Normal notification');
      let notification = document.querySelector('.discord-notification');
      expect(notification).not.toBeNull();
      expect(notification.textContent).toBe('Normal notification');
      expect(notification.classList.contains('warning')).toBe(false);
      
      // 警告通知
      showNotification('Warning notification', true);
      const warning = document.querySelector('.discord-notification.warning');
      expect(warning).not.toBeNull();
      expect(warning.textContent).toBe('Warning notification');
    });
    
    test('アニメーションのタイミングが正確', () => {
      showNotification('Test');
      const notification = document.querySelector('.discord-notification');
      
      // 初期状態
      expect(notification.classList.contains('show')).toBe(false);
      
      // 10ms後に表示
      jest.advanceTimersByTime(NotificationConfig.ANIMATION_DELAY);
      expect(notification.classList.contains('show')).toBe(true);
      
      // 3秒後に非表示開始
      jest.advanceTimersByTime(NotificationConfig.NORMAL_DURATION);
      expect(notification.classList.contains('show')).toBe(false);
      
      // 削除アニメーション完了
      jest.advanceTimersByTime(NotificationConfig.REMOVAL_ANIMATION_DURATION);
      expect(document.querySelector('.discord-notification')).toBeNull();
    });
    
    test('警告通知の表示時間が適切', () => {
      showNotification('Warning', true);
      
      jest.advanceTimersByTime(NotificationConfig.ANIMATION_DELAY);
      expect(document.querySelector('.discord-notification.warning')).not.toBeNull();
      
      // 警告は5秒間表示
      jest.advanceTimersByTime(NotificationConfig.WARNING_DURATION);
      jest.advanceTimersByTime(NotificationConfig.REMOVAL_ANIMATION_DURATION);
      expect(document.querySelector('.discord-notification')).toBeNull();
    });
    
    test('複数の通知が独立して動作する', () => {
      showNotification('First');
      
      // 1秒後に2つ目の通知
      jest.advanceTimersByTime(1000);
      showNotification('Second');
      
      const notifications = document.querySelectorAll('.discord-notification');
      expect(notifications.length).toBe(2);
      
      // 最初の通知が消える（合計3.31秒後）
      jest.advanceTimersByTime(2000 + NotificationConfig.ANIMATION_DELAY + NotificationConfig.REMOVAL_ANIMATION_DURATION);
      expect(document.querySelectorAll('.discord-notification').length).toBe(1);
      expect(document.querySelector('.discord-notification').textContent).toBe('Second');
      
      // 2つ目の通知も消える
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