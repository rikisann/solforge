import { ProtocolRegistry } from '../src/protocols/index';
import { ProtocolHandler } from '../src/utils/types';

describe('ProtocolRegistry', () => {
  describe('Protocol Registration', () => {
    it('should have all expected protocols registered', () => {
      const allProtocols = ProtocolRegistry.getAllProtocols();
      const protocolNames = allProtocols.map(p => p.name);

      // Check for all 12 expected protocols
      const expectedProtocols = [
        'system',
        'spl-token',
        'jupiter',
        'memo',
        'jito',
        'raydium',
        'pumpfun',
        'orca',
        'marinade',
        'meteora',
        'token2022',
        'stake'
      ];

      expectedProtocols.forEach(protocol => {
        expect(protocolNames).toContain(protocol);
      });

      expect(allProtocols.length).toBeGreaterThanOrEqual(12);
    });

    it('should register protocols with unique names', () => {
      const allProtocols = ProtocolRegistry.getAllProtocols();
      const protocolNames = allProtocols.map(p => p.name);
      const uniqueNames = [...new Set(protocolNames)];

      expect(protocolNames.length).toBe(uniqueNames.length);
    });

    it('should have each protocol implement ProtocolHandler interface', () => {
      const allProtocols = ProtocolRegistry.getAllProtocols();

      allProtocols.forEach(protocol => {
        // Check required properties
        expect(typeof protocol.name).toBe('string');
        expect(typeof protocol.description).toBe('string');
        expect(Array.isArray(protocol.supportedIntents)).toBe(true);
        
        // Check required methods
        expect(typeof protocol.build).toBe('function');
        expect(typeof protocol.validateParams).toBe('function');
        
        // Check optional method
        if (protocol.getRequiredAccounts) {
          expect(typeof protocol.getRequiredAccounts).toBe('function');
        }

        // Validate supportedIntents is not empty
        expect(protocol.supportedIntents.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Protocol Retrieval', () => {
    it('should return Jupiter handler by name', () => {
      const handler = ProtocolRegistry.getHandler('jupiter');
      
      expect(handler).toBeDefined();
      expect(handler?.name).toBe('jupiter');
      expect(handler?.supportedIntents).toContain('swap');
    });

    it('should return handler by intent', () => {
      const handler = ProtocolRegistry.getHandler('swap');
      
      expect(handler).toBeDefined();
      expect(handler?.supportedIntents).toContain('swap');
    });

    it('should return undefined for unknown protocol', () => {
      const handler = ProtocolRegistry.getHandler('unknown-protocol');
      
      expect(handler).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const handler = ProtocolRegistry.getHandler('');
      
      expect(handler).toBeUndefined();
    });
  });

  describe('Jupiter Handler', () => {
    it('should have Jupiter handler with buildSwapTransaction method', () => {
      const jupiter = ProtocolRegistry.getHandler('jupiter');
      
      expect(jupiter).toBeDefined();
      expect(jupiter?.name).toBe('jupiter');
      expect(jupiter?.description).toContain('Jupiter');
      
      // Check for Jupiter-specific method
      expect('buildSwapTransaction' in jupiter!).toBe(true);
      expect(typeof (jupiter as any).buildSwapTransaction).toBe('function');
    });

    it('should have Jupiter support swap-related intents', () => {
      const jupiter = ProtocolRegistry.getHandler('jupiter');
      
      expect(jupiter?.supportedIntents).toEqual(
        expect.arrayContaining(['swap'])
      );
    });
  });

  describe('Protocol Validation', () => {
    it('should check if intent is supported', () => {
      expect(ProtocolRegistry.isSupported('swap')).toBe(true);
      expect(ProtocolRegistry.isSupported('transfer')).toBe(true);
      expect(ProtocolRegistry.isSupported('memo')).toBe(true);
      expect(ProtocolRegistry.isSupported('stake')).toBe(true);
      
      expect(ProtocolRegistry.isSupported('unknown-action')).toBe(false);
      expect(ProtocolRegistry.isSupported('')).toBe(false);
    });
  });

  describe('Protocol Info', () => {
    it('should return protocol information', () => {
      const info = ProtocolRegistry.getProtocolInfo();
      
      expect(Array.isArray(info)).toBe(true);
      expect(info.length).toBeGreaterThan(0);
      
      info.forEach(protocolInfo => {
        expect(protocolInfo).toHaveProperty('name');
        expect(protocolInfo).toHaveProperty('description');
        expect(protocolInfo).toHaveProperty('supportedActions');
        expect(protocolInfo).toHaveProperty('documentation');
        
        expect(typeof protocolInfo.name).toBe('string');
        expect(typeof protocolInfo.description).toBe('string');
        expect(Array.isArray(protocolInfo.supportedActions)).toBe(true);
        expect(typeof protocolInfo.documentation).toBe('string');
        
        // Documentation should be a proper path
        expect(protocolInfo.documentation).toMatch(/^\/api\/protocols\/.+/);
      });
    });

    it('should have Jupiter in protocol info', () => {
      const info = ProtocolRegistry.getProtocolInfo();
      const jupiterInfo = info.find(p => p.name === 'jupiter');
      
      expect(jupiterInfo).toBeDefined();
      expect(jupiterInfo?.supportedActions).toContain('swap');
      expect(jupiterInfo?.documentation).toBe('/api/protocols/jupiter');
    });
  });

  describe('Specific Protocol Handlers', () => {
    const protocolTests = [
      { name: 'system', expectedIntents: ['transfer'] },
      { name: 'spl-token', expectedIntents: ['token-transfer', 'transfer-token'] },
      { name: 'memo', expectedIntents: ['memo'] },
      { name: 'jito', expectedIntents: ['tip'] },
      { name: 'raydium', expectedIntents: ['swap'] },
      { name: 'pumpfun', expectedIntents: ['buy', 'sell'] },
      { name: 'orca', expectedIntents: ['swap'] },
      { name: 'marinade', expectedIntents: ['stake', 'unstake'] },
      { name: 'meteora', expectedIntents: ['swap'] },
      { name: 'token2022', expectedIntents: ['transfer'] },
      { name: 'stake', expectedIntents: ['stake'] },
    ];

    protocolTests.forEach(({ name, expectedIntents }) => {
      it(`should have ${name} protocol with expected intents`, () => {
        const handler = ProtocolRegistry.getHandler(name);
        
        expect(handler).toBeDefined();
        expect(handler?.name).toBe(name);
        
        expectedIntents.forEach(intent => {
          expect(handler?.supportedIntents).toContain(intent);
        });
      });
    });
  });

  describe('Protocol Methods', () => {
    it('should have working validateParams method for each protocol', () => {
      const allProtocols = ProtocolRegistry.getAllProtocols();
      
      allProtocols.forEach(protocol => {
        // Test with empty params (should generally be false)
        const emptyResult = protocol.validateParams({});
        expect(typeof emptyResult).toBe('boolean');
        
        // Test with invalid params (should be false)
        const invalidResult = protocol.validateParams({ invalid: true });
        expect(typeof invalidResult).toBe('boolean');
      });
    });

    it('should have working build method for each protocol', async () => {
      const allProtocols = ProtocolRegistry.getAllProtocols();
      
      for (const protocol of allProtocols) {
        const buildIntent = {
          intent: 'test',
          params: {},
          payer: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
        };
        
        // Build method should exist and return a Promise
        const buildPromise = protocol.build(buildIntent);
        expect(buildPromise).toBeInstanceOf(Promise);
        
        // Most will throw due to invalid params, but should not crash
        try {
          await buildPromise;
        } catch (error) {
          // Expected for most protocols with empty/invalid params
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('Protocol Priority Order', () => {
    it('should handle intent conflicts with priority', () => {
      // Multiple protocols might support the same intent
      // The registry should return the first registered one
      
      const swapHandler = ProtocolRegistry.getHandler('swap');
      expect(swapHandler).toBeDefined();
      
      // Should return a specific handler, not undefined
      expect(swapHandler?.name).toBeTruthy();
      expect(swapHandler?.supportedIntents).toContain('swap');
    });
  });

  describe('Dynamic Protocol Registration', () => {
    it('should allow registering new protocols', () => {
      const mockProtocol: ProtocolHandler = {
        name: 'test-protocol',
        description: 'Test protocol for unit tests',
        supportedIntents: ['test-action'],
        build: jest.fn().mockResolvedValue([]),
        validateParams: jest.fn().mockReturnValue(true)
      };

      const originalCount = ProtocolRegistry.getAllProtocols().length;
      
      ProtocolRegistry.register(mockProtocol);
      
      const newCount = ProtocolRegistry.getAllProtocols().length;
      expect(newCount).toBeGreaterThan(originalCount);
      
      const registered = ProtocolRegistry.getHandler('test-protocol');
      expect(registered).toBe(mockProtocol);
      
      const byIntent = ProtocolRegistry.getHandler('test-action');
      expect(byIntent).toBe(mockProtocol);
    });
  });
});