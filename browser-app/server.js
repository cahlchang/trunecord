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
    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
    
    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
    }
    
    // Only allow GET and HEAD methods
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain', ...corsHeaders });
        res.end('405 Method Not Allowed');
        return;
    }
    
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    
    // Parse URL properly using URL constructor
    let pathname;
    try {
        const parsed = new URL(req.url, `http://localhost:${PORT}`);
        pathname = decodeURIComponent(parsed.pathname);
    } catch (e) {
        // Invalid URL or encoding
        res.writeHead(400, { 'Content-Type': 'text/plain', ...corsHeaders });
        res.end('400 Bad Request');
        return;
    }
    
    // Default to index.html for root
    const safeRel = pathname === '/' ? '/index.html' : pathname;
    
    // Resolve path securely
    const baseDir = path.resolve(__dirname);
    const fullPath = path.resolve(baseDir, '.' + safeRel);
    
    // Security: ensure resolved path is within baseDir
    if (!fullPath.startsWith(baseDir + path.sep) && fullPath !== baseDir + path.sep + 'index.html') {
        res.writeHead(403, { 'Content-Type': 'text/plain', ...corsHeaders });
        res.end('403 Forbidden');
        return;
    }
    
    // Check if file exists
    fs.access(fullPath, fs.constants.F_OK, (err) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain', ...corsHeaders });
            res.end('404 Not Found');
            return;
        }
        
        // Get file extension
        const extname = path.extname(fullPath).toLowerCase();
        const contentType = mimeTypes[extname] || 'application/octet-stream';
        
        // Read and serve file
        fs.readFile(fullPath, (error, content) => {
            if (error) {
                res.writeHead(500, { 'Content-Type': 'text/plain', ...corsHeaders });
                res.end('500 Internal Server Error');
                return;
            }
            
            // Add CORS headers for local development
            res.writeHead(200, {
                'Content-Type': contentType,
                ...corsHeaders
            });
            
            // For HEAD requests, don't send the body
            if (req.method === 'HEAD') {
                res.end();
            } else {
                res.end(content);
            }
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