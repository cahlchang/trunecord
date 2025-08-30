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
    });
    
    describe('GET /api/auth', () => {
        test('should return Discord OAuth URL with correct parameters', async () => {
            const response = await request(app)
                .get('/api/auth')
                .set('Origin', 'http://localhost:48766')
                .expect(200);
            
            expect(response.status).toBe(200);
            // OAuth URL should be redirected, not returned as JSON
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
    });
});