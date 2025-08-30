const request = require('supertest');
const express = require('express');
const cors = require('cors');

describe('CORS Configuration', () => {
    let app;
    
    beforeEach(() => {
        // Reset environment variables
        delete process.env.FRONTEND_URL;
    });
    
    test('should allow requests from any origin when FRONTEND_URL is not set', () => {
        // Arrange
        app = express();
        const corsOptions = {
            credentials: true
        };
        
        if (process.env.FRONTEND_URL && process.env.FRONTEND_URL !== '*') {
            corsOptions.origin = process.env.FRONTEND_URL;
        } else {
            // This is the problematic configuration
            corsOptions.origin = '*';
            corsOptions.credentials = false;
        }
        
        app.use(cors(corsOptions));
        app.get('/api/auth', (req, res) => {
            res.json({ message: 'OK' });
        });
        
        // Act & Assert
        return request(app)
            .get('/api/auth')
            .expect(200)
            .expect((res) => {
                // With wildcard origin and credentials:false, this should work
                expect(res.headers['access-control-allow-origin']).toBe('*');
            });
    });
    
    test('should allow specific origin when FRONTEND_URL is set', () => {
        // Arrange
        process.env.FRONTEND_URL = 'http://localhost:48766';
        
        app = express();
        const corsOptions = {
            credentials: true
        };
        
        if (process.env.FRONTEND_URL && process.env.FRONTEND_URL !== '*') {
            corsOptions.origin = process.env.FRONTEND_URL;
        } else {
            corsOptions.origin = '*';
            corsOptions.credentials = false;
        }
        
        app.use(cors(corsOptions));
        app.get('/api/auth', (req, res) => {
            res.json({ message: 'OK' });
        });
        
        // Act & Assert
        return request(app)
            .get('/api/auth')
            .set('Origin', 'http://localhost:48766')
            .expect(200)
            .expect((res) => {
                expect(res.headers['access-control-allow-origin']).toBe('http://localhost:48766');
                expect(res.headers['access-control-allow-credentials']).toBe('true');
            });
    });
    
    test('should handle localhost origins properly', () => {
        // Arrange
        app = express();
        
        // Better CORS configuration for development
        const corsOptions = {
            origin: function (origin, callback) {
                // Allow requests with no origin (like mobile apps, Postman)
                if (!origin) return callback(null, true);
                
                // Allow localhost for development
                if (origin.startsWith('http://localhost:') || 
                    origin.startsWith('https://localhost:')) {
                    return callback(null, true);
                }
                
                // Allow configured frontend URL
                if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
                    return callback(null, true);
                }
                
                // Reject other origins
                callback(new Error('Not allowed by CORS'));
            },
            credentials: true
        };
        
        app.use(cors(corsOptions));
        app.get('/api/auth', (req, res) => {
            res.json({ message: 'OK' });
        });
        
        // Act & Assert - localhost should be allowed
        return request(app)
            .get('/api/auth')
            .set('Origin', 'http://localhost:48766')
            .expect(200)
            .expect((res) => {
                expect(res.headers['access-control-allow-origin']).toBe('http://localhost:48766');
                expect(res.headers['access-control-allow-credentials']).toBe('true');
            });
    });
});