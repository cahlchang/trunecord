// This is an updated version of the Lambda callback handler
// that supports custom protocol redirects (trunecord://)

// Add this to your Lambda function's callback handler:

app.get('/api/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }
  
  try {
    // Exchange code for token (existing code)
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
    
    const accessToken = tokenResponse.data.access_token;
    
    // Get user info (existing code)
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    // Get user's guilds (existing code)
    const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    const userGuilds = guildsResponse.data;
    
    // Get bot's guilds (existing code)
    const botGuilds = await getBotGuilds();
    
    // Find common guilds (existing code)
    const commonGuilds = userGuilds.filter(userGuild => 
      botGuilds.some(botGuild => botGuild.id === userGuild.id)
    );
    
    // Create JWT token (existing code)
    const token = jwt.sign({
      userId: userResponse.data.id,
      username: userResponse.data.username,
      discriminator: userResponse.data.discriminator
    }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    // Check if client wants custom protocol redirect
    const useProtocol = req.query.redirect_protocol === 'trunecord';
    
    if (useProtocol) {
      // Redirect to custom protocol URL for desktop app
      const protocolUrl = new URL('trunecord://auth/callback');
      protocolUrl.searchParams.append('token', token);
      protocolUrl.searchParams.append('guilds', JSON.stringify(commonGuilds));
      
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
          </div>
          <script>
            // Attempt to redirect to the custom protocol
            window.location.href = "${protocolUrl.toString()}";
            
            // Fallback: show manual link after 3 seconds
            setTimeout(() => {
              document.querySelector('p:nth-of-type(2)').style.display = 'block';
            }, 3000);
          </script>
        </body>
        </html>
      `);
    } else {
      // Original behavior: redirect to web frontend
      const frontendUrl = new URL(`${process.env.FRONTEND_URL}/auth/success`);
      frontendUrl.searchParams.append('token', token);
      frontendUrl.searchParams.append('guilds', JSON.stringify(commonGuilds));
      res.redirect(frontendUrl.toString());
    }
  } catch (error) {
    console.error('OAuth error:', error);
    
    // Check if using custom protocol
    const useProtocol = req.query.redirect_protocol === 'trunecord';
    
    if (useProtocol) {
      // Redirect to error page with protocol
      const errorUrl = 'trunecord://auth/error?error=' + encodeURIComponent(error.message);
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