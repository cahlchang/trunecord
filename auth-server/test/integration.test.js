const request = require('supertest');

describe('Auth Server Integration Tests', () => {
    let app;
    
    beforeEach(() => {
        // Clear module cache to get fresh instance
        jest.resetModules();
        
        // Set up test environment
        process.env.DISCORD_CLIENT_ID = 'test_client_id';
        process.env.DISCORD_CLIENT_SECRET = 'test_client_secret';
        process.env.DISCORD_BOT_TOKEN = 'test_bot_token';
        process.env.JWT_SECRET = 'test_jwt_secret';
        process.env.REDIRECT_URL = 'http://localhost:48766';
        process.env.GO_CLIENT_LATEST_VERSION = '9.9.9';
        process.env.GO_CLIENT_MIN_VERSION = '9.0.0';
        process.env.GO_CLIENT_DOWNLOAD_URL = 'https://example.com/go-client';
        process.env.GO_CLIENT_RELEASE_NOTES = 'Test release notes';
        process.env.EXTENSION_LATEST_VERSION = '8.8.8';
        process.env.EXTENSION_MIN_VERSION = '8.0.0';
        process.env.EXTENSION_DOWNLOAD_URL = 'https://example.com/extension';
        process.env.EXTENSION_RELEASE_NOTES = 'Extension notes';
        
        // Import fresh app instance
        const { app: freshApp } = require('../index');
        app = freshApp;
    });
    
    afterEach(() => {
        // Clean up environment
        delete process.env.DISCORD_CLIENT_ID;
        delete process.env.DISCORD_CLIENT_SECRET;
        delete process.env.DISCORD_BOT_TOKEN;
        delete process.env.JWT_SECRET;
        delete process.env.REDIRECT_URL;
        delete process.env.GO_CLIENT_LATEST_VERSION;
        delete process.env.GO_CLIENT_MIN_VERSION;
        delete process.env.GO_CLIENT_DOWNLOAD_URL;
        delete process.env.GO_CLIENT_RELEASE_NOTES;
        delete process.env.EXTENSION_LATEST_VERSION;
        delete process.env.EXTENSION_MIN_VERSION;
        delete process.env.EXTENSION_DOWNLOAD_URL;
        delete process.env.EXTENSION_RELEASE_NOTES;
    });
    
    describe('GET /api/auth', () => {
        test('should return Discord OAuth URL with correct parameters', async () => {
            const response = await request(app)
                .get('/api/auth')
                .set('Origin', 'http://localhost:48766')
                .expect(302);
            
            expect(response.headers.location).toContain('https://discord.com/api/oauth2/authorize');
        });
        
        test('should handle CORS headers for localhost', async () => {
            const response = await request(app)
                .options('/api/auth')
                .set('Origin', 'http://localhost:48766')
                .set('Access-Control-Request-Method', 'GET')
                .expect(204);
            
            expect(response.headers['access-control-allow-origin']).toBe('http://localhost:48766');
            expect(response.headers['access-control-allow-credentials']).toBe('true');
        });
    });
    
    describe('GET /api/guilds', () => {
        test('should reject request without token', async () => {
            const response = await request(app)
                .get('/api/guilds')
                .set('Origin', 'http://localhost:48766')
                .expect(401);
            
            expect(response.body.error).toBeDefined();
        });
        
        test('should reject request with invalid token', async () => {
            const response = await request(app)
                .get('/api/guilds')
                .set('Origin', 'http://localhost:48766')
                .set('Authorization', 'Bearer invalid_token')
                .expect(401);
            
            expect(response.body.error).toBeDefined();
        });
    });
    
    describe('CORS Policy', () => {
        test('should allow localhost:48766', async () => {
            const response = await request(app)
                .options('/api/auth')
                .set('Origin', 'http://localhost:48766')
                .set('Access-Control-Request-Method', 'GET')
                .expect(204);
            
            expect(response.headers['access-control-allow-origin']).toBe('http://localhost:48766');
        });
        
        test('should allow 127.0.0.1', async () => {
            const response = await request(app)
                .options('/api/auth')
                .set('Origin', 'http://127.0.0.1:48766')
                .set('Access-Control-Request-Method', 'GET')
                .expect(204);
            
            expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:48766');
        });
        
        test('should reject unknown origins', async () => {
            const response = await request(app)
                .options('/api/auth')
                .set('Origin', 'http://evil.com')
                .set('Access-Control-Request-Method', 'GET');
            
            // CORS error should occur
            expect(response.headers['access-control-allow-origin']).toBeUndefined();
        });

        test('should allow chrome extension origins', async () => {
            const response = await request(app)
                .options('/api/auth')
                .set('Origin', 'chrome-extension://abcd1234')
                .set('Access-Control-Request-Method', 'GET')
                .expect(204);

            expect(response.headers['access-control-allow-origin']).toBe('chrome-extension://abcd1234');
        });
    });

    describe('GET /api/version', () => {
        test('should return configured version information', async () => {
            const response = await request(app)
                .get('/api/version')
                .expect(200);

            expect(response.body).toHaveProperty('goClient');
            expect(response.body.goClient.latestVersion).toBe('9.9.9');
            expect(response.body.goClient.minimumVersion).toBe('9.0.0');
            expect(response.body.goClient.downloadUrl).toBe('https://example.com/go-client');
            expect(response.body.goClient.releaseNotes).toBe('Test release notes');

            expect(response.body).toHaveProperty('chromeExtension');
            expect(response.body.chromeExtension.latestVersion).toBe('8.8.8');
            expect(response.body.chromeExtension.minimumVersion).toBe('8.0.0');
            expect(response.body.chromeExtension.downloadUrl).toBe('https://example.com/extension');
            expect(response.body.chromeExtension.releaseNotes).toBe('Extension notes');

            expect(response.body).toHaveProperty('lastCheckedAt');
        });

        test('should apply CORS headers for chrome extension origin', async () => {
            const response = await request(app)
                .get('/api/version')
                .set('Origin', 'chrome-extension://abcd1234')
                .expect(200);

            expect(response.headers['access-control-allow-origin']).toBe('chrome-extension://abcd1234');
        });
    });
});
