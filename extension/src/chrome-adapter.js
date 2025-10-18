(function (global) {
  if (global.__TRUNECORD_CHROME_ADAPTER__) {
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = global.__TRUNECORD_CHROME_ADAPTER__;
    }
    return;
  }

  function withRuntimeErrorHandling(chromeRuntime, resolve, reject) {
    if (chromeRuntime && chromeRuntime.lastError && typeof chromeRuntime.lastError.message === 'string') {
      reject(new Error(chromeRuntime.lastError.message));
    } else {
      resolve();
    }
  }

  function createChromeAdapter(chromeGlobal = typeof chrome !== 'undefined' ? chrome : null, WebSocketCtor = typeof WebSocket !== 'undefined' ? WebSocket : null) {
    const chrome = chromeGlobal || {};

    function createWebSocket(url) {
      if (!WebSocketCtor) {
        throw new Error('WebSocket API is not available');
      }
      const socket = new WebSocketCtor(url);
      if (Object.prototype.hasOwnProperty.call(WebSocketCtor, 'lastInstance')) {
        WebSocketCtor.lastInstance = socket;
      }
      return socket;
    }

    const offscreen = {
      async hasDocument() {
        if (!chrome.offscreen || typeof chrome.offscreen.hasDocument !== 'function') {
          return false;
        }
        return chrome.offscreen.hasDocument();
      },

      async createDocument(options) {
        if (!chrome.offscreen || typeof chrome.offscreen.createDocument !== 'function') {
          throw new Error('Offscreen API not available');
        }
        return chrome.offscreen.createDocument(options);
      },

      async closeDocument() {
        if (!chrome.offscreen || typeof chrome.offscreen.closeDocument !== 'function') {
          return;
        }
        return chrome.offscreen.closeDocument();
      },
    };

    const tabCapture = {
      async getMediaStreamId(options) {
        if (!chrome.tabCapture || typeof chrome.tabCapture.getMediaStreamId !== 'function') {
          throw new Error('tabCapture API not available');
        }
        return chrome.tabCapture.getMediaStreamId(options);
      },
    };

    const runtime = {
      getManifest() {
        if (chrome.runtime && typeof chrome.runtime.getManifest === 'function') {
          return chrome.runtime.getManifest();
        }
        return { version: '0.0.0' };
      },

      getURL(path) {
        if (chrome.runtime && typeof chrome.runtime.getURL === 'function') {
          return chrome.runtime.getURL(path);
        }
        return path;
      },

      get id() {
        if (chrome.runtime && typeof chrome.runtime.id === 'string' && chrome.runtime.id.length > 0) {
          return chrome.runtime.id;
        }
        return null;
      },

      async sendMessage(message) {
        if (!chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
          throw new Error('runtime.sendMessage is not available');
        }
        return new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime && chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            resolve(response);
          });
        });
      },

      addMessageListener(handler) {
        chrome.runtime?.onMessage?.addListener(handler);
      },

      addInstalledListener(handler) {
        chrome.runtime?.onInstalled?.addListener?.(handler);
      },

      addStartupListener(handler) {
        chrome.runtime?.onStartup?.addListener?.(handler);
      },

      addSuspendListener(handler) {
        chrome.runtime?.onSuspend?.addListener?.(handler);
      },
    };

    const tabs = {
      async query(queryInfo) {
        if (!chrome.tabs || typeof chrome.tabs.query !== 'function') {
          return [];
        }
        return new Promise((resolve, reject) => {
          chrome.tabs.query(queryInfo, (result) => {
            withRuntimeErrorHandling(chrome.runtime, () => resolve(result || []), reject);
          });
        });
      },

      async sendMessage(tabId, message) {
        if (!chrome.tabs || typeof chrome.tabs.sendMessage !== 'function') {
          return;
        }
        return new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(tabId, message, () => {
            withRuntimeErrorHandling(chrome.runtime, resolve, reject);
          });
        });
      },

      addRemovedListener(handler) {
        chrome.tabs?.onRemoved?.addListener?.(handler);
      },
    };

    const notifications = {
      create(id, options) {
        if (!chrome.notifications || typeof chrome.notifications.create !== 'function') {
          return Promise.resolve();
        }
        return chrome.notifications.create(id, options);
      },
    };

  const storageSession = chrome.storage?.session;
  const storageLocal = chrome.storage?.local;

  const storage = {};

  if (storageSession) {
    storage.session = {
      async get(key) {
        return new Promise((resolve, reject) => {
          storageSession.get(key, (result) => {
            if (chrome.runtime && chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            resolve(result ? result[key] : null);
          });
        });
      },
      async set(key, value) {
        return new Promise((resolve, reject) => {
          storageSession.set({ [key]: value }, () => {
            withRuntimeErrorHandling(chrome.runtime, resolve, reject);
          });
        });
      },
      async remove(key) {
        if (typeof storageSession.remove === 'function') {
          return new Promise((resolve, reject) => {
            storageSession.remove(key, () => {
              withRuntimeErrorHandling(chrome.runtime, resolve, reject);
            });
          });
        }
        return new Promise((resolve, reject) => {
          storageSession.set({ [key]: null }, () => {
            withRuntimeErrorHandling(chrome.runtime, resolve, reject);
          });
        });
      },
    };
  }

  if (storageLocal) {
    storage.local = {
      async get(key) {
        return new Promise((resolve, reject) => {
          storageLocal.get(key, (result) => {
            if (chrome.runtime && chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            resolve(result ? result[key] : null);
          });
        });
      },
      async set(key, value) {
        return new Promise((resolve, reject) => {
          storageLocal.set({ [key]: value }, () => {
            withRuntimeErrorHandling(chrome.runtime, resolve, reject);
          });
        });
      },
      async remove(key) {
        return new Promise((resolve, reject) => {
          storageLocal.remove(key, () => {
            withRuntimeErrorHandling(chrome.runtime, resolve, reject);
          });
        });
      },
    };
  }

  const hasStorage = Object.keys(storage).length > 0 ? storage : null;

    return {
      createWebSocket,
      offscreen,
      tabCapture,
      runtime,
      tabs,
      notifications,
    storage: hasStorage,
  };
}

  global.__TRUNECORD_CHROME_ADAPTER__ = createChromeAdapter;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createChromeAdapter;
  } else {
    global.createChromeAdapter = createChromeAdapter;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
