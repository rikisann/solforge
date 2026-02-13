import { JupiterProtocol } from '../src/protocols/jupiter';
import { BuildIntent, SwapQuote } from '../src/utils/types';
import { TEST_PAYER } from './setup';

// Mark all tests in this file as integration tests with longer timeout
describe('Jupiter Integration Tests', () => {
  let jupiterProtocol: JupiterProtocol;

  beforeAll(() => {
    jupiterProtocol = new JupiterProtocol();
    jest.setTimeout(30000); // 30 second timeout for API calls
  });

  describe('Protocol Implementation', () => {
    it('should have correct protocol metadata', () => {
      expect(jupiterProtocol.name).toBe('jupiter');
      expect(jupiterProtocol.description).toContain('Jupiter');
      expect(jupiterProtocol.supportedIntents).toContain('swap');
      expect(Array.isArray(jupiterProtocol.supportedIntents)).toBe(true);
    });

    it('should implement ProtocolHandler interface', () => {
      expect(typeof jupiterProtocol.build).toBe('function');
      expect(typeof jupiterProtocol.validateParams).toBe('function');
      expect(typeof jupiterProtocol.getRequiredAccounts).toBe('function');
      
      // Jupiter-specific methods
      expect(typeof jupiterProtocol.buildSwapTransaction).toBe('function');
      expect(typeof jupiterProtocol.getSwapQuote).toBe('function');
    });
  });

  describe('Parameter Validation', () => {
    it('should validate correct swap parameters', () => {
      const validParams = {
        amount: 1.0,
        from: 'So11111111111111111111111111111111111111112', // SOL
        to: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'   // USDC
      };

      expect(jupiterProtocol.validateParams(validParams)).toBe(true);
    });

    it('should reject invalid parameters', () => {
      const invalidParams = [
        {}, // Empty params
        { amount: 0 }, // Zero amount
        { amount: -1 }, // Negative amount
        { amount: 1 }, // Missing tokens
        { amount: 1, from: 'SOL' }, // Missing 'to'
        { amount: 1, to: 'USDC' }, // Missing 'from'
        { from: 'SOL', to: 'USDC' }, // Missing amount
        { amount: 'invalid', from: 'SOL', to: 'USDC' }, // Invalid amount type
      ];

      invalidParams.forEach(params => {
        expect(jupiterProtocol.validateParams(params)).toBe(false);
      });
    });

    it('should handle edge cases in validation', () => {
      expect(jupiterProtocol.validateParams(null as any)).toBe(false);
      expect(jupiterProtocol.validateParams(undefined as any)).toBe(false);
      expect(jupiterProtocol.validateParams('invalid' as any)).toBe(false);
    });
  });

  describe('Swap Quote API Integration', () => {
    it('should get quote for SOL → USDC swap', async () => {
      const params = {
        amount: 1.0,
        from: 'So11111111111111111111111111111111111111112', // SOL
        to: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',   // USDC
        slippage: 0.5
      };

      const quote = await jupiterProtocol.getSwapQuote(params);

      expect(quote).toBeDefined();
      expect(typeof quote.inputAmount).toBe('string');
      expect(typeof quote.outputAmount).toBe('string');
      expect(typeof quote.priceImpactPct).toBe('string');
      expect(Array.isArray(quote.route)).toBe(true);

      // Amounts should be positive
      expect(parseFloat(quote.inputAmount)).toBeGreaterThan(0);
      expect(parseFloat(quote.outputAmount)).toBeGreaterThan(0);
    });

    it('should get quote for USDC → SOL swap', async () => {
      const params = {
        amount: 100.0,
        from: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        to: 'So11111111111111111111111111111111111111112',   // SOL
        slippage: 0.5
      };

      const quote = await jupiterProtocol.getSwapQuote(params);

      expect(quote).toBeDefined();
      expect(parseFloat(quote.inputAmount)).toBeGreaterThan(0);
      expect(parseFloat(quote.outputAmount)).toBeGreaterThan(0);
    });

    it('should handle different slippage values', async () => {
      const baseParams = {
        amount: 1.0,
        from: 'So11111111111111111111111111111111111111112',
        to: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      };

      const slippageValues = [0.1, 0.5, 1.0, 2.0];

      for (const slippage of slippageValues) {
        const quote = await jupiterProtocol.getSwapQuote({ ...baseParams, slippage });
        expect(quote).toBeDefined();
        expect(parseFloat(quote.outputAmount)).toBeGreaterThan(0);
      }
    });

    it('should handle invalid token pairs gracefully', async () => {
      const invalidParams = {
        amount: 1.0,
        from: 'invalid_token_address',
        to: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        slippage: 0.5
      };

      await expect(jupiterProtocol.getSwapQuote(invalidParams))
        .rejects
        .toThrow();
    });
  });

  describe('Swap Transaction Building', () => {
    const createSwapIntent = (params: any): BuildIntent => ({
      intent: 'swap',
      params,
      payer: TEST_PAYER
    });

    it('should build swap transaction for SOL → USDC', async () => {
      const intent = createSwapIntent({
        amount: 0.1, // Small amount for testing
        from: 'So11111111111111111111111111111111111111112', // SOL
        to: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',   // USDC
        slippage: 1.0 // Higher slippage for testing
      });

      const transaction = await jupiterProtocol.buildSwapTransaction(intent);

      expect(typeof transaction).toBe('string');
      expect(transaction.length).toBeGreaterThan(0);
      
      // Should be a valid base64 string
      expect(() => Buffer.from(transaction, 'base64')).not.toThrow();
    });

    it('should build swap transaction for USDC → SOL', async () => {
      const intent = createSwapIntent({
        amount: 10, // Small USDC amount
        from: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        to: 'So11111111111111111111111111111111111111112',   // SOL
        slippage: 1.0
      });

      const transaction = await jupiterProtocol.buildSwapTransaction(intent);

      expect(typeof transaction).toBe('string');
      expect(transaction.length).toBeGreaterThan(0);
    });

    it('should handle token decimals correctly', async () => {
      // Test with tokens that have different decimal places
      const intent = createSwapIntent({
        amount: 1.0,
        from: 'So11111111111111111111111111111111111111112', // SOL (9 decimals)
        to: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK (5 decimals)
        slippage: 1.0
      });

      const transaction = await jupiterProtocol.buildSwapTransaction(intent);
      expect(typeof transaction).toBe('string');
    });

    it('should fail gracefully with invalid payer', async () => {
      const intent: BuildIntent = {
        intent: 'swap',
        params: {
          amount: 1.0,
          from: 'So11111111111111111111111111111111111111112',
          to: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          slippage: 0.5
        },
        payer: 'invalid_address'
      };

      await expect(jupiterProtocol.buildSwapTransaction(intent))
        .rejects
        .toThrow();
    });

    it('should handle API errors gracefully', async () => {
      // Test with zero amount (should cause API error)
      const intent = createSwapIntent({
        amount: 0,
        from: 'So11111111111111111111111111111111111111112',
        to: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        slippage: 0.5
      });

      await expect(jupiterProtocol.buildSwapTransaction(intent))
        .rejects
        .toThrow();
    });
  });

  describe('Required Accounts', () => {
    it('should return required accounts for swap', () => {
      const params = {
        from: 'So11111111111111111111111111111111111111112',
        to: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      };

      const accounts = jupiterProtocol.getRequiredAccounts!(params);

      expect(Array.isArray(accounts)).toBe(true);
      expect(accounts.length).toBe(2);
      expect(accounts[0].toString()).toBe(params.from);
      expect(accounts[1].toString()).toBe(params.to);
    });

    it('should handle missing token parameters', () => {
      const accounts = jupiterProtocol.getRequiredAccounts!({});
      expect(Array.isArray(accounts)).toBe(true);
    });
  });

  describe('API Configuration', () => {
    it('should use correct API endpoint', () => {
      // Jupiter protocol should use the lite API endpoint
      expect((jupiterProtocol as any).apiBaseUrl).toMatch(/lite-api\.jup\.ag/);
    });

    it('should handle custom API URL from environment', () => {
      const originalUrl = process.env.JUPITER_API_URL;
      process.env.JUPITER_API_URL = 'https://custom-jupiter.example.com';

      const customJupiter = new JupiterProtocol();
      expect((customJupiter as any).apiBaseUrl).toBe('https://custom-jupiter.example.com');

      // Restore original
      process.env.JUPITER_API_URL = originalUrl;
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should timeout on slow API responses', async () => {
      // Mock fetch to simulate slow response
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(() => 
        new Promise((resolve) => setTimeout(resolve, 20000)) // 20 second delay
      );

      try {
        const params = {
          amount: 1.0,
          from: 'So11111111111111111111111111111111111111112',
          to: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          slippage: 0.5
        };

        await expect(jupiterProtocol.getSwapQuote(params))
          .rejects
          .toThrow();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should handle network failures', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      try {
        const params = {
          amount: 1.0,
          from: 'So11111111111111111111111111111111111111112',
          to: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          slippage: 0.5
        };

        await expect(jupiterProtocol.getSwapQuote(params))
          .rejects
          .toThrow();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should handle malformed API responses', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ invalid: 'response' })
      });

      try {
        const intent = {
          intent: 'swap',
          params: {
            amount: 1.0,
            from: 'So11111111111111111111111111111111111111112',
            to: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          },
          payer: TEST_PAYER
        };

        await expect(jupiterProtocol.buildSwapTransaction(intent))
          .rejects
          .toThrow();
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('Token Decimal Mapping', () => {
    it('should have correct decimals for known tokens', () => {
      const getTokenDecimals = (jupiterProtocol as any).getTokenDecimals.bind(jupiterProtocol);

      expect(getTokenDecimals('So11111111111111111111111111111111111111112')).toBe(9);  // SOL
      expect(getTokenDecimals('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toBe(6);  // USDC
      expect(getTokenDecimals('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB')).toBe(6);  // USDT
      expect(getTokenDecimals('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263')).toBe(5);  // BONK
      expect(getTokenDecimals('JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN')).toBe(6);  // JUP

      // Unknown token should default to 6
      expect(getTokenDecimals('unknown_token_address')).toBe(6);
    });
  });

  describe('Build Method Override', () => {
    it('should throw error for build method (uses buildSwapTransaction instead)', async () => {
      const intent = {
        intent: 'swap',
        params: {
          amount: 1.0,
          from: 'So11111111111111111111111111111111111111112',
          to: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        },
        payer: TEST_PAYER
      };

      await expect(jupiterProtocol.build(intent))
        .rejects
        .toThrow('Jupiter returns complete transactions');
    });
  });
});