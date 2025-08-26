const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const app = express();

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

app.use(express.json());

// Rate limiting - very relaxed (16 hours continuous use)
const voiceRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 100, // 100 requests per minute (very generous)
  message: 'Too many voice connection requests. Please wait a moment.',
  standardHeaders: true,
  legacyHeaders: false,
});

const generalApiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 200, // 200 requests per minute
  message: 'Too many API requests. Please wait a moment.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to specific routes
app.use('/api/voice/', voiceRateLimit);
app.use('/api/', generalApiRateLimit);

// Simple memory cache
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour cache

// Cache helper functions
const getCacheKey = (type, userId, extra = '') => `${type}:${userId}:${extra}`;

const getFromCache = (key) => {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    console.log(`Cache hit for ${key}`);
    return cached.data;
  }
  if (cached) {
    cache.delete(key); // Clean up expired entries
  }
  return null;
};

const setCache = (key, data, ttl = CACHE_TTL) => {
  cache.set(key, {
    data,
    expires: Date.now() + ttl
  });
  console.log(`Cached ${key} for ${ttl/1000} seconds`);
};

// Helper functions
const generateState = () => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};

// Routes

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Music to Discord Auth Server',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      callback: '/api/callback',
      verify: '/api/verify'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Auth endpoint - redirects to Discord OAuth
app.get('/api/auth', (req, res) => {
  const state = generateState();
  
  // Check if client wants custom protocol redirect
  const redirectProtocol = req.query.redirect_protocol;
  const useProtocol = redirectProtocol === 'trunecord';
  const useHttp = redirectProtocol === 'http';
  
  console.log('[AUTH] Request params:', req.query);
  console.log('[AUTH] Redirect protocol:', redirectProtocol);
  console.log('[AUTH] Use protocol:', useProtocol);
  console.log('[AUTH] Use HTTP:', useHttp);
  
  // Store protocol preference in state (encode it)
  const stateData = {
    random: state,
    protocol: redirectProtocol || null
  };
  const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64');
  
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
    state: encodedState
  });
  
  console.log('[AUTH] State data:', stateData);
  console.log('[AUTH] Redirecting to Discord OAuth');
  
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

// OAuth callback
app.get('/api/callback', async (req, res) => {
  const { code, state } = req.query;
  
  if (!code) {
    return res.status(400).json({ error: 'No code provided' });
  }
  
  // Decode state to check for protocol preference
  let useProtocol = false;
  let useHttp = false;
  try {
    if (state) {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      useProtocol = stateData.protocol === 'trunecord';
      useHttp = stateData.protocol === 'http';
      console.log('[CALLBACK] Decoded state:', stateData);
      console.log('[CALLBACK] Use protocol:', useProtocol);
      console.log('[CALLBACK] Use HTTP:', useHttp);
    } else {
      console.log('[CALLBACK] No state provided');
    }
  } catch (e) {
    // If state parsing fails, default to no protocol
    console.log('[CALLBACK] State parsing failed:', e.message);
    console.log('[CALLBACK] Using default redirect');
  }
  
  try {
    // Exchange code for token
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', 
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.REDIRECT_URI
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const { access_token } = tokenResponse.data;
    
    // Get user info
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });
    
    // Get user's guilds where bot is present
    const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });
    
    // Filter guilds where our bot is present
    const botGuilds = await getBotGuilds();
    const userGuilds = guildsResponse.data;
    const commonGuilds = userGuilds.filter(userGuild => 
      botGuilds.some(botGuild => botGuild.id === userGuild.id)
    );
    
    // Create JWT token
    const token = jwt.sign({
      userId: userResponse.data.id,
      username: userResponse.data.username,
      discriminator: userResponse.data.discriminator
    }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    // Check if we should use HTTP redirect (for local development)
    if (useHttp) {
      // Redirect to localhost:48766 for local development
      const httpUrl = new URL('http://localhost:48766/auth/callback');
      httpUrl.searchParams.append('token', token);
      httpUrl.searchParams.append('guilds', JSON.stringify(commonGuilds));
      
      console.log('[CALLBACK] Using HTTP redirect:', httpUrl.toString());
      
      // Direct redirect to localhost
      res.redirect(httpUrl.toString());
    } else if (useProtocol) {
      // Redirect to custom protocol URL for desktop app
      const protocolUrl = new URL('trunecord://auth/callback');
      protocolUrl.searchParams.append('token', token);
      protocolUrl.searchParams.append('guilds', JSON.stringify(commonGuilds));
      
      console.log('[CALLBACK] Using protocol redirect:', protocolUrl.toString());
      
      // Use HTML page with JavaScript redirect for protocol handling
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Redirecting to trunecord...</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 10px;
              backdrop-filter: blur(10px);
            }
            h1 { margin-bottom: 1rem; }
            p { margin: 0.5rem 0; }
            a {
              color: white;
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Authentication Successful!</h1>
            <p>Redirecting to trunecord app...</p>
            <p>If the app doesn't open automatically, <a href="${protocolUrl.toString()}">click here</a></p>
            <p style="margin-top: 2rem; font-size: 0.9em;">You can close this window after the app opens.</p>
          </div>
          <script>
            // Attempt to redirect to the custom protocol
            window.location.href = "${protocolUrl.toString()}";
            
            // Show manual link after 2 seconds
            setTimeout(() => {
              document.querySelector('a').style.display = 'inline';
            }, 2000);
          </script>
        </body>
        </html>
      `);
    } else {
      // Original behavior: redirect to GUI app via protocol
      const protocolUrl = new URL('/auth/callback', process.env.FRONTEND_URL);
      protocolUrl.searchParams.append('token', token);
      protocolUrl.searchParams.append('guilds', JSON.stringify(commonGuilds));
      
      console.log('[CALLBACK] Using default redirect:', protocolUrl.toString());
      console.log('[CALLBACK] FRONTEND_URL:', process.env.FRONTEND_URL);
      
      // Use HTML page with JavaScript redirect for protocol handling
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Redirecting to trunecord...</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 10px;
              backdrop-filter: blur(10px);
            }
            h1 { margin-bottom: 1rem; }
            p { margin: 0.5rem 0; }
            a {
              color: white;
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Authentication Successful!</h1>
            <p>Redirecting to trunecord app...</p>
            <p>If the app doesn't open automatically, <a href="${protocolUrl.toString()}">click here</a></p>
            <p style="margin-top: 2rem; font-size: 0.9em;">You can close this window after the app opens.</p>
          </div>
          <script>
            // Attempt to redirect to the custom protocol
            window.location.href = "${protocolUrl.toString()}";
            
            // Show manual link after 2 seconds
            setTimeout(() => {
              document.querySelector('a').style.display = 'inline';
            }, 2000);
          </script>
        </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('OAuth error:', error);
    
    // Check if using custom protocol
    if (useProtocol) {
      // Return error page for protocol
      const errorUrl = 'trunecord://auth/error?error=' + encodeURIComponent(error.message || 'Authentication failed');
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Error</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: #f44336;
              color: white;
            }
            .container {
              text-align: center;
              padding: 2rem;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Authentication Failed</h1>
            <p>Please close this window and try again.</p>
          </div>
          <script>
            window.location.href = "${errorUrl}";
          </script>
        </body>
        </html>
      `);
    } else {
      res.status(500).json({ error: 'Authentication failed' });
    }
  }
});

// Verify token
app.get('/api/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
});


// Get guilds list (protected endpoint with caching)
app.get('/api/guilds', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    // No token provided - check if this is a desktop app request
    console.log('[GUILDS] No auth token provided');
    
    // Check cache for bot guilds
    const cacheKey = 'bot-guilds';
    const cached = getFromCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    // For desktop app, we don't need user token since bot token is on server
    try {
      const botGuilds = await getBotGuilds();
      setCache(cacheKey, botGuilds, CACHE_TTL);
      res.json(botGuilds);
    } catch (error) {
      console.error('[GUILDS] Error getting bot guilds:', error);
      res.status(500).json({ error: 'Failed to get guilds' });
    }
    return;
  }
  
  try {
    // Verify JWT token if provided
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded.id;
    
    // Check cache for user guilds
    const cacheKey = getCacheKey('guilds', userId);
    const cached = getFromCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    // Get bot's guilds
    const botGuilds = await getBotGuilds();
    setCache(cacheKey, botGuilds, CACHE_TTL);
    res.json(botGuilds);
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      res.status(500).json({ error: 'Failed to get guilds' });
    }
  }
});

// Get guild channels (with caching)
app.get('/api/guilds/:guildId/channels', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { guildId } = req.params;
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded.id;
    
    // Check cache for channels
    const cacheKey = getCacheKey('channels', userId, guildId);
    const cached = getFromCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    // Get guild channels using bot token
    const response = await axios.get(`https://discord.com/api/guilds/${guildId}/channels`, {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`
      }
    });
    
    // Filter voice channels
    const voiceChannels = response.data
      .filter(channel => channel.type === 2) // Type 2 = GUILD_VOICE
      .map(channel => ({
        id: channel.id,
        name: channel.name,
        position: channel.position
      }))
      .sort((a, b) => a.position - b.position);
    
    // Cache the result
    const result = { channels: voiceChannels };
    setCache(cacheKey, result, CACHE_TTL);
    
    res.json(result);
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      res.status(500).json({ error: 'Failed to get channels' });
    }
  }
});

// Get bot token (protected endpoint - disabled by default for security)
app.get('/api/bot-token', async (req, res) => {
  // Security: Disable by default unless explicitly enabled
  if (process.env.ENABLE_BOT_TOKEN_ENDPOINT !== 'true') {
    return res.status(403).json({ 
      error: 'Bot token endpoint disabled for security. Use voice proxy endpoints instead.',
      alternatives: ['/api/voice/connect', '/api/voice/disconnect']
    });
  }
  
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Log access for security auditing
    console.log(`⚠️ Bot token accessed by user ${decoded.userId} at ${new Date().toISOString()}`);
    
    // Return bot token over HTTPS
    // The token is protected by:
    // 1. JWT authentication requirement
    // 2. HTTPS encryption in transit
    // 3. Client-side memory-only storage (no persistence)
    res.json({ 
      botToken: process.env.DISCORD_BOT_TOKEN,
      warning: 'This token must not be stored persistently. Keep it in memory only.',
      deprecated: 'This endpoint is deprecated. Please use voice proxy endpoints instead.'
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      res.status(500).json({ error: 'Failed to get bot token' });
    }
  }
});

// Voice channel connection proxy (replaces direct bot token usage)
app.post('/api/voice/connect', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { guildId, channelId } = req.body;
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  if (!guildId || !channelId) {
    return res.status(400).json({ error: 'Missing guildId or channelId' });
  }
  
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded.id;
    
    console.log(`Voice connect: User ${userId} connecting to ${guildId}/${channelId}`);
    
    // Note: Discord doesn't have a direct REST API for bot voice connections
    // This endpoint returns success and expects the client to handle WebSocket voice connection
    // The actual voice connection happens through Discord Gateway (WebSocket)
    
    // Store connection info in cache for tracking
    const cacheKey = getCacheKey('voice-connection', userId);
    setCache(cacheKey, { guildId, channelId, connectedAt: Date.now() }, 16 * 60 * 60 * 1000); // 16 hours
    
    res.json({ 
      success: true,
      message: 'Voice connection initiated. Client should establish WebSocket connection.',
      guildId,
      channelId
    });
  } catch (error) {
    console.error('Voice connect error:', error);
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      res.status(500).json({ error: 'Failed to connect to voice channel' });
    }
  }
});

// Voice channel disconnect proxy
app.post('/api/voice/disconnect', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { guildId } = req.body;
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded.id;
    
    console.log(`Voice disconnect: User ${userId} disconnecting from ${guildId}`);
    
    // Clear connection cache
    const cacheKey = getCacheKey('voice-connection', userId);
    cache.delete(cacheKey);
    
    res.json({ 
      success: true,
      message: 'Voice disconnection initiated',
      guildId
    });
  } catch (error) {
    console.error('Voice disconnect error:', error);
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      res.status(500).json({ error: 'Failed to disconnect from voice channel' });
    }
  }
});

// Helper function to get bot's guilds
async function getBotGuilds() {
  try {
    const response = await axios.get('https://discord.com/api/users/@me/guilds', {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`
      }
    });
    return response.data;
  } catch (error) {
    return [];
  }
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Export handler for Lambda
module.exports.handler = serverless(app);