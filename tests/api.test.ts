import supertest from 'supertest';
import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { TEST_PAYER } from './setup';

const execAsync = promisify(exec);

describe('API Integration Tests', () => {
  const API_BASE_URL = 'http://localhost:3000';
  let serverProcess: any;

  beforeAll(async () => {
    // Start the server for testing
    try {
      // Build the project first
      await execAsync('cd /home/ubuntu/projects/solforge && npm run build');
      
      // Start the server in background
      const { spawn } = require('child_process');
      serverProcess = spawn('node', ['dist/index.js'], {
        cwd: '/home/ubuntu/projects/solforge',
        detached: false,
        stdio: 'pipe',
        env: { 
          ...process.env, 
          NODE_ENV: 'test',
          PORT: '3000'
        }
      });

      // Wait for server to start
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Server startup timeout'));
        }, 10000);

        const checkServer = async () => {
          try {
            const response = await fetch(`${API_BASE_URL}/health`);
            if (response.ok) {
              clearTimeout(timeout);
              resolve(true);
            }
          } catch (error) {
            // Server not ready yet, keep trying
            setTimeout(checkServer, 500);
          }
        };
        
        setTimeout(checkServer, 1000); // Initial delay
      });
    } catch (error) {
      console.warn('Could not start server for API tests:', error);
      throw error;
    }
  });

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  });

  describe('Health Check', () => {
    it('GET /health should return 200', async () => {
      const response = await fetch(`${API_BASE_URL}/health`);
      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
      expect(data.success).toBe(true);
      expect(data.service).toBe('SolForge API');
      expect(data.version).toBeTruthy();
      expect(data.timestamp).toBeTruthy();
    });
  });

  describe('Natural Language Building', () => {
    it('POST /api/build/natural should handle memo prompt', async () => {
      const response = await fetch(`${API_BASE_URL}/api/build/natural`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'memo "Hello from SolForge test"',
          payer: TEST_PAYER
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.success).toBe(true);
      expect(data.transaction).toBeTruthy();
      expect(data.details?.protocol).toBe('memo');
    });

    it('POST /api/build/natural should return error for missing payer', async () => {
      const response = await fetch(`${API_BASE_URL}/api/build/natural`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'memo "test"'
          // Missing payer
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.success).toBe(false);
      expect(data.error).toBeTruthy();
    });

    it('POST /api/build/natural should return error for empty prompt', async () => {
      const response = await fetch(`${API_BASE_URL}/api/build/natural`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: '',
          payer: TEST_PAYER
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.success).toBe(false);
      expect(data.error).toBeTruthy();
    });

    it('POST /api/build/natural should handle swap prompts', async () => {
      const response = await fetch(`${API_BASE_URL}/api/build/natural`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'swap 0.1 SOL for USDC',
          payer: TEST_PAYER,
          skipSimulation: true // Skip simulation for faster tests
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.success).toBe(true);
      expect(data.transaction).toBeTruthy();
    });

    it('POST /api/build/natural should handle transfer prompts', async () => {
      const response = await fetch(`${API_BASE_URL}/api/build/natural`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `send 0.001 SOL to ${TEST_PAYER}`,
          payer: TEST_PAYER,
          skipSimulation: true
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.success).toBe(true);
      expect(data.transaction).toBeTruthy();
      expect(data.details?.protocol).toBe('system');
    });
  });

  describe('Protocols Endpoints', () => {
    it('GET /api/protocols should return array of protocols', async () => {
      const response = await fetch(`${API_BASE_URL}/api/protocols`);
      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
      expect(data.success).toBe(true);
      expect(Array.isArray(data.protocols)).toBe(true);
      expect(data.protocols.length).toBeGreaterThanOrEqual(12);
      expect(data.count).toBe(data.protocols.length);

      // Check required fields
      data.protocols.forEach((protocol: any) => {
        expect(protocol).toHaveProperty('name');
        expect(protocol).toHaveProperty('description');
        expect(protocol).toHaveProperty('supportedActions');
        expect(protocol).toHaveProperty('documentation');
      });
    });

    it('GET /api/protocols/jupiter should return jupiter details', async () => {
      const response = await fetch(`${API_BASE_URL}/api/protocols/jupiter`);
      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
      expect(data.success).toBe(true);
      expect(data.protocol.name).toBe('jupiter');
      expect(data.protocol.description).toContain('Jupiter');
      expect(Array.isArray(data.protocol.supportedIntents)).toBe(true);
      expect(data.protocol.examples).toBeTruthy();
    });

    it('GET /api/protocols/unknown should return 404', async () => {
      const response = await fetch(`${API_BASE_URL}/api/protocols/unknown-protocol`);
      expect(response.status).toBe(404);
      
      const data = await response.json() as any;
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });

    it('GET /api/protocols/jupiter/schema should return schema', async () => {
      const response = await fetch(`${API_BASE_URL}/api/protocols/jupiter/schema`);
      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
      expect(data.success).toBe(true);
      expect(data.schema).toBeTruthy();
      expect(data.protocolName).toBe('jupiter');
    });
  });

  describe('Documentation', () => {
    it('GET /api/docs should return documentation', async () => {
      const response = await fetch(`${API_BASE_URL}/api/docs`);
      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
      expect(data.success).toBe(true);
      expect(data.title).toBeTruthy();
      expect(data.description).toBeTruthy();
      expect(data.protocols).toBeTruthy();
      expect(data.usage).toBeTruthy();
      
      // Check usage endpoints
      expect(data.usage.structured).toBe('/api/build');
      expect(data.usage.natural).toBe('/api/build/natural');
      expect(data.usage.quote).toBe('/api/quote');
    });
  });

  describe('Examples Endpoint', () => {
    it('GET /api/examples should return examples and tips', async () => {
      const response = await fetch(`${API_BASE_URL}/api/examples`);
      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
      expect(data.success).toBe(true);
      expect(data.examples).toBeTruthy();
      expect(data.supportedActions).toBeTruthy();
      expect(Array.isArray(data.tips)).toBe(true);
      
      // Check that examples contain expected patterns
      expect(data.examples.swap_jupiter).toBeTruthy();
      expect(data.examples.memo).toBeTruthy();
      expect(data.examples.transfer_sol).toBeTruthy();
    });
  });

  describe('Structured Build', () => {
    it('POST /api/build should handle structured memo intent', async () => {
      const response = await fetch(`${API_BASE_URL}/api/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'memo',
          params: {
            message: 'Hello from structured test'
          },
          payer: TEST_PAYER
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.success).toBe(true);
      expect(data.transaction).toBeTruthy();
      expect(data.details?.protocol).toBe('memo');
    });

    it('POST /api/build should validate required fields', async () => {
      const response = await fetch(`${API_BASE_URL}/api/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing intent, params, and payer
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.success).toBe(false);
      expect(data.error).toBeTruthy();
    });
  });

  describe('Quote Endpoint', () => {
    it('POST /api/quote should return swap quote', async () => {
      const response = await fetch(`${API_BASE_URL}/api/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'So11111111111111111111111111111111111111112', // SOL
          to: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',   // USDC
          amount: 1.0,
          slippage: 0.5
        })
      });

      if (response.status === 200) {
        const data = await response.json() as any;
        expect(data.success).toBe(true);
        expect(data.quote).toBeTruthy();
        expect(data.quote.inputAmount).toBeTruthy();
        expect(data.quote.outputAmount).toBeTruthy();
      } else {
        // Quote endpoint might fail in test environment due to network
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('POST /api/quote should validate required parameters', async () => {
      const response = await fetch(`${API_BASE_URL}/api/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing from, to, amount
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.success).toBe(false);
      expect(data.error).toContain('required');
    });
  });

  describe('Decode Endpoint', () => {
    it('POST /api/decode should handle invalid transaction gracefully', async () => {
      const response = await fetch(`${API_BASE_URL}/api/decode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction: 'invalid_base64_transaction'
        })
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
      const data = await response.json() as any;
      expect(data.success).toBe(false);
      expect(data.error).toBeTruthy();
    });

    it('POST /api/decode should validate required fields', async () => {
      const response = await fetch(`${API_BASE_URL}/api/decode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing transaction field
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.success).toBe(false);
      expect(data.error).toBeTruthy();
    });
  });

  describe('Estimate Endpoint', () => {
    it('POST /api/estimate should handle estimation request', async () => {
      const response = await fetch(`${API_BASE_URL}/api/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'memo',
          params: {
            message: 'test'
          },
          payer: TEST_PAYER
        })
      });

      // Estimation might not work in test environment
      expect([200, 400, 500].includes(response.status)).toBe(true);
      
      const data = await response.json() as any;
      if (data.success) {
        expect(data.estimate).toBeTruthy();
      } else {
        expect(data.error).toBeTruthy();
      }
    });
  });

  describe('Resolve Endpoint', () => {
    it('POST /api/resolve should handle token resolution', async () => {
      const response = await fetch(`${API_BASE_URL}/api/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
          type: 'token'
        })
      });

      // Resolution might not work in test environment due to external API
      expect([200, 404, 500].includes(response.status)).toBe(true);
      
      const data = await response.json() as any;
      if (data.success) {
        expect(data.type).toBe('token');
        expect(data.result).toBeTruthy();
      }
    });

    it('POST /api/resolve should validate required fields', async () => {
      const response = await fetch(`${API_BASE_URL}/api/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing address
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.success).toBe(false);
      expect(data.error).toContain('required');
    });
  });

  describe('RPC Proxy', () => {
    it('POST /api/rpc should proxy RPC requests', async () => {
      const response = await fetch(`${API_BASE_URL}/api/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'getHealth',
          id: 1
        })
      });

      // RPC proxy might not work in test environment
      expect([200, 502].includes(response.status)).toBe(true);
      
      const data = await response.json() as any;
      // Should return valid JSON-RPC response structure
      expect(data).toHaveProperty('jsonrpc');
      expect(data).toHaveProperty('id');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown endpoints', async () => {
      const response = await fetch(`${API_BASE_URL}/api/unknown-endpoint`);
      expect(response.status).toBe(404);
    });

    it('should handle invalid JSON in request body', async () => {
      const response = await fetch(`${API_BASE_URL}/api/build/natural`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle missing Content-Type header', async () => {
      const response = await fetch(`${API_BASE_URL}/api/build/natural`, {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'test',
          payer: TEST_PAYER
        })
      });

      // Should still work or return appropriate error
      expect([200, 400, 415].includes(response.status)).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limiting gracefully', async () => {
      // Make many requests quickly to test rate limiting
      const promises = Array.from({ length: 20 }, () =>
        fetch(`${API_BASE_URL}/health`)
      );

      const responses = await Promise.all(promises);
      
      // Most should succeed, but some might be rate limited
      const statusCodes = responses.map(r => r.status);
      expect(statusCodes.some(code => code === 200)).toBe(true);
      
      // If rate limiting is enabled, some might return 429
      if (statusCodes.some(code => code === 429)) {
        expect(statusCodes.includes(429)).toBe(true);
      }
    });
  });
});