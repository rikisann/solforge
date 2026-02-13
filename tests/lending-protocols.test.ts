import { KaminoProtocol } from '../src/protocols/kamino';
import { MarginfiProtocol } from '../src/protocols/marginfi';
import { SolendProtocol } from '../src/protocols/solend';
import { IntentParser } from '../src/engine/intent-parser';
import { ProtocolRegistry } from '../src/protocols';

describe('Lending Protocols', () => {
  describe('Kamino Protocol', () => {
    let kamino: KaminoProtocol;
    
    beforeEach(() => {
      kamino = new KaminoProtocol();
    });

    it('should have correct name and supported intents', () => {
      expect(kamino.name).toBe('kamino');
      expect(kamino.supportedIntents).toContain('supply');
      expect(kamino.supportedIntents).toContain('deposit');
      expect(kamino.supportedIntents).toContain('borrow');
      expect(kamino.supportedIntents).toContain('repay');
      expect(kamino.supportedIntents).toContain('withdraw');
    });

    it('should validate valid supply params', () => {
      const params = {
        amount: 100,
        token: 'USDC'
      };
      expect(kamino.validateParams(params)).toBe(true);
    });

    it('should reject invalid params - no amount', () => {
      const params = {
        token: 'USDC'
      };
      expect(kamino.validateParams(params)).toBe(false);
    });

    it('should reject invalid params - negative amount', () => {
      const params = {
        amount: -10,
        token: 'USDC'
      };
      expect(kamino.validateParams(params)).toBe(false);
    });

    it('should reject invalid params - no token', () => {
      const params = {
        amount: 100
      };
      expect(kamino.validateParams(params)).toBe(false);
    });

    it('should build supply transaction', async () => {
      const intent = {
        intent: 'supply',
        params: {
          amount: 100,
          token: 'USDC'
        },
        payer: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
      };

      const instructions = await kamino.build(intent);
      expect(instructions).toBeDefined();
      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions[0].programId.toString()).toBe('KLend2g3cP87ber8TAJASBTig4PDior61Ccqb6XK6X1');
    });

    it('should build borrow transaction', async () => {
      const intent = {
        intent: 'borrow',
        params: {
          amount: 50,
          token: 'SOL'
        },
        payer: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
      };

      const instructions = await kamino.build(intent);
      expect(instructions).toBeDefined();
      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions[0].programId.toString()).toBe('KLend2g3cP87ber8TAJASBTig4PDior61Ccqb6XK6X1');
    });

    it('should build repay transaction', async () => {
      const intent = {
        intent: 'repay',
        params: {
          amount: 25,
          token: 'USDC'
        },
        payer: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
      };

      const instructions = await kamino.build(intent);
      expect(instructions).toBeDefined();
      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions[0].programId.toString()).toBe('KLend2g3cP87ber8TAJASBTig4PDior61Ccqb6XK6X1');
    });

    it('should build withdraw transaction', async () => {
      const intent = {
        intent: 'withdraw',
        params: {
          amount: 75,
          token: 'USDC'
        },
        payer: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
      };

      const instructions = await kamino.build(intent);
      expect(instructions).toBeDefined();
      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions[0].programId.toString()).toBe('KLend2g3cP87ber8TAJASBTig4PDior61Ccqb6XK6X1');
    });
  });

  describe('Marginfi Protocol', () => {
    let marginfi: MarginfiProtocol;
    
    beforeEach(() => {
      marginfi = new MarginfiProtocol();
    });

    it('should have correct name and supported intents', () => {
      expect(marginfi.name).toBe('marginfi');
      expect(marginfi.supportedIntents).toContain('supply');
      expect(marginfi.supportedIntents).toContain('deposit');
      expect(marginfi.supportedIntents).toContain('borrow');
      expect(marginfi.supportedIntents).toContain('repay');
      expect(marginfi.supportedIntents).toContain('withdraw');
    });

    it('should validate valid supply params', () => {
      const params = {
        amount: 100,
        token: 'USDC'
      };
      expect(marginfi.validateParams(params)).toBe(true);
    });

    it('should build supply transaction', async () => {
      const intent = {
        intent: 'supply',
        params: {
          amount: 100,
          token: 'USDC'
        },
        payer: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
      };

      const instructions = await marginfi.build(intent);
      expect(instructions).toBeDefined();
      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions[0].programId.toString()).toBe('MFv2hWf31Z9kbCa1snEPYctwafyhdJnFETUbqwpY6wB');
    });
  });

  describe('Solend Protocol', () => {
    let solend: SolendProtocol;
    
    beforeEach(() => {
      solend = new SolendProtocol();
    });

    it('should have correct name and supported intents', () => {
      expect(solend.name).toBe('solend');
      expect(solend.supportedIntents).toContain('supply');
      expect(solend.supportedIntents).toContain('deposit');
      expect(solend.supportedIntents).toContain('borrow');
      expect(solend.supportedIntents).toContain('repay');
      expect(solend.supportedIntents).toContain('withdraw');
    });

    it('should validate valid supply params', () => {
      const params = {
        amount: 100,
        token: 'USDC'
      };
      expect(solend.validateParams(params)).toBe(true);
    });

    it('should build supply transaction', async () => {
      const intent = {
        intent: 'supply',
        params: {
          amount: 100,
          token: 'USDC'
        },
        payer: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
      };

      const instructions = await solend.build(intent);
      expect(instructions).toBeDefined();
      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions[0].programId.toString()).toBe('ALLegCXWQTf5Jj5k2hJVVkFGSpw8KfxV1xHYQGUMg2n');
    });
  });

  describe('Protocol Registry Integration', () => {
    it('should register all lending protocols', () => {
      expect(ProtocolRegistry.getHandler('kamino')).toBeDefined();
      expect(ProtocolRegistry.getHandler('marginfi')).toBeDefined();
      expect(ProtocolRegistry.getHandler('solend')).toBeDefined();
    });

    it('should find handlers by intent', () => {
      expect(ProtocolRegistry.getHandler('supply')).toBeDefined();
      expect(ProtocolRegistry.getHandler('borrow')).toBeDefined();
      expect(ProtocolRegistry.getHandler('repay')).toBeDefined();
      expect(ProtocolRegistry.getHandler('withdraw')).toBeDefined();
    });

    it('should include lending protocols in protocol list', () => {
      const protocolInfo = ProtocolRegistry.getProtocolInfo();
      const protocolNames = protocolInfo.map(p => p.name);
      
      expect(protocolNames).toContain('kamino');
      expect(protocolNames).toContain('marginfi');
      expect(protocolNames).toContain('solend');
    });
  });

  describe('Lending NLP Parsing', () => {
    it('should parse Kamino supply intent', () => {
      const result = IntentParser.parseNaturalLanguage({
        prompt: 'supply 100 USDC to Kamino',
        payer: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
      });
      
      expect(result.protocol).toBe('kamino');
      expect(result.action).toBe('supply');
      expect(result.params.amount).toBe(100);
      expect(result.params.token).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC mint
    });

    it('should parse Kamino deposit intent', () => {
      const result = IntentParser.parseNaturalLanguage({
        prompt: 'deposit 50 SOL on Kamino',
        payer: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
      });
      
      expect(result.protocol).toBe('kamino');
      expect(result.action).toBe('supply');
      expect(result.params.amount).toBe(50);
      expect(result.params.token).toBe('So11111111111111111111111111111111111111112'); // SOL mint
    });

    it('should parse Kamino borrow intent', () => {
      const result = IntentParser.parseNaturalLanguage({
        prompt: 'borrow 1 SOL on Kamino',
        payer: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
      });
      
      expect(result.protocol).toBe('kamino');
      expect(result.action).toBe('borrow');
      expect(result.params.amount).toBe(1);
      expect(result.params.token).toBe('So11111111111111111111111111111111111111112'); // SOL mint
    });

    it('should parse Kamino repay intent', () => {
      const result = IntentParser.parseNaturalLanguage({
        prompt: 'repay 25 USDC on Kamino',
        payer: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
      });
      
      expect(result.protocol).toBe('kamino');
      expect(result.action).toBe('repay');
      expect(result.params.amount).toBe(25);
      expect(result.params.token).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC mint
    });

    it('should parse Kamino withdraw intent', () => {
      const result = IntentParser.parseNaturalLanguage({
        prompt: 'withdraw 100 USDC from Kamino',
        payer: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
      });
      
      expect(result.protocol).toBe('kamino');
      expect(result.action).toBe('withdraw');
      expect(result.params.amount).toBe(100);
      expect(result.params.token).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC mint
    });

    it('should parse Marginfi supply intent', () => {
      const result = IntentParser.parseNaturalLanguage({
        prompt: 'supply 200 USDC to Marginfi',
        payer: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
      });
      
      expect(result.protocol).toBe('marginfi');
      expect(result.action).toBe('supply');
      expect(result.params.amount).toBe(200);
      expect(result.params.token).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC mint
    });

    it('should parse Marginfi deposit with "into" preposition', () => {
      const result = IntentParser.parseNaturalLanguage({
        prompt: 'deposit 500 USDC into Marginfi',
        payer: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
      });
      
      expect(result.protocol).toBe('marginfi');
      expect(result.action).toBe('supply');
      expect(result.params.amount).toBe(500);
      expect(result.params.token).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC mint
    });

    it('should parse Marginfi borrow intent', () => {
      const result = IntentParser.parseNaturalLanguage({
        prompt: 'borrow 0.5 SOL from Marginfi',
        payer: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
      });
      
      expect(result.protocol).toBe('marginfi');
      expect(result.action).toBe('borrow');
      expect(result.params.amount).toBe(0.5);
      expect(result.params.token).toBe('So11111111111111111111111111111111111111112'); // SOL mint
    });

    it('should parse Solend supply intent', () => {
      const result = IntentParser.parseNaturalLanguage({
        prompt: 'lend 150 USDC to Solend',
        payer: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
      });
      
      expect(result.protocol).toBe('solend');
      expect(result.action).toBe('supply');
      expect(result.params.amount).toBe(150);
      expect(result.params.token).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC mint
    });

    it('should parse Solend repay with "pay back" variation', () => {
      const result = IntentParser.parseNaturalLanguage({
        prompt: 'pay back 25 USDC on Solend',
        payer: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
      });
      
      expect(result.protocol).toBe('solend');
      expect(result.action).toBe('repay');
      expect(result.params.amount).toBe(25);
      expect(result.params.token).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC mint
    });

    it('should parse generic supply intent (defaults to Kamino)', () => {
      const result = IntentParser.parseNaturalLanguage({
        prompt: 'supply 100 USDC',
        payer: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
      });
      
      expect(result.protocol).toBe('kamino');
      expect(result.action).toBe('supply');
      expect(result.params.amount).toBe(100);
      expect(result.params.token).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC mint
    });

    it('should handle decimal amounts', () => {
      const result = IntentParser.parseNaturalLanguage({
        prompt: 'supply 2.5 SOL to Kamino',
        payer: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
      });
      
      expect(result.protocol).toBe('kamino');
      expect(result.action).toBe('supply');
      expect(result.params.amount).toBe(2.5);
      expect(result.params.token).toBe('So11111111111111111111111111111111111111112'); // SOL mint
    });

    it('should handle case insensitive protocol names', () => {
      const result = IntentParser.parseNaturalLanguage({
        prompt: 'supply 100 USDC to KAMINO',
        payer: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
      });
      
      expect(result.protocol).toBe('kamino');
      expect(result.action).toBe('supply');
      expect(result.params.amount).toBe(100);
      expect(result.params.token).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC mint
    });
  });

  describe('Lending Multi-Intent Parsing', () => {
    it('should parse supply and borrow combination', () => {
      const results = IntentParser.parseMultipleIntents('supply 100 USDC to Kamino and borrow 1 SOL on Marginfi');
      
      expect(results).toHaveLength(2);
      
      expect(results[0].protocol).toBe('kamino');
      expect(results[0].action).toBe('supply');
      expect(results[0].params.amount).toBe(100);
      
      expect(results[1].protocol).toBe('marginfi');
      expect(results[1].action).toBe('borrow');
      expect(results[1].params.amount).toBe(1);
    });

    it('should parse repay then withdraw combination', () => {
      const results = IntentParser.parseMultipleIntents('repay 25 USDC on Solend then withdraw 50 USDC from Kamino');
      
      expect(results).toHaveLength(2);
      
      expect(results[0].protocol).toBe('solend');
      expect(results[0].action).toBe('repay');
      expect(results[0].params.amount).toBe(25);
      
      expect(results[1].protocol).toBe('kamino');
      expect(results[1].action).toBe('withdraw');
      expect(results[1].params.amount).toBe(50);
    });
  });
});