const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 48766;

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    
    // Parse URL and decode to prevent encoded traversal attacks
    let urlPath = req.url.split('?')[0]; // Remove query string
    urlPath = urlPath.split('#')[0]; // Remove hash
    
    // Decode URL to catch encoded traversal attempts like %2e%2e
    try {
        urlPath = decodeURIComponent(urlPath);
    } catch (e) {
        // Invalid URL encoding
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('400 Bad Request');
        return;
    }
    
    // Default to index.html for root
    if (urlPath === '/') {
        urlPath = '/index.html';
    }
    
    // Remove leading slash and resolve path
    const requestedPath = urlPath.slice(1); // Remove leading /
    const fullPath = path.resolve(__dirname, requestedPath);
    
    // Security: ensure resolved path is within __dirname
    if (!fullPath.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }
    
    // Check if file exists
    fs.access(fullPath, fs.constants.F_OK, (err) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }
        
        // Get file extension
        const extname = path.extname(fullPath).toLowerCase();
        const contentType = mimeTypes[extname] || 'application/octet-stream';
        
        // Read and serve file
        fs.readFile(fullPath, (error, content) => {
            if (error) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('500 Internal Server Error');
                return;
            }
            
            // Add CORS headers for local development
            res.writeHead(200, {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            });
            res.end(content);
        });
    });
});

server.listen(PORT, () => {
    console.log(`🚀 trunecord browser app running at http://localhost:${PORT}`);
    console.log('📝 Make sure the Chrome extension is installed and active');
    console.log('🔐 Authenticate with Discord to get started');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});