const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const app = express();

// CORS configuration - allow localhost for development
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or same-origin)
    if (!origin) return callback(null, true);

    // Allow localhost for development
    if (origin.startsWith('http://localhost:') || 
        origin.startsWith('https://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.startsWith('https://127.0.0.1:')) {
      return callback(null, true);
    }

    // Allow configured frontend URL
    if (process.env.FRONTEND_URL) {
      if (process.env.FRONTEND_URL === '*') {
        console.error('[CORS] FRONTEND_URL="*" is not permitted for security reasons');
        return callback(new Error('Not allowed by CORS'));
      }
      if (origin === process.env.FRONTEND_URL) {
        return callback(null, true);
      }
    }


    // Reject other origins
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

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
// Note: More specific routes must come before general routes
app.use('/api/voice/', voiceRateLimit); // 100 req/min for voice endpoints
app.use('/api/', generalApiRateLimit);  // 200 req/min for general API

// Helper functions
const generateState = () => {
  // Use crypto.randomBytes for secure random generation
  return crypto.randomBytes(16).toString('hex');
};

const createSecureState = (data) => {
  // Create JWT-signed state for OAuth security
  return jwt.sign(data, process.env.JWT_SECRET, { expiresIn: '10m' });
};

const verifySecureState = (stateToken) => {
  try {
    return jwt.verify(stateToken, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired state token');
  }
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
  const randomState = generateState();
  
  // Always use HTTP redirect for localhost development
  const useHttp = true;
  
  // Store state data in secure JWT-signed state
  const stateData = {
    random: randomState,
    timestamp: Date.now()
  };
  const secureState = createSecureState(stateData);
  
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
    state: secureState
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
  
  if (!state) {
    return res.status(400).json({ error: 'No state provided - potential CSRF attack' });
  }
  
  // Verify JWT-signed state for CSRF protection
  const useHttp = true;
  try {
    const stateData = verifySecureState(state);
    console.log('[CALLBACK] Verified state:', stateData);
  } catch (e) {
    console.error('[CALLBACK] State verification failed:', e.message);
    return res.status(400).json({ error: 'Invalid state parameter - potential CSRF attack' });
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
    
    // Create JWT token with guild information
    const token = jwt.sign({
      userId: userResponse.data.id,
      username: userResponse.data.username,
      discriminator: userResponse.data.discriminator,
      // Store the list of guild IDs where both user and bot are present
      guildIds: commonGuilds.map(g => g.id)
    }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    // Always redirect to localhost:48766 for local development
    const httpUrl = new URL('http://localhost:48766/auth/callback');
    httpUrl.searchParams.append('token', token);
    httpUrl.searchParams.append('guilds', JSON.stringify(commonGuilds));
    
    // Do not log sensitive query values
    console.log('[CALLBACK] Redirecting to http://localhost:48766/auth/callback (query redacted)');
    
    // Direct redirect to localhost
    res.redirect(httpUrl.toString());
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
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


// Get guilds list (protected endpoint - returns user's authorized guilds only)
app.get('/api/guilds', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  // Security: JWT token is required to prevent information leakage
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get bot's guilds
    const botGuilds = await getBotGuilds();
    
    // Filter to only return guilds the user has access to
    // Use the guild IDs stored in the JWT token (set during OAuth callback)
    let authorizedGuilds = botGuilds;
    
    if (decoded.guildIds && Array.isArray(decoded.guildIds)) {
      // Return only guilds that are both in bot's guilds and user's authorized guilds
      authorizedGuilds = botGuilds.filter(guild => 
        decoded.guildIds.includes(guild.id)
      );
    } else {
      // Legacy tokens without guildIds - return empty for security
      console.warn(`User ${decoded.userId} has legacy token without guild information`);
      return res.json([]);
    }
    
    res.json(authorizedGuilds);
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.name === 'NotBeforeError') {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      res.status(500).json({ error: 'Failed to get guilds' });
    }
  }
});

// Get guild channels
app.get('/api/guilds/:guildId/channels', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { guildId } = req.params;
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    // Verify JWT token and check guild authorization
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Security: Verify user has access to this guild
    if (!decoded.guildIds || !Array.isArray(decoded.guildIds) || !decoded.guildIds.includes(guildId)) {
      return res.status(403).json({ error: 'Access denied: User is not authorized for this guild' });
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
    
    res.json({ channels: voiceChannels });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.name === 'NotBeforeError') {
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
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.name === 'NotBeforeError') {
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
    // Verify JWT token and check guild authorization
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded.id;
    
    // Security: Verify user has access to this guild
    if (!decoded.guildIds || !Array.isArray(decoded.guildIds) || !decoded.guildIds.includes(guildId)) {
      return res.status(403).json({ error: 'Access denied: User is not authorized for this guild' });
    }
    
    console.log(`Voice connect: User ${userId} connecting to ${guildId}/${channelId}`);
    
    // Note: Discord doesn't have a direct REST API for bot voice connections
    // This endpoint returns success and expects the client to handle WebSocket voice connection
    // The actual voice connection happens through Discord Gateway (WebSocket)
    
    res.json({ 
      success: true,
      message: 'Voice connection initiated. Client should establish WebSocket connection.',
      guildId,
      channelId
    });
  } catch (error) {
    console.error('Voice connect error:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.name === 'NotBeforeError') {
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
  
  if (!guildId) {
    return res.status(400).json({ error: 'Missing guildId' });
  }
  
  try {
    // Verify JWT token and check guild authorization
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded.id;
    
    // Security: Verify user has access to this guild
    if (!decoded.guildIds || !Array.isArray(decoded.guildIds) || !decoded.guildIds.includes(guildId)) {
      return res.status(403).json({ error: 'Access denied: User is not authorized for this guild' });
    }
    
    console.log(`Voice disconnect: User ${userId} disconnecting from ${guildId}`);
    
    res.json({ 
      success: true,
      message: 'Voice disconnection initiated',
      guildId
    });
  } catch (error) {
    console.error('Voice disconnect error:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.name === 'NotBeforeError') {
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

// Export handler for Lambda and app for testing
module.exports.handler = serverless(app);
module.exports.app = app;
