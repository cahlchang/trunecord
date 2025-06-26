const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

app.use(express.json());

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
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
    state: state
  });
  
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

// OAuth callback
app.get('/api/callback', async (req, res) => {
  const { code, state } = req.query;
  
  if (!code) {
    return res.status(400).json({ error: 'No code provided' });
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
    
    // Redirect to frontend with token and guilds
    const frontendUrl = new URL(`${process.env.FRONTEND_URL}/auth/success`);
    frontendUrl.searchParams.append('token', token);
    frontendUrl.searchParams.append('guilds', JSON.stringify(commonGuilds));
    
    res.redirect(frontendUrl.toString());
  } catch (error) {
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


// Get guild channels
app.get('/api/guilds/:guildId/channels', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { guildId } = req.params;
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    // Verify JWT token
    jwt.verify(token, process.env.JWT_SECRET);
    
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
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      res.status(500).json({ error: 'Failed to get channels' });
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