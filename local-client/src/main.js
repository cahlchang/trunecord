require('dotenv').config();
const { app, BrowserWindow, ipcMain, shell, net } = require('electron');
const express = require('express');
const path = require('path');
const Store = require('electron-store');
const { WebSocketServer } = require('ws');
const DiscordStreamer = require('./discord-streamer');

const store = new Store();
const streamer = new DiscordStreamer();

let mainWindow;
let wss;
let authServer;

// Create main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
  
  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// WebSocket server for Chrome extension communication
function startWebSocketServer() {
  wss = new WebSocketServer({ port: 8765 });
  
  wss.on('connection', (ws) => {
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        
        switch (data.type) {
          case 'audio':
            if (streamer.isConnected()) {
              streamer.sendAudio(data.audio);
            }
            break;
            
          case 'status':
            ws.send(JSON.stringify({
              type: 'status',
              connected: streamer.isConnected(),
              streaming: streamer.isStreaming()
            }));
            break;
        }
      } catch (error) {
        // WebSocket message error
      }
    });
    
    ws.on('close', () => {
      // Chrome extension disconnected
    });
  });
  
}

// IPC handlers
ipcMain.handle('get-stored-data', () => {
  return {
    token: store.get('authToken'),
    guilds: store.get('guilds', []),
    selectedGuild: store.get('selectedGuild'),
    selectedChannel: store.get('selectedChannel')
  };
});

ipcMain.handle('save-auth-data', (event, data) => {
  store.set('authToken', data.token);
  store.set('guilds', data.guilds);
  return { success: true };
});

ipcMain.handle('save-selection', (event, data) => {
  store.set('selectedGuild', data.guildId);
  store.set('selectedChannel', data.channelId);
  return { success: true };
});

ipcMain.handle('start-auth-flow', () => {
  shell.openExternal('https://zbpkdtnjzg.execute-api.ap-northeast-1.amazonaws.com/prod/api/auth');
  return { success: true };
});

ipcMain.handle('connect-discord', async (event, data) => {
  try {
    const token = store.get('authToken');
    
    if (!token) {
      throw new Error('No authentication token found. Please login first.');
    }
    
    
    // Get bot token from environment variable
    const botToken = process.env.DISCORD_BOT_TOKEN;
    
    if (!botToken) {
      throw new Error('Bot token not found. Please set DISCORD_BOT_TOKEN environment variable.');
    }
    
    
    await streamer.connect(botToken, data.guildId, data.channelId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('disconnect-discord', async () => {
  try {
    await streamer.disconnect();
    return { success: true };
  } catch (error) {
    console.error('Failed to disconnect from Discord:', error);
    return { success: false, error: error.message };
  }
});


ipcMain.handle('get-channels', async (event, guildId) => {
  try {
    const token = store.get('authToken');
    
    const response = await new Promise((resolve, reject) => {
      const request = net.request({
        method: 'GET',
        url: `https://zbpkdtnjzg.execute-api.ap-northeast-1.amazonaws.com/prod/api/guilds/${guildId}/channels`,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      let responseData = '';
      
      request.on('response', (response) => {
        response.on('data', (chunk) => {
          responseData += chunk;
        });
        
        response.on('end', () => {
          if (response.statusCode === 200) {
            resolve({ ok: true, json: () => JSON.parse(responseData) });
          } else {
            resolve({ ok: false });
          }
        });
      });
      
      request.on('error', (error) => {
        reject(error);
      });
      
      request.end();
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch channels');
    }
    
    const data = response.json();
    return { success: true, channels: data.channels };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// App event handlers
app.whenReady().then(() => {
  createWindow();
  startWebSocketServer();
  startAuthCallbackServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Start local auth callback server
function startAuthCallbackServer() {
  const authApp = express();
  
  authApp.get('/auth/success', (req, res) => {
    const token = req.query.token;
    const guilds = req.query.guilds;
    
    if (token && guilds) {
      const guildsData = JSON.parse(decodeURIComponent(guilds));
      
      // Send to renderer
      mainWindow.webContents.send('auth-success', { token, guilds: guildsData });
      
      // Close this window/tab
      res.send('<html><body><script>window.close();</script><p>Authentication successful! You can close this window.</p></body></html>');
    } else {
      res.status(400).send('Missing token or guilds data');
    }
  });
  
  authApp.get('/auth/error', (req, res) => {
    res.send('<html><body><p>Authentication failed. Please try again.</p></body></html>');
  });
  
  authServer = authApp.listen(48766, () => {
    // Auth callback server listening
  });
}

app.on('before-quit', () => {
  if (authServer) {
    authServer.close();
  }
});