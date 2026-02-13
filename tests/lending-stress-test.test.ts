import { IntentParser } from '../src/engine/intent-parser';
import { NaturalLanguageIntent } from '../src/utils/types';
import { TEST_PAYER } from './setup';

describe('Lending Protocols NLP Stress Test', () => {
  const createIntent = (prompt: string): NaturalLanguageIntent => ({
    prompt,
    payer: TEST_PAYER,
    network: 'devnet'
  });

  describe('Supply/Deposit Variations - Kamino', () => {
    const testCases = [
      // Basic patterns
      { phrase: 'supply 100 USDC to Kamino', protocol: 'kamino', action: 'supply', amount: 100, token: 'USDC' },
      { phrase: 'deposit 100 USDC on Kamino', protocol: 'kamino', action: 'supply', amount: 100, token: 'USDC' },
      { phrase: 'deposit 100 USDC into Kamino', protocol: 'kamino', action: 'supply', amount: 100, token: 'USDC' },
      { phrase: 'lend 100 USDC on Kamino', protocol: 'kamino', action: 'supply', amount: 100, token: 'USDC' },
      { phrase: 'lend 100 USDC to Kamino', protocol: 'kamino', action: 'supply', amount: 100, token: 'USDC' },
      
      // Alternative prepositions
      { phrase: 'put 100 USDC into Kamino', protocol: 'kamino', action: 'supply', amount: 100, token: 'USDC' },
      { phrase: 'add 100 USDC to Kamino', protocol: 'kamino', action: 'supply', amount: 100, token: 'USDC' },
      { phrase: 'provide 100 USDC to Kamino lending', protocol: 'kamino', action: 'supply', amount: 100, token: 'USDC' },
      { phrase: 'provide 100 USDC to Kamino', protocol: 'kamino', action: 'supply', amount: 100, token: 'USDC' },
      
      // Different amounts and tokens
      { phrase: 'deposit 50 SOL into Kamino', protocol: 'kamino', action: 'supply', amount: 50, token: 'SOL' },
      { phrase: 'supply 100.50 USDC to Kamino', protocol: 'kamino', action: 'supply', amount: 100.50, token: 'USDC' },
      { phrase: 'supply 0.001 SOL to Kamino', protocol: 'kamino', action: 'supply', amount: 0.001, token: 'SOL' },
      
      // Case variations
      { phrase: 'supply 100 usdc to kamino', protocol: 'kamino', action: 'supply', amount: 100, token: 'USDC' },
      { phrase: 'SUPPLY 100 USDC TO KAMINO', protocol: 'kamino', action: 'supply', amount: 100, token: 'USDC' },
      { phrase: 'Supply 100 Usdc To Kamino', protocol: 'kamino', action: 'supply', amount: 100, token: 'USDC' },
      
      // Protocol name variations
      { phrase: 'supply 100 USDC to KAMINO', protocol: 'kamino', action: 'supply', amount: 100, token: 'USDC' },
      { phrase: 'supply 100 USDC to Kamino Finance', protocol: 'kamino', action: 'supply', amount: 100, token: 'USDC' },
      { phrase: 'supply 100 USDC to klend', protocol: 'kamino', action: 'supply', amount: 100, token: 'USDC' },
      
      // Additional verbs
      { phrase: 'invest 100 USDC in Kamino', protocol: 'kamino', action: 'supply', amount: 100, token: 'USDC' },
      { phrase: 'stake 100 USDC on Kamino', protocol: 'kamino', action: 'supply', amount: 100, token: 'USDC' },
      { phrase: 'lock 100 USDC in Kamino', protocol: 'kamino', action: 'supply', amount: 100, token: 'USDC' },
    ];

    testCases.forEach(({ phrase, protocol, action, amount, token }) => {
      it(`should parse "${phrase}"`, () => {
        const intent = createIntent(phrase);
        const result = IntentParser.parseNaturalLanguage(intent);
        
        expect(result.protocol).toBe(protocol);
        expect(result.action).toBe(action);
        expect(result.params.amount).toBe(amount);
        expect(result.params.token.toLowerCase()).toContain(token.toLowerCase() === 'sol' ? 'so11111111111111111111111111111111111111112' : 'epjfwdd5aufqssqem2qn1xzybapC8G4wEGGkZwyTDt1v'.slice(0, 10));
      });
    });
  });

  describe('Supply/Deposit Variations - Marginfi', () => {
    const testCases = [
      { phrase: 'supply 200 USDC to Marginfi', protocol: 'marginfi', action: 'supply', amount: 200, token: 'USDC' },
      { phrase: 'deposit 500 USDC into Marginfi', protocol: 'marginfi', action: 'supply', amount: 500, token: 'USDC' },
      { phrase: 'deposit 500 USDC on Marginfi', protocol: 'marginfi', action: 'supply', amount: 500, token: 'USDC' },
      { phrase: 'lend 1000 USDC on marginfi', protocol: 'marginfi', action: 'supply', amount: 1000, token: 'USDC' },
      { phrase: 'put 100 USDC into Marginfi', protocol: 'marginfi', action: 'supply', amount: 100, token: 'USDC' },
      { phrase: 'add 250 USDC to Marginfi', protocol: 'marginfi', action: 'supply', amount: 250, token: 'USDC' },
      { phrase: 'provide 75 SOL to Marginfi', protocol: 'marginfi', action: 'supply', amount: 75, token: 'SOL' },
      
      // Protocol name variations
      { phrase: 'supply 100 USDC to MarginFi', protocol: 'marginfi', action: 'supply', amount: 100, token: 'USDC' },
      { phrase: 'supply 100 USDC to margin fi', protocol: 'marginfi', action: 'supply', amount: 100, token: 'USDC' },
      { phrase: 'supply 100 USDC to mrgnlend', protocol: 'marginfi', action: 'supply', amount: 100, token: 'USDC' },
      { phrase: 'supply 100 USDC to MARGINFI', protocol: 'marginfi', action: 'supply', amount: 100, token: 'USDC' },
      
      // Additional verbs
      { phrase: 'invest 100 USDC in Marginfi', protocol: 'marginfi', action: 'supply', amount: 100, token: 'USDC' },
      { phrase: 'deposit my 50 SOL into Marginfi', protocol: 'marginfi', action: 'supply', amount: 50, token: 'SOL' },
      { phrase: 'lock up 200 USDC in Marginfi', protocol: 'marginfi', action: 'supply', amount: 200, token: 'USDC' },
    ];

    testCases.forEach(({ phrase, protocol, action, amount, token }) => {
      it(`should parse "${phrase}"`, () => {
        const intent = createIntent(phrase);
        const result = IntentParser.parseNaturalLanguage(intent);
        
        expect(result.protocol).toBe(protocol);
        expect(result.action).toBe(action);
        expect(result.params.amount).toBe(amount);
        expect(result.params.token.toLowerCase()).toContain(token.toLowerCase() === 'sol' ? 'so11111111111111111111111111111111111111112' : 'epjfwdd5aufqssqem2qn1xzybapC8G4wEGGkZwyTDt1v'.slice(0, 10));
      });
    });
  });

  describe('Supply/Deposit Variations - Solend', () => {
    const testCases = [
      { phrase: 'supply 150 USDC to Solend', protocol: 'solend', action: 'supply', amount: 150, token: 'USDC' },
      { phrase: 'deposit 50 SOL into solend', protocol: 'solend', action: 'supply', amount: 50, token: 'SOL' },
      { phrase: 'lend 300 USDC on Solend', protocol: 'solend', action: 'supply', amount: 300, token: 'USDC' },
      { phrase: 'put 25 SOL into Solend', protocol: 'solend', action: 'supply', amount: 25, token: 'SOL' },
      { phrase: 'add 100 USDC to Solend', protocol: 'solend', action: 'supply', amount: 100, token: 'USDC' },
      { phrase: 'provide 80 SOL to Solend lending', protocol: 'solend', action: 'supply', amount: 80, token: 'SOL' },
      
      // Protocol name variations
      { phrase: 'supply 100 USDC to SOLEND', protocol: 'solend', action: 'supply', amount: 100, token: 'USDC' },
      { phrase: 'supply 100 USDC to solend', protocol: 'solend', action: 'supply', amount: 100, token: 'USDC' },
      
      // Additional verbs
      { phrase: 'invest 100 USDC in Solend', protocol: 'solend', action: 'supply', amount: 100, token: 'USDC' },
      { phrase: 'deposit my 75 USDC to Solend', protocol: 'solend', action: 'supply', amount: 75, token: 'USDC' },
    ];

    testCases.forEach(({ phrase, protocol, action, amount, token }) => {
      it(`should parse "${phrase}"`, () => {
        const intent = createIntent(phrase);
        const result = IntentParser.parseNaturalLanguage(intent);
        
        expect(result.protocol).toBe(protocol);
        expect(result.action).toBe(action);
        expect(result.params.amount).toBe(amount);
        expect(result.params.token.toLowerCase()).toContain(token.toLowerCase() === 'sol' ? 'so11111111111111111111111111111111111111112' : 'epjfwdd5aufqssqem2qn1xzybapC8G4wEGGkZwyTDt1v'.slice(0, 10));
      });
    });
  });

  describe('Borrow Variations - All Protocols', () => {
    const testCases = [
      // Kamino
      { phrase: 'borrow 1 SOL on Kamino', protocol: 'kamino', action: 'borrow', amount: 1, token: 'SOL' },
      { phrase: 'borrow 1 SOL from Kamino', protocol: 'kamino', action: 'borrow', amount: 1, token: 'SOL' },
      { phrase: 'take a loan of 1 SOL on Kamino', protocol: 'kamino', action: 'borrow', amount: 1, token: 'SOL' },
      { phrase: 'loan me 100 USDC on Kamino', protocol: 'kamino', action: 'borrow', amount: 100, token: 'USDC' },
      { phrase: 'get a loan of 50 SOL on Kamino', protocol: 'kamino', action: 'borrow', amount: 50, token: 'SOL' },
      { phrase: 'borrow against my collateral on Kamino', protocol: 'kamino', action: 'borrow', amount: null, token: null },
      { phrase: 'take out 100 USDC from Kamino', protocol: 'kamino', action: 'borrow', amount: 100, token: 'USDC' },
      
      // Marginfi
      { phrase: 'borrow 1 SOL on Marginfi', protocol: 'marginfi', action: 'borrow', amount: 1, token: 'SOL' },
      { phrase: 'borrow 1 SOL from Marginfi', protocol: 'marginfi', action: 'borrow', amount: 1, token: 'SOL' },
      { phrase: 'take a loan of 500 USDC on Marginfi', protocol: 'marginfi', action: 'borrow', amount: 500, token: 'USDC' },
      { phrase: 'loan me 2 SOL on Marginfi', protocol: 'marginfi', action: 'borrow', amount: 2, token: 'SOL' },
      { phrase: 'get a loan of 250 USDC on Marginfi', protocol: 'marginfi', action: 'borrow', amount: 250, token: 'USDC' },
      { phrase: 'borrow against my collateral on Marginfi', protocol: 'marginfi', action: 'borrow', amount: null, token: null },
      { phrase: 'take out 150 USDC from Marginfi', protocol: 'marginfi', action: 'borrow', amount: 150, token: 'USDC' },
      
      // Solend
      { phrase: 'borrow 500 USDC from Solend', protocol: 'solend', action: 'borrow', amount: 500, token: 'USDC' },
      { phrase: 'borrow 2 SOL on Solend', protocol: 'solend', action: 'borrow', amount: 2, token: 'SOL' },
      { phrase: 'take a loan of 300 USDC on Solend', protocol: 'solend', action: 'borrow', amount: 300, token: 'USDC' },
      { phrase: 'loan me 1.5 SOL on Solend', protocol: 'solend', action: 'borrow', amount: 1.5, token: 'SOL' },
      { phrase: 'get a loan of 400 USDC from Solend', protocol: 'solend', action: 'borrow', amount: 400, token: 'USDC' },
      { phrase: 'take out 200 USDC from Solend', protocol: 'solend', action: 'borrow', amount: 200, token: 'USDC' },
    ];

    testCases.forEach(({ phrase, protocol, action, amount, token }) => {
      it(`should parse "${phrase}"`, () => {
        const intent = createIntent(phrase);
        const result = IntentParser.parseNaturalLanguage(intent);
        
        expect(result.protocol).toBe(protocol);
        expect(result.action).toBe(action);
        if (amount !== null) {
          expect(result.params.amount).toBe(amount);
        }
        if (token !== null) {
          expect(result.params.token.toLowerCase()).toContain(token.toLowerCase() === 'sol' ? 'so11111111111111111111111111111111111111112' : 'epjfwdd5aufqssqem2qn1xzybapC8G4wEGGkZwyTDt1v'.slice(0, 10));
        }
      });
    });
  });

  describe('Repay Variations - All Protocols', () => {
    const testCases = [
      // Kamino
      { phrase: 'repay 25 USDC on Kamino', protocol: 'kamino', action: 'repay', amount: 25, token: 'USDC' },
      { phrase: 'pay back 25 USDC on Kamino', protocol: 'kamino', action: 'repay', amount: 25, token: 'USDC' },
      { phrase: 'repay my loan on Kamino', protocol: 'kamino', action: 'repay', amount: null, token: null },
      { phrase: 'pay off 100 USDC on Kamino', protocol: 'kamino', action: 'repay', amount: 100, token: 'USDC' },
      { phrase: 'settle 25 USDC debt on Kamino', protocol: 'kamino', action: 'repay', amount: 25, token: 'USDC' },
      { phrase: 'repay 25 USDC to Kamino', protocol: 'kamino', action: 'repay', amount: 25, token: 'USDC' },
      { phrase: 'pay back my Kamino loan', protocol: 'kamino', action: 'repay', amount: null, token: null },
      { phrase: 'return 50 USDC to Kamino', protocol: 'kamino', action: 'repay', amount: 50, token: 'USDC' },
      
      // Marginfi
      { phrase: 'repay 100 USDC on Marginfi', protocol: 'marginfi', action: 'repay', amount: 100, token: 'USDC' },
      { phrase: 'pay back 50 SOL on Marginfi', protocol: 'marginfi', action: 'repay', amount: 50, token: 'SOL' },
      { phrase: 'repay my loan on Marginfi', protocol: 'marginfi', action: 'repay', amount: null, token: null },
      { phrase: 'pay off 200 USDC on Marginfi', protocol: 'marginfi', action: 'repay', amount: 200, token: 'USDC' },
      { phrase: 'settle 75 USDC debt on Marginfi', protocol: 'marginfi', action: 'repay', amount: 75, token: 'USDC' },
      { phrase: 'repay 150 USDC to Marginfi', protocol: 'marginfi', action: 'repay', amount: 150, token: 'USDC' },
      { phrase: 'pay back my Marginfi loan', protocol: 'marginfi', action: 'repay', amount: null, token: null },
      { phrase: 'return 80 USDC to Marginfi', protocol: 'marginfi', action: 'repay', amount: 80, token: 'USDC' },
      
      // Solend
      { phrase: 'repay 25 USDC on Solend', protocol: 'solend', action: 'repay', amount: 25, token: 'USDC' },
      { phrase: 'pay back 25 USDC on Solend', protocol: 'solend', action: 'repay', amount: 25, token: 'USDC' },
      { phrase: 'repay my loan on Solend', protocol: 'solend', action: 'repay', amount: null, token: null },
      { phrase: 'pay off 300 USDC on Solend', protocol: 'solend', action: 'repay', amount: 300, token: 'USDC' },
      { phrase: 'settle 125 USDC debt on Solend', protocol: 'solend', action: 'repay', amount: 125, token: 'USDC' },
      { phrase: 'repay 180 USDC to Solend', protocol: 'solend', action: 'repay', amount: 180, token: 'USDC' },
      { phrase: 'pay back my Solend loan', protocol: 'solend', action: 'repay', amount: null, token: null },
      { phrase: 'return 90 USDC to Solend', protocol: 'solend', action: 'repay', amount: 90, token: 'USDC' },
    ];

    testCases.forEach(({ phrase, protocol, action, amount, token }) => {
      it(`should parse "${phrase}"`, () => {
        const intent = createIntent(phrase);
        const result = IntentParser.parseNaturalLanguage(intent);
        
        expect(result.protocol).toBe(protocol);
        expect(result.action).toBe(action);
        if (amount !== null) {
          expect(result.params.amount).toBe(amount);
        }
        if (token !== null) {
          expect(result.params.token.toLowerCase()).toContain(token.toLowerCase() === 'sol' ? 'so11111111111111111111111111111111111111112' : 'epjfwdd5aufqssqem2qn1xzybapC8G4wEGGkZwyTDt1v'.slice(0, 10));
        }
      });
    });
  });

  describe('Withdraw Variations - All Protocols', () => {
    const testCases = [
      // Kamino
      { phrase: 'withdraw 100 USDC from Kamino', protocol: 'kamino', action: 'withdraw', amount: 100, token: 'USDC' },
      { phrase: 'pull out 100 USDC from Kamino', protocol: 'kamino', action: 'withdraw', amount: 100, token: 'USDC' },
      { phrase: 'remove 100 USDC from Kamino', protocol: 'kamino', action: 'withdraw', amount: 100, token: 'USDC' },
      { phrase: 'take out my USDC from Kamino', protocol: 'kamino', action: 'withdraw', amount: null, token: 'USDC' },
      { phrase: 'withdraw my collateral from Kamino', protocol: 'kamino', action: 'withdraw', amount: null, token: null },
      { phrase: 'pull 50 SOL from Kamino', protocol: 'kamino', action: 'withdraw', amount: 50, token: 'SOL' },
      { phrase: 'get my USDC back from Kamino', protocol: 'kamino', action: 'withdraw', amount: null, token: 'USDC' },
      
      // Marginfi
      { phrase: 'withdraw 100 USDC from Marginfi', protocol: 'marginfi', action: 'withdraw', amount: 100, token: 'USDC' },
      { phrase: 'pull out 200 USDC from Marginfi', protocol: 'marginfi', action: 'withdraw', amount: 200, token: 'USDC' },
      { phrase: 'remove 150 USDC from Marginfi', protocol: 'marginfi', action: 'withdraw', amount: 150, token: 'USDC' },
      { phrase: 'take out my SOL from Marginfi', protocol: 'marginfi', action: 'withdraw', amount: null, token: 'SOL' },
      { phrase: 'withdraw my collateral from Marginfi', protocol: 'marginfi', action: 'withdraw', amount: null, token: null },
      { phrase: 'pull 25 SOL from Marginfi', protocol: 'marginfi', action: 'withdraw', amount: 25, token: 'SOL' },
      { phrase: 'get my USDC back from Marginfi', protocol: 'marginfi', action: 'withdraw', amount: null, token: 'USDC' },
      
      // Solend
      { phrase: 'withdraw 100 USDC from Solend', protocol: 'solend', action: 'withdraw', amount: 100, token: 'USDC' },
      { phrase: 'pull out 300 USDC from Solend', protocol: 'solend', action: 'withdraw', amount: 300, token: 'USDC' },
      { phrase: 'remove 250 USDC from Solend', protocol: 'solend', action: 'withdraw', amount: 250, token: 'USDC' },
      { phrase: 'take out my USDC from Solend', protocol: 'solend', action: 'withdraw', amount: null, token: 'USDC' },
      { phrase: 'withdraw my collateral from Solend', protocol: 'solend', action: 'withdraw', amount: null, token: null },
      { phrase: 'pull 30 SOL from Solend', protocol: 'solend', action: 'withdraw', amount: 30, token: 'SOL' },
      { phrase: 'get my USDC back from Solend', protocol: 'solend', action: 'withdraw', amount: null, token: 'USDC' },
    ];

    testCases.forEach(({ phrase, protocol, action, amount, token }) => {
      it(`should parse "${phrase}"`, () => {
        const intent = createIntent(phrase);
        const result = IntentParser.parseNaturalLanguage(intent);
        
        expect(result.protocol).toBe(protocol);
        expect(result.action).toBe(action);
        if (amount !== null) {
          expect(result.params.amount).toBe(amount);
        }
        if (token !== null) {
          expect(result.params.token.toLowerCase()).toContain(token.toLowerCase() === 'sol' ? 'so11111111111111111111111111111111111111112' : 'epjfwdd5aufqssqem2qn1xzybapC8G4wEGGkZwyTDt1v'.slice(0, 10));
        }
      });
    });
  });

  describe('Multi-Intent Combinations', () => {
    const testCases = [
      {
        phrase: 'supply 100 USDC to Kamino and borrow 1 SOL on Marginfi',
        expectedIntents: [
          { protocol: 'kamino', action: 'supply', amount: 100, token: 'USDC' },
          { protocol: 'marginfi', action: 'borrow', amount: 1, token: 'SOL' }
        ]
      },
      {
        phrase: 'deposit 50 USDC on Solend then borrow 25 USDC',
        expectedIntents: [
          { protocol: 'solend', action: 'supply', amount: 50, token: 'USDC' },
          { protocol: 'kamino', action: 'borrow', amount: 25, token: 'USDC' } // defaults to kamino for generic borrow
        ]
      },
      {
        phrase: 'repay 100 USDC on Marginfi and withdraw 50 SOL from Kamino',
        expectedIntents: [
          { protocol: 'marginfi', action: 'repay', amount: 100, token: 'USDC' },
          { protocol: 'kamino', action: 'withdraw', amount: 50, token: 'SOL' }
        ]
      },
    ];

    testCases.forEach(({ phrase, expectedIntents }) => {
      it(`should parse multi-intent: "${phrase}"`, () => {
        const results = IntentParser.parseMultipleIntents(phrase);
        
        expect(results).toHaveLength(expectedIntents.length);
        
        expectedIntents.forEach((expected, index) => {
          expect(results[index].protocol).toBe(expected.protocol);
          expect(results[index].action).toBe(expected.action);
          expect(results[index].params.amount).toBe(expected.amount);
          expect(results[index].params.token.toLowerCase()).toContain(
            expected.token.toLowerCase() === 'sol' ? 'so11111111111111111111111111111111111111112' : 
            'epjfwdd5aufqssqem2qn1xzybapC8G4wEGGkZwyTDt1v'.slice(0, 10)
          );
        });
      });
    });
  });

  describe('Edge Cases and Challenges', () => {
    const shouldFailGracefully = [
      'supply USDC to marginfi', // no amount
      'deposit some USDC to Kamino', // vague amount
      'borrow against my collateral on Marginfi', // no specific amount/token
      'repay my loan on Marginfi', // no specific amount/token
      'withdraw my collateral from Marginfi', // no specific amount/token
    ];

    shouldFailGracefully.forEach(phrase => {
      it(`should handle gracefully: "${phrase}"`, () => {
        const intent = createIntent(phrase);
        // These should either parse with defaults or throw meaningful errors
        try {
          const result = IntentParser.parseNaturalLanguage(intent);
          // If it parses, it should have reasonable defaults or null values
          expect(result).toBeDefined();
          expect(result.protocol).toMatch(/kamino|marginfi|solend/);
          expect(result.action).toMatch(/supply|deposit|borrow|repay|withdraw/);
        } catch (error) {
          // If it fails, should be a meaningful error message
          expect(error).toBeDefined();
        }
      });
    });

    it('should handle decimal amounts correctly', () => {
      const intent = createIntent('supply 100.50 USDC to Kamino');
      const result = IntentParser.parseNaturalLanguage(intent);
      
      expect(result.protocol).toBe('kamino');
      expect(result.action).toBe('supply');
      expect(result.params.amount).toBe(100.50);
    });

    it('should handle very small amounts', () => {
      const intent = createIntent('supply 0.001 SOL to Kamino');
      const result = IntentParser.parseNaturalLanguage(intent);
      
      expect(result.protocol).toBe('kamino');
      expect(result.action).toBe('supply');
      expect(result.params.amount).toBe(0.001);
    });
  });
});