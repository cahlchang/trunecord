const ROOT_SCOPE = typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this;

let createChromeAdapter;
let createBackground;

const hasRequire = typeof require === 'function'
  && (() => {
      try {
        return typeof require('module') === 'function';
      } catch (error) {
        return false;
      }
    })();

if (hasRequire) {
  createChromeAdapter = require('./chrome-adapter');
  createBackground = require('./background-core');
} else {
  importScripts('./state-manager.js', './chrome-adapter.js', './background-core.js');
  createChromeAdapter = ROOT_SCOPE.createChromeAdapter;
  createBackground = ROOT_SCOPE.createBackground;
}

if (typeof createChromeAdapter !== 'function' || typeof createBackground !== 'function') {
  throw new Error('Failed to initialize background modules');
}

const adapter = createChromeAdapter();
const background = createBackground(adapter);

background.registerEventListeners();
background.resumeFromSavedState?.().catch(() => {});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = background;
}
