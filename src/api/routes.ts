import { Router, Request, Response } from 'express';
import { TransactionBuilder } from '../engine/builder';
import { IntentParser } from '../engine/intent-parser';
import { ProtocolRegistry } from '../protocols';
import { BuildIntent, NaturalLanguageIntent } from '../utils/types';
import { 
  validateBuildIntent, 
  validateNaturalIntent,
  rateLimiter 
} from './middleware';

const router = Router();

// Apply rate limiting to all routes
router.use(rateLimiter(
  parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
));

// Health check
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'SolForge API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Build transaction from structured intent
router.post('/api/build', validateBuildIntent, async (req: Request, res: Response) => {
  try {
    const intent: BuildIntent = req.body;
    const result = await TransactionBuilder.buildTransaction(intent);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Build transaction from natural language
router.post('/api/build/natural', validateNaturalIntent, async (req: Request, res: Response) => {
  try {
    const naturalIntent: NaturalLanguageIntent = req.body;
    
    // Parse natural language to structured intent
    const parsedIntent = IntentParser.parseNaturalLanguage(naturalIntent);
    
    // Convert to BuildIntent
    const buildIntent: BuildIntent = {
      intent: parsedIntent.action,
      params: parsedIntent.params,
      payer: naturalIntent.payer,
      network: naturalIntent.network,
      priorityFee: naturalIntent.priorityFee,
      computeBudget: naturalIntent.computeBudget
    };

    // Special handling for Jupiter swaps (they return complete transactions)
    if (parsedIntent.protocol === 'jupiter') {
      try {
        const jupiterProtocol = ProtocolRegistry.getHandler('jupiter') as any;
        const transaction = await jupiterProtocol.buildSwapTransaction(buildIntent);
        
        res.json({
          success: true,
          transaction,
          details: {
            protocol: 'jupiter',
            parsedIntent: parsedIntent,
            confidence: parsedIntent.confidence
          }
        });
        return;
      } catch (jupiterError) {
        // Fall back to regular transaction building if Jupiter fails
        console.warn('Jupiter direct build failed, falling back:', jupiterError);
      }
    }

    // Build transaction normally
    const result = await TransactionBuilder.buildTransaction(buildIntent);
    
    // Add parsing details to response
    if (result.success && result.details) {
      result.details.parsedIntent = parsedIntent;
      result.details.confidence = parsedIntent.confidence;
    }
    
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse intent'
    });
  }
});

// Get supported protocols
router.get('/api/protocols', (req: Request, res: Response) => {
  try {
    const protocols = ProtocolRegistry.getProtocolInfo();
    
    res.json({
      success: true,
      protocols,
      count: protocols.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch protocols'
    });
  }
});

// Get details about a specific protocol
router.get('/api/protocols/:name', (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const handler = ProtocolRegistry.getHandler(name);
    
    if (!handler) {
      return res.status(404).json({
        success: false,
        error: `Protocol '${name}' not found`
      });
    }

    // Get protocol-specific documentation and examples
    const info = {
      name: handler.name,
      description: handler.description,
      supportedIntents: handler.supportedIntents,
      examples: getProtocolExamples(handler.name),
      documentation: getProtocolDocumentation(handler.name)
    };

    res.json({
      success: true,
      protocol: info
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch protocol details'
    });
  }
});

// Get natural language examples
router.get('/api/examples', (req: Request, res: Response) => {
  try {
    const examples = IntentParser.getExamples();
    const supportedActions = IntentParser.getSupportedActions();
    
    res.json({
      success: true,
      examples,
      supportedActions,
      tips: [
        'Use specific token symbols (SOL, USDC, USDT, etc.)',
        'Include slippage for swaps (e.g., "with 0.5% slippage")',
        'Use full wallet addresses for transfers',
        'Quote memo messages for clarity'
      ]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch examples'
    });
  }
});

// Quote endpoint for Jupiter swaps (get price without building transaction)
router.post('/api/quote', async (req: Request, res: Response) => {
  try {
    const { from, to, amount } = req.body;
    
    if (!from || !to || !amount) {
      return res.status(400).json({
        success: false,
        error: 'from, to, and amount are required'
      });
    }

    const jupiterHandler = ProtocolRegistry.getHandler('jupiter') as any;
    if (!jupiterHandler || typeof jupiterHandler.getSwapQuote !== 'function') {
      return res.status(503).json({
        success: false,
        error: 'Quote service unavailable'
      });
    }

    const quote = await jupiterHandler.getSwapQuote({
      from,
      to,
      amount,
      slippage: req.body.slippage || 0.5
    });

    res.json({
      success: true,
      quote
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get quote'
    });
  }
});

// Helper methods for protocol-specific information
function getProtocolExamples(protocolName: string): Record<string, any> {
  switch (protocolName) {
    case 'system':
      return {
        transfer: { intent: 'transfer', params: { amount: 0.1, to: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' } }
      };
    case 'spl-token':
      return {
        transfer: { intent: 'token-transfer', params: { amount: 100, token: 'USDC', to: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' } },
        createAccount: { intent: 'create-ata', params: { token: 'USDC' } }
      };
    case 'jupiter':
      return {
        swap: { intent: 'swap', params: { from: 'SOL', to: 'USDC', amount: 1.0, slippage: 0.5 } }
      };
    case 'memo':
      return {
        memo: { intent: 'memo', params: { message: 'Hello Solana!' } }
      };
    case 'jito':
      return {
        tip: { intent: 'tip', params: { amount: 0.001 } }
      };
    default:
      return {};
  }
}

function getProtocolDocumentation(protocolName: string): string {
  return `https://docs.solforge.dev/protocols/${protocolName}`;
}

export default router;