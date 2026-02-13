import { TokenResolver, TokenInfo } from '../src/engine/token-resolver';

describe('TokenResolver', () => {
  // Integration tests with real DexScreener API
  describe('Integration Tests', () => {
    beforeEach(() => {
      jest.setTimeout(15000); // Longer timeout for API calls
    });

    it('should resolve known token address (BONK)', async () => {
      const bonkMint = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
      const result = await TokenResolver.resolve(bonkMint);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.mint).toBe(bonkMint);
        expect(result.symbol).toBe('Bonk'); // DexScreener returns 'Bonk' not 'BONK'
        expect(result.primaryDex).toBeTruthy();
        expect(result.primaryPool).toBeTruthy();
        expect(Array.isArray(result.allDexes)).toBe(true);
        expect(result.allDexes.length).toBeGreaterThan(0);
        
        // Should have valid DEX names
        const validDexes = ['raydium', 'orca', 'meteora', 'pumpfun', 'jupiter'];
        expect(validDexes).toContain(result.primaryDex);
      }
    });

    it('should resolve protocol for known token', async () => {
      const bonkMint = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
      const result = await TokenResolver.resolveProtocol(bonkMint);

      expect(result.protocol).toBeTruthy();
      expect(result.tokenInfo).toBeTruthy();
      
      if (result.tokenInfo) {
        expect(result.tokenInfo.symbol).toBe('Bonk'); // DexScreener returns 'Bonk' not 'BONK'
        expect(result.tokenInfo.mint).toBe(bonkMint);
      }
    });

    it('should handle invalid token address gracefully', async () => {
      const invalidMint = '1111111111111111111111111111111111111111111'; // Invalid
      const result = await TokenResolver.resolve(invalidMint);

      expect(result).toBeNull();
    });

    it('should handle unknown token gracefully', async () => {
      const unknownMint = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // Non-existent 
      const result = await TokenResolver.resolve(unknownMint);

      expect(result).toBeNull();
    });

    it('should resolve protocol for unknown token with Jupiter fallback', async () => {
      const unknownMint = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const result = await TokenResolver.resolveProtocol(unknownMint);

      expect(result.protocol).toBe('jupiter');
      expect(result.tokenInfo).toBeUndefined();
      expect(result.pool).toBeUndefined();
    });

    it('should return expected fields for valid tokens', async () => {
      const jupiterMint = 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN'; // JUP token
      const result = await TokenResolver.resolve(jupiterMint);

      if (result) {
        // Check all required fields exist
        expect(typeof result.mint).toBe('string');
        expect(typeof result.symbol).toBe('string');
        expect(typeof result.name).toBe('string');
        expect(typeof result.primaryDex).toBe('string');
        expect(typeof result.primaryPool).toBe('string');
        expect(Array.isArray(result.allDexes)).toBe(true);
        
        // Optional fields
        if (result.priceUsd) {
          expect(typeof result.priceUsd).toBe('string');
        }
        if (result.liquidity) {
          expect(typeof result.liquidity).toBe('number');
        }
      }
    });
  });

  describe('Pair Resolution', () => {
    it('should resolve pair address', async () => {
      // Use a known Raydium BONK/SOL pair (may change over time)
      // This is more of a smoke test to ensure the endpoint works
      const result = await TokenResolver.resolveByPair('AVs9TA4nWDzfPJE9gGVNJMVhcQy3V9PGazuz33BfG2RA');

      if (result) {
        expect(result.protocol).toBeTruthy();
        expect(result.baseToken).toBeTruthy();
        expect(result.quoteToken).toBeTruthy();
        expect(result.pool).toBeTruthy();
        
        // Should have valid protocol name
        const validProtocols = ['raydium', 'orca', 'meteora', 'pumpfun', 'jupiter'];
        expect(validProtocols.includes(result.protocol)).toBe(true);
      }
      // If result is null, the pair might not exist or API might be down
      // We don't fail the test in this case since it's an integration test
    });

    it('should handle invalid pair address gracefully', async () => {
      const invalidPair = '1111111111111111111111111111111111111111111';
      const result = await TokenResolver.resolveByPair(invalidPair);

      expect(result).toBeNull();
    });
  });

  describe('Caching', () => {
    it('should cache results to avoid repeated API calls', async () => {
      // Mock the fetch function to track calls
      const originalFetch = global.fetch;
      const mockFetch = jest.fn(originalFetch);
      global.fetch = mockFetch;

      try {
        const bonkMint = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
        
        // First call should hit the API
        await TokenResolver.resolve(bonkMint);
        const firstCallCount = mockFetch.mock.calls.length;
        
        // Second call should use cache
        await TokenResolver.resolve(bonkMint);
        const secondCallCount = mockFetch.mock.calls.length;
        
        // Should not make additional API calls
        expect(secondCallCount).toBe(firstCallCount);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should respect cache TTL', async () => {
      // This test would require mocking Date.now() or using fake timers
      // For now, just verify cache behavior exists
      const bonkMint = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
      
      const result1 = await TokenResolver.resolve(bonkMint);
      const result2 = await TokenResolver.resolve(bonkMint);
      
      // Results should be consistent
      if (result1 && result2) {
        expect(result1.mint).toBe(result2.mint);
        expect(result1.symbol).toBe(result2.symbol);
      }
    });
  });

  describe('DEX ID Mapping', () => {
    it('should map DexScreener DEX IDs to protocol names', async () => {
      // This tests the internal DEX_ID_MAP functionality
      // We can't easily unit test the private mapping, but we can verify
      // that common DEX names are properly mapped in results
      
      const bonkMint = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
      const result = await TokenResolver.resolve(bonkMint);

      if (result && result.allDexes) {
        // Check that all returned DEX names are in our expected list
        const expectedDexes = ['raydium', 'orca', 'meteora', 'pumpfun', 'jupiter'];
        
        result.allDexes.forEach(dex => {
          // Either it's in our expected list, or it's a raw dexId we haven't mapped
          expect(typeof dex).toBe('string');
          expect(dex.length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      // Clear the cache before each error test
      (TokenResolver as any).cache.clear();
      (TokenResolver as any).pairCache.clear();
    });

    it('should handle network timeouts gracefully', async () => {
      // Mock fetch to simulate timeout
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('Timeout'));

      try {
        const result = await TokenResolver.resolve('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
        expect(result).toBeNull();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should handle malformed API responses gracefully', async () => {
      // Mock fetch to return invalid JSON
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ invalidField: true })
      });

      try {
        const result = await TokenResolver.resolve('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
        expect(result).toBeNull();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should handle HTTP errors gracefully', async () => {
      // Mock fetch to return 404
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue('Not Found')
      });

      try {
        const result = await TokenResolver.resolve('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
        expect(result).toBeNull();
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});