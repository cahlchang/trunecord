const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Auth methods
  startAuthFlow: () => ipcRenderer.invoke('start-auth-flow'),
  saveAuthData: (data) => ipcRenderer.invoke('save-auth-data', data),
  
  // Storage methods
  getStoredData: () => ipcRenderer.invoke('get-stored-data'),
  saveSelection: (data) => ipcRenderer.invoke('save-selection', data),
  
  // Discord methods
  connectDiscord: (data) => ipcRenderer.invoke('connect-discord', data),
  disconnectDiscord: () => ipcRenderer.invoke('disconnect-discord'),
  getChannels: (guildId) => ipcRenderer.invoke('get-channels', guildId),
  
  // Event listeners
  onAuthSuccess: (callback) => {
    ipcRenderer.on('auth-success', (event, data) => callback(data));
  },
  
  // Test methods
  sendTestAudio: () => ipcRenderer.invoke('send-test-audio')
});