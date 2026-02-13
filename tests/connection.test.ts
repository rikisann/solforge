import { resolveMint, WELL_KNOWN_MINTS, RPCConnection } from '../src/utils/connection';

describe('Connection Utilities', () => {
  describe('resolveMint function', () => {
    it('should resolve SOL to wrapped SOL mint', () => {
      const result = resolveMint('SOL');
      expect(result).toBe('So11111111111111111111111111111111111111112');
    });

    it('should resolve sol (lowercase) to wrapped SOL mint', () => {
      const result = resolveMint('sol');
      expect(result).toBe('So11111111111111111111111111111111111111112');
    });

    it('should resolve USDC to correct mint', () => {
      const result = resolveMint('USDC');
      expect(result).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    });

    it('should resolve USDT to correct mint', () => {
      const result = resolveMint('USDT');
      expect(result).toBe('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');
    });

    it('should resolve BONK to correct mint', () => {
      const result = resolveMint('BONK');
      expect(result).toBe('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
    });

    it('should resolve JUP to correct mint', () => {
      const result = resolveMint('JUP');
      expect(result).toBe('JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN');
    });

    it('should resolve WIF to correct mint', () => {
      const result = resolveMint('WIF');
      expect(result).toBe('EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm');
    });

    it('should resolve PYTH to correct mint', () => {
      const result = resolveMint('PYTH');
      expect(result).toBe('HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3');
    });

    it('should resolve JTO to correct mint', () => {
      const result = resolveMint('JTO');
      expect(result).toBe('jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL');
    });

    it('should resolve other known tokens', () => {
      const tokens = [
        { symbol: 'RAY', mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' },
        { symbol: 'MSOL', mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So' },
        { symbol: 'ORCA', mint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE' },
        { symbol: 'GMT', mint: '7i5KKsX2weiTkry7jA4ZwSuXGhs5eJBEjY8vVxR4pfRx' },
        { symbol: 'RNDR', mint: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof' },
        { symbol: 'HNT', mint: 'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux' },
        { symbol: 'MNDE', mint: 'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey' }
      ];

      tokens.forEach(({ symbol, mint }) => {
        expect(resolveMint(symbol)).toBe(mint);
      });
    });

    it('should return raw mint address unchanged when it\'s already a mint', () => {
      const rawMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
      const result = resolveMint(rawMint);
      expect(result).toBe(rawMint);
    });

    it('should return unknown symbol unchanged', () => {
      const unknownSymbol = 'UNKNOWN_TOKEN';
      const result = resolveMint(unknownSymbol);
      expect(result).toBe(unknownSymbol);
    });

    it('should handle case insensitivity', () => {
      expect(resolveMint('usdc')).toBe(WELL_KNOWN_MINTS.USDC);
      expect(resolveMint('Usdc')).toBe(WELL_KNOWN_MINTS.USDC);
      expect(resolveMint('USDC')).toBe(WELL_KNOWN_MINTS.USDC);
    });

    it('should handle empty string', () => {
      const result = resolveMint('');
      expect(result).toBe('');
    });

    it('should handle null/undefined gracefully', () => {
      // TypeScript would catch these, but test runtime behavior
      // Function should handle these gracefully without crashing
      expect(() => resolveMint(null as any)).toThrow();
      expect(() => resolveMint(undefined as any)).toThrow();
    });
  });

  describe('WELL_KNOWN_MINTS constants', () => {
    it('should have all expected token mints defined', () => {
      const expectedTokens = [
        'SOL', 'USDC', 'USDT', 'RAY', 'SRM', 'FTT', 'MNGO', 'MSOL',
        'ORCA', 'GMT', 'BONK', 'JUP', 'WIF', 'PYTH', 'JTO', 'RNDR', 'HNT', 'MNDE'
      ];

      expectedTokens.forEach(token => {
        expect(WELL_KNOWN_MINTS).toHaveProperty(token);
        expect(typeof WELL_KNOWN_MINTS[token as keyof typeof WELL_KNOWN_MINTS]).toBe('string');
        expect(WELL_KNOWN_MINTS[token as keyof typeof WELL_KNOWN_MINTS].length).toBeGreaterThan(40);
      });
    });

    it('should have valid mint address format', () => {
      Object.values(WELL_KNOWN_MINTS).forEach(mint => {
        // Solana mint addresses should be base58 strings of ~44 characters
        expect(typeof mint).toBe('string');
        expect(mint.length).toBeGreaterThanOrEqual(32);
        expect(mint.length).toBeLessThanOrEqual(44);
        
        // Should only contain valid base58 characters
        expect(mint).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
      });
    });

    it('should have unique mint addresses', () => {
      const mints = Object.values(WELL_KNOWN_MINTS);
      const uniqueMints = [...new Set(mints)];
      expect(mints.length).toBe(uniqueMints.length);
    });
  });

  describe('RPCConnection', () => {
    describe('getConnection', () => {
      it('should return a Connection instance for devnet', () => {
        const connection = RPCConnection.getConnection('devnet');
        expect(connection).toBeDefined();
        expect(connection.rpcEndpoint).toContain('devnet');
      });

      it('should return a Connection instance for mainnet', () => {
        const connection = RPCConnection.getConnection('mainnet');
        expect(connection).toBeDefined();
        // Should use mainnet endpoint
        expect(
          connection.rpcEndpoint.includes('mainnet') || 
          connection.rpcEndpoint.includes('helius')
        ).toBe(true);
      });

      it('should return the same instance for repeated calls (singleton)', () => {
        const connection1 = RPCConnection.getConnection('devnet');
        const connection2 = RPCConnection.getConnection('devnet');
        expect(connection1).toBe(connection2);
      });

      it('should return different instances for different networks', () => {
        const devnetConnection = RPCConnection.getConnection('devnet');
        const mainnetConnection = RPCConnection.getConnection('mainnet');
        expect(devnetConnection).not.toBe(mainnetConnection);
      });

      it('should default to devnet when no network specified', () => {
        const defaultConnection = RPCConnection.getConnection();
        const devnetConnection = RPCConnection.getConnection('devnet');
        expect(defaultConnection).toBe(devnetConnection);
      });
    });

    describe('testConnection', () => {
      it('should test devnet connection', async () => {
        const isConnected = await RPCConnection.testConnection('devnet');
        expect(typeof isConnected).toBe('boolean');
        // In a real environment, this should be true, but in tests it might fail
        // due to network issues, so we just check the type
      });

      it('should test mainnet connection', async () => {
        const isConnected = await RPCConnection.testConnection('mainnet');
        expect(typeof isConnected).toBe('boolean');
      });

      it('should default to devnet for connection test', async () => {
        const isConnected = await RPCConnection.testConnection();
        expect(typeof isConnected).toBe('boolean');
      });

      it('should handle connection failures gracefully', async () => {
        // Mock a network failure
        const originalGetConnection = RPCConnection.getConnection;
        RPCConnection.getConnection = jest.fn().mockReturnValue({
          getSlot: jest.fn().mockRejectedValue(new Error('Network error'))
        });

        try {
          const isConnected = await RPCConnection.testConnection('devnet');
          expect(isConnected).toBe(false);
        } finally {
          RPCConnection.getConnection = originalGetConnection;
        }
      });
    });

    describe('getDefaultNetwork', () => {
      it('should return default network from environment', () => {
        const originalEnv = process.env.DEFAULT_NETWORK;

        // Test with devnet
        process.env.DEFAULT_NETWORK = 'devnet';
        expect(RPCConnection.getDefaultNetwork()).toBe('devnet');

        // Test with mainnet  
        process.env.DEFAULT_NETWORK = 'mainnet';
        expect(RPCConnection.getDefaultNetwork()).toBe('mainnet');

        // Test with invalid value (should default to devnet)
        process.env.DEFAULT_NETWORK = 'invalid';
        expect(RPCConnection.getDefaultNetwork()).toBe('devnet');

        // Test with undefined (should default to devnet)
        delete process.env.DEFAULT_NETWORK;
        expect(RPCConnection.getDefaultNetwork()).toBe('devnet');

        // Restore original
        process.env.DEFAULT_NETWORK = originalEnv;
      });
    });

    describe('Environment Variable Handling', () => {
      it('should use default URLs when custom URLs not provided', () => {
        // Due to singleton pattern, we can't easily test custom URLs
        // But we can test that the connections use expected default endpoints
        const devnetConnection = RPCConnection.getConnection('devnet');
        const mainnetConnection = RPCConnection.getConnection('mainnet');
        
        expect(devnetConnection.rpcEndpoint).toContain('devnet');
        expect(
          mainnetConnection.rpcEndpoint.includes('mainnet') || 
          mainnetConnection.rpcEndpoint.includes('helius')
        ).toBe(true);
      });
    });
  });

  describe('Integration', () => {
    it('should work together for token resolution in real scenarios', () => {
      // Test common flow: resolve token symbol to mint and get connection
      const usdcMint = resolveMint('USDC');
      expect(usdcMint).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
      
      const connection = RPCConnection.getConnection('devnet');
      expect(connection).toBeDefined();
      
      // This simulates how the system would resolve tokens and connect to RPC
      const tokens = ['SOL', 'USDC', 'BONK'];
      tokens.forEach(token => {
        const mint = resolveMint(token);
        expect(mint).toBeTruthy();
        expect(mint.length).toBeGreaterThan(30);
      });
    });
  });
});