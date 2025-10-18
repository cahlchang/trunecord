(function (global) {
  if (global.__TRUNECORD_STATE_MANAGER__) {
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = global.__TRUNECORD_STATE_MANAGER__;
    }
    return;
  }

  const STORAGE_KEY = 'trunecordStreamingState';

function createStateManager(storage = {}) {
  const session = storage && storage.session;
  const persistent = storage && (storage.local || storage.persistent);

  const hasSession = session && typeof session.get === 'function' && typeof session.set === 'function';
  const hasPersistent = !hasSession && persistent && typeof persistent.get === 'function' && typeof persistent.set === 'function';
  const fallbackState = { value: null };

    async function save(tabId) {
      if (tabId == null) {
        return clear();
      }

    if (hasSession) {
      try {
        await session.set(STORAGE_KEY, { tabId, timestamp: Date.now() });
      } catch (error) {
        console.error('Failed to persist streaming state:', error);
      }
    } else if (hasPersistent) {
      try {
        await persistent.set(STORAGE_KEY, { tabId, timestamp: Date.now() });
      } catch (error) {
        console.error('Failed to persist streaming state:', error);
      }
    } else {
      fallbackState.value = { tabId, timestamp: Date.now() };
    }
  }

  async function restore() {
    const storageTarget = hasSession ? session : hasPersistent ? persistent : null;
    if (storageTarget) {
      try {
        const value = await storageTarget.get(STORAGE_KEY);
        return value ? value.tabId ?? null : null;
      } catch (error) {
        console.error('Failed to restore streaming state:', error);
        return null;
      }
      }
      return fallbackState.value ? fallbackState.value.tabId ?? null : null;
    }

    async function clear() {
    if (hasSession) {
      try {
        if (typeof session.remove === 'function') {
          await session.remove(STORAGE_KEY);
        } else {
          await session.set(STORAGE_KEY, null);
        }
      } catch (error) {
        console.error('Failed to clear streaming state:', error);
      }
    } else if (hasPersistent) {
      try {
        if (typeof persistent.remove === 'function') {
          await persistent.remove(STORAGE_KEY);
        } else {
          await persistent.set(STORAGE_KEY, null);
        }
      } catch (error) {
        console.error('Failed to clear streaming state:', error);
      }
    } else {
      fallbackState.value = null;
    }
  }

    return {
      save,
      restore,
      clear,
    };
  }

  const exported = {
    createStateManager,
    STORAGE_KEY,
  };

  global.__TRUNECORD_STATE_MANAGER__ = exported;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  } else {
    global.createStateManager = createStateManager;
    global.STATE_MANAGER_STORAGE_KEY = STORAGE_KEY;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
