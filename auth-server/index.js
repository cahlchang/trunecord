import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

dotenv.config();

const app = express();

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:48766',
  credentials: true
}));

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// OAuth2 flow - redirect to Discord
app.get('/auth', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.CLIENT_ID,
    redirect_uri: process.env.REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
  });
  
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

// OAuth2 callback
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).json({ error: 'No code provided' });
  }
  
  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.REDIRECT_URI,
      }),
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      throw new Error('Failed to get access token');
    }
    
    // Get user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });
    
    const userData = await userResponse.json();
    
    // Get user's guilds
    const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });
    
    const guildsData = await guildsResponse.json();
    
    // Get bot's guilds to find mutual servers
    const botGuildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        Authorization: `Bot ${process.env.BOT_TOKEN}`,
      },
    });
    
    if (!botGuildsResponse.ok) {
      console.error('Failed to fetch bot guilds:', botGuildsResponse.status, botGuildsResponse.statusText);
      throw new Error('Failed to fetch bot guilds');
    }
    
    const botGuildsData = await botGuildsResponse.json();
    console.log('Bot is in guilds:', botGuildsData.map(g => ({ id: g.id, name: g.name })));
    
    const botGuildIds = new Set(botGuildsData.map(g => g.id));
    
    // Filter mutual guilds where user has appropriate permissions
    const mutualGuilds = guildsData.filter(guild => {
      const isInGuild = botGuildIds.has(guild.id);
      const hasConnectPermission = (parseInt(guild.permissions) & 0x100000) === 0x100000; // 0x100000 = CONNECT permission
      
      console.log(`Guild ${guild.name} (${guild.id}): bot in guild: ${isInGuild}, user has CONNECT: ${hasConnectPermission}`);
      
      return isInGuild && hasConnectPermission;
    });
    
    // Create JWT token for the local client
    const jwtToken = jwt.sign({
      userId: userData.id,
      username: userData.username,
      discriminator: userData.discriminator,
      avatar: userData.avatar,
    }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });
    
    // Redirect to frontend with token and guild data
    const frontendUrl = new URL(process.env.FRONTEND_URL || 'http://localhost:48766');
    frontendUrl.pathname = '/auth/success';
    frontendUrl.searchParams.set('token', jwtToken);
    frontendUrl.searchParams.set('guilds', JSON.stringify(mutualGuilds));
    
    res.redirect(frontendUrl.toString());
  } catch (error) {
    console.error('OAuth error:', error);
    const frontendUrl = new URL(process.env.FRONTEND_URL || 'http://localhost:48766');
    frontendUrl.pathname = '/auth/error';
    frontendUrl.searchParams.set('error', 'Authentication failed');
    res.redirect(frontendUrl.toString());
  }
});

// Get available voice channels for a guild
app.get('/api/guilds/:guildId/channels', async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get guild channels using bot token
    const channelsResponse = await fetch(`https://discord.com/api/guilds/${req.params.guildId}/channels`, {
      headers: {
        Authorization: `Bot ${process.env.BOT_TOKEN}`,
      },
    });
    
    if (!channelsResponse.ok) {
      throw new Error('Failed to fetch channels');
    }
    
    const channelsData = await channelsResponse.json();
    
    // Filter voice channels
    const voiceChannels = channelsData
      .filter(channel => channel.type === 2 || channel.type === 13) // Voice or Stage channels
      .map(channel => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        position: channel.position,
      }))
      .sort((a, b) => a.position - b.position);
    
    res.json({ channels: voiceChannels });
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// Refresh bot token for local client
app.post('/api/refresh-bot-token', async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Return bot token for local client to use
    // In production, you might want to encrypt this or use a more secure method
    res.json({ 
      botToken: process.env.BOT_TOKEN,
      userId: decoded.userId 
    });
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

const PORT = process.env.PORT || 48765;
app.listen(PORT, () => {
  console.log(`Auth server listening on port ${PORT}`);
});