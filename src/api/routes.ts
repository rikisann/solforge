import { Router, Request, Response } from 'express';
import { TransactionBuilder } from '../engine/builder';
import { IntentParser } from '../engine/intent-parser';
import { TransactionDecoder } from '../engine/decoder';
import { TransactionEstimator } from '../engine/estimator';
import { ProtocolRegistry } from '../protocols';
import { BuildIntent, NaturalLanguageIntent, MultiBuildIntent, DecodeRequest, EstimateRequest } from '../utils/types';
import { 
  validateBuildIntent, 
  validateNaturalIntent,
  validateMultiBuildIntent,
  validateDecodeRequest,
  validateEstimateRequest,
  rateLimiter,
  logRequests
} from './middleware';

const router = Router();

// Apply middleware to all routes
router.use(rateLimiter(
  parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
));
router.use(logRequests);

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
      computeBudget: naturalIntent.computeBudget,
      skipSimulation: (req.body as any).skipSimulation
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

// Build multi-intent transaction
router.post('/api/build/multi', validateMultiBuildIntent, async (req: Request, res: Response) => {
  try {
    const multiIntent: MultiBuildIntent = req.body;
    const result = await TransactionBuilder.buildMultiTransaction(multiIntent);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Decode transaction
router.post('/api/decode', validateDecodeRequest, async (req: Request, res: Response) => {
  try {
    const decodeRequest: DecodeRequest = req.body;
    const result = await TransactionDecoder.decodeTransaction(decodeRequest.transaction);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to decode transaction'
    });
  }
});

// Estimate transaction costs
router.post('/api/estimate', validateEstimateRequest, async (req: Request, res: Response) => {
  try {
    const estimateRequest: EstimateRequest = req.body;
    const result = await TransactionEstimator.estimateTransaction(estimateRequest);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to estimate transaction'
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

// Comprehensive API documentation endpoint
router.get('/api/docs', (req: Request, res: Response) => {
  try {
    const protocols = ProtocolRegistry.getAllProtocols();
    const documentation: Record<string, any> = {};

    protocols.forEach(protocol => {
      const examples = getProtocolExamples(protocol.name);
      const schema = getProtocolSchema(protocol.name);
      
      documentation[protocol.name] = {
        name: protocol.name,
        description: protocol.description,
        supportedIntents: protocol.supportedIntents,
        programId: getProtocolProgramId(protocol.name),
        schema,
        examples
      };
    });

    res.json({
      success: true,
      version: '1.0.0',
      title: 'SolForge API Documentation',
      description: 'Universal Solana transaction builder API - Any protocol. Any instruction. One API.',
      protocols: documentation,
      usage: {
        structured: '/api/build',
        natural: '/api/build/natural',
        quote: '/api/quote',
        protocolInfo: '/api/protocols/:name',
        protocolSchema: '/api/protocols/:name/schema'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate documentation'
    });
  }
});

// Get JSON schema for a protocol's parameters
router.get('/api/protocols/:name/schema', (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const handler = ProtocolRegistry.getHandler(name);
    
    if (!handler) {
      return res.status(404).json({
        success: false,
        error: `Protocol '${name}' not found`
      });
    }

    const schema = getProtocolSchema(name);
    
    res.json({
      success: true,
      protocol: name,
      schema
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch protocol schema'
    });
  }
});

// Helper methods for protocol-specific information
function getProtocolExamples(protocolName: string): Record<string, any> {
  switch (protocolName) {
    case 'system':
      return {
        transfer: { intent: 'transfer', params: { amount: 0.1, to: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' } },
        'create-account': { intent: 'create-account', params: { space: 165, lamports: 2039280, programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' } }
      };
    case 'spl-token':
      return {
        'token-transfer': { intent: 'token-transfer', params: { amount: 100, token: 'USDC', to: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' } },
        'create-ata': { intent: 'create-ata', params: { token: 'USDC', owner: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' } },
        'close-account': { intent: 'close-account', params: { token: 'USDC' } }
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
    case 'raydium':
      return {
        'raydium-swap': { intent: 'raydium-swap', params: { from: 'SOL', to: 'USDC', amount: 1.0, pool: '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2', slippage: 1.0 } }
      };
    case 'pumpfun':
      return {
        'pumpfun-buy': { intent: 'pumpfun-buy', params: { token: 'BonkCoinmintaddress...', amount: 1.0, slippage: 2.0 } },
        'pumpfun-sell': { intent: 'pumpfun-sell', params: { token: 'BonkCoinmintaddress...', amount: 1000, slippage: 2.0 } },
        'pumpfun-create': { intent: 'pumpfun-create', params: { name: 'My Token', symbol: 'MTK', uri: 'https://example.com/metadata.json' } }
      };
    case 'orca':
      return {
        'orca-swap': { intent: 'orca-swap', params: { from: 'SOL', to: 'USDC', amount: 1.0, pool: 'HJPjoWUrhoZzkNfRpHuieeFk9WcZWjwy6PBjZ81ngndJ', slippage: 0.5 } },
        'orca-open-position': { intent: 'orca-open-position', params: { pool: 'HJPjoWUrhoZzkNfRpHuieeFk9WcZWjwy6PBjZ81ngndJ', lowerPrice: 95.0, upperPrice: 105.0, liquidity: 1000 } },
        'orca-close-position': { intent: 'orca-close-position', params: { position: 'PositionAddress12345...' } }
      };
    case 'marinade':
      return {
        'marinade-stake': { intent: 'marinade-stake', params: { amount: 1.0 } },
        'marinade-unstake': { intent: 'marinade-unstake', params: { amount: 0.95 } }
      };
    case 'meteora':
      return {
        'meteora-swap': { intent: 'meteora-swap', params: { from: 'SOL', to: 'USDC', amount: 1.0, pool: 'MeteoraPoolAddress...', slippage: 1.0 } },
        'meteora-add-liquidity': { intent: 'meteora-add-liquidity', params: { pool: 'MeteoraPoolAddress...', amount: 1000 } },
        'meteora-remove-liquidity': { intent: 'meteora-remove-liquidity', params: { pool: 'MeteoraPoolAddress...', amount: 500 } }
      };
    case 'token2022':
      return {
        'token2022-transfer': { intent: 'token2022-transfer', params: { amount: 100, token: 'TokenMintAddress...', to: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' } },
        'token2022-create-ata': { intent: 'token2022-create-ata', params: { token: 'TokenMintAddress...' } }
      };
    case 'stake':
      return {
        stake: { intent: 'stake', params: { amount: 1.0, validator: 'ValidatorVoteAccount...' } },
        delegate: { intent: 'delegate', params: { stakeAccount: 'StakeAccount...', validator: 'ValidatorVoteAccount...' } },
        deactivate: { intent: 'deactivate', params: { stakeAccount: 'StakeAccount...' } },
        withdraw: { intent: 'withdraw', params: { stakeAccount: 'StakeAccount...', amount: 0.9, destination: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' } }
      };
    default:
      return {};
  }
}

function getProtocolSchema(protocolName: string): Record<string, any> {
  switch (protocolName) {
    case 'system':
      return {
        intents: {
          transfer: {
            required: ['amount', 'to'],
            optional: [],
            params: {
              amount: { type: 'number', description: 'Amount of SOL to transfer' },
              to: { type: 'string', description: 'Recipient wallet address (pubkey)' }
            },
            example: { amount: 0.1, to: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' }
          },
          'create-account': {
            required: ['space', 'lamports', 'programId'],
            optional: [],
            params: {
              space: { type: 'number', description: 'Space in bytes for the new account' },
              lamports: { type: 'number', description: 'Lamports to fund the account' },
              programId: { type: 'string', description: 'Program that will own this account' }
            },
            example: { space: 165, lamports: 2039280, programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }
          }
        }
      };
    case 'spl-token':
      return {
        intents: {
          'token-transfer': {
            required: ['amount', 'token', 'to'],
            optional: [],
            params: {
              amount: { type: 'number', description: 'Amount of tokens to transfer' },
              token: { type: 'string', description: 'Token symbol (e.g. USDC) or mint address' },
              to: { type: 'string', description: 'Recipient wallet address (pubkey)' }
            },
            example: { amount: 100, token: 'USDC', to: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' }
          },
          'create-ata': {
            required: ['token'],
            optional: ['owner'],
            params: {
              token: { type: 'string', description: 'Token symbol (e.g. USDC) or mint address' },
              owner: { type: 'string', description: 'Owner of the ATA (defaults to payer)', optional: true }
            },
            example: { token: 'USDC', owner: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' }
          },
          'close-account': {
            required: ['token'],
            optional: [],
            params: {
              token: { type: 'string', description: 'Token symbol (e.g. USDC) or mint address' }
            },
            example: { token: 'USDC' }
          }
        }
      };
    case 'jupiter':
      return {
        intents: {
          swap: {
            required: ['from', 'to', 'amount'],
            optional: ['slippage'],
            params: {
              from: { type: 'string', description: 'Input token symbol (e.g. SOL, USDC)' },
              to: { type: 'string', description: 'Output token symbol (e.g. SOL, USDC)' },
              amount: { type: 'number', description: 'Amount of input token to swap' },
              slippage: { type: 'number', description: 'Maximum slippage percentage (default 0.5%)', optional: true, default: 0.5 }
            },
            example: { from: 'SOL', to: 'USDC', amount: 1.0, slippage: 0.5 }
          }
        }
      };
    case 'memo':
      return {
        intents: {
          memo: {
            required: ['message'],
            optional: [],
            params: {
              message: { type: 'string', description: 'Message to write on-chain' }
            },
            example: { message: 'Hello Solana!' }
          }
        }
      };
    case 'jito':
      return {
        intents: {
          tip: {
            required: [],
            optional: ['amount'],
            params: {
              amount: { type: 'number', description: 'Tip amount in SOL (default 0.001)', optional: true, default: 0.001 }
            },
            example: { amount: 0.001 }
          }
        }
      };
    case 'raydium':
      return {
        intents: {
          'raydium-swap': {
            required: ['from', 'to', 'amount'],
            optional: ['pool', 'slippage'],
            params: {
              from: { type: 'string', description: 'Input token symbol' },
              to: { type: 'string', description: 'Output token symbol' },
              amount: { type: 'number', description: 'Amount to swap' },
              pool: { type: 'string', description: 'Specific pool address (optional)', optional: true },
              slippage: { type: 'number', description: 'Maximum slippage percentage', optional: true }
            },
            example: { from: 'SOL', to: 'USDC', amount: 1.0, slippage: 1.0 }
          }
        }
      };
    case 'pumpfun':
      return {
        intents: {
          'pumpfun-buy': {
            required: ['token', 'amount'],
            optional: ['slippage'],
            params: {
              token: { type: 'string', description: 'Token mint address' },
              amount: { type: 'number', description: 'Amount of SOL to spend' },
              slippage: { type: 'number', description: 'Maximum slippage percentage', optional: true }
            },
            example: { token: 'BonkCoinmintaddress...', amount: 1.0, slippage: 2.0 }
          },
          'pumpfun-sell': {
            required: ['token', 'amount'],
            optional: ['slippage'],
            params: {
              token: { type: 'string', description: 'Token mint address' },
              amount: { type: 'number', description: 'Amount of tokens to sell' },
              slippage: { type: 'number', description: 'Maximum slippage percentage', optional: true }
            },
            example: { token: 'BonkCoinmintaddress...', amount: 1000, slippage: 2.0 }
          },
          'pumpfun-create': {
            required: ['name', 'symbol', 'uri'],
            optional: [],
            params: {
              name: { type: 'string', description: 'Token name' },
              symbol: { type: 'string', description: 'Token symbol' },
              uri: { type: 'string', description: 'Metadata URI' }
            },
            example: { name: 'My Token', symbol: 'MTK', uri: 'https://example.com/metadata.json' }
          }
        }
      };
    case 'orca':
      return {
        intents: {
          'orca-swap': {
            required: ['from', 'to', 'amount'],
            optional: ['pool', 'slippage'],
            params: {
              from: { type: 'string', description: 'Input token symbol' },
              to: { type: 'string', description: 'Output token symbol' },
              amount: { type: 'number', description: 'Amount to swap' },
              pool: { type: 'string', description: 'Specific pool address (optional)', optional: true },
              slippage: { type: 'number', description: 'Maximum slippage percentage', optional: true }
            },
            example: { from: 'SOL', to: 'USDC', amount: 1.0, slippage: 0.5 }
          },
          'orca-open-position': {
            required: ['pool', 'lowerPrice', 'upperPrice', 'liquidity'],
            optional: [],
            params: {
              pool: { type: 'string', description: 'Pool address' },
              lowerPrice: { type: 'number', description: 'Lower price bound' },
              upperPrice: { type: 'number', description: 'Upper price bound' },
              liquidity: { type: 'number', description: 'Liquidity amount' }
            },
            example: { pool: 'HJPjoWUrhoZzkNfRpHuieeFk9WcZWjwy6PBjZ81ngndJ', lowerPrice: 95.0, upperPrice: 105.0, liquidity: 1000 }
          },
          'orca-close-position': {
            required: ['position'],
            optional: [],
            params: {
              position: { type: 'string', description: 'Position address to close' }
            },
            example: { position: 'PositionAddress12345...' }
          }
        }
      };
    case 'marinade':
      return {
        intents: {
          'marinade-stake': {
            required: ['amount'],
            optional: [],
            params: {
              amount: { type: 'number', description: 'Amount of SOL to stake' }
            },
            example: { amount: 1.0 }
          },
          'marinade-unstake': {
            required: ['amount'],
            optional: [],
            params: {
              amount: { type: 'number', description: 'Amount of mSOL to unstake' }
            },
            example: { amount: 0.95 }
          }
        }
      };
    case 'meteora':
      return {
        intents: {
          'meteora-swap': {
            required: ['from', 'to', 'amount'],
            optional: ['pool', 'slippage'],
            params: {
              from: { type: 'string', description: 'Input token symbol' },
              to: { type: 'string', description: 'Output token symbol' },
              amount: { type: 'number', description: 'Amount to swap' },
              pool: { type: 'string', description: 'Specific pool address (optional)', optional: true },
              slippage: { type: 'number', description: 'Maximum slippage percentage', optional: true }
            },
            example: { from: 'SOL', to: 'USDC', amount: 1.0, slippage: 1.0 }
          },
          'meteora-add-liquidity': {
            required: ['pool', 'amount'],
            optional: [],
            params: {
              pool: { type: 'string', description: 'Pool address' },
              amount: { type: 'number', description: 'Liquidity amount to add' }
            },
            example: { pool: 'MeteoraPoolAddress...', amount: 1000 }
          },
          'meteora-remove-liquidity': {
            required: ['pool', 'amount'],
            optional: [],
            params: {
              pool: { type: 'string', description: 'Pool address' },
              amount: { type: 'number', description: 'Liquidity amount to remove' }
            },
            example: { pool: 'MeteoraPoolAddress...', amount: 500 }
          }
        }
      };
    case 'token2022':
      return {
        intents: {
          'token2022-transfer': {
            required: ['amount', 'token', 'to'],
            optional: [],
            params: {
              amount: { type: 'number', description: 'Amount of tokens to transfer' },
              token: { type: 'string', description: 'Token mint address' },
              to: { type: 'string', description: 'Recipient wallet address (pubkey)' }
            },
            example: { amount: 100, token: 'TokenMintAddress...', to: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' }
          },
          'token2022-create-ata': {
            required: ['token'],
            optional: [],
            params: {
              token: { type: 'string', description: 'Token mint address' }
            },
            example: { token: 'TokenMintAddress...' }
          }
        }
      };
    case 'stake':
      return {
        intents: {
          stake: {
            required: ['amount'],
            optional: ['validator'],
            params: {
              amount: { type: 'number', description: 'Amount of SOL to stake' },
              validator: { type: 'string', description: 'Validator vote account pubkey (optional)', optional: true }
            },
            example: { amount: 1.0, validator: 'ValidatorVoteAccount...' }
          },
          delegate: {
            required: ['stakeAccount', 'validator'],
            optional: [],
            params: {
              stakeAccount: { type: 'string', description: 'Stake account address' },
              validator: { type: 'string', description: 'Validator vote account pubkey' }
            },
            example: { stakeAccount: 'StakeAccount...', validator: 'ValidatorVoteAccount...' }
          },
          deactivate: {
            required: ['stakeAccount'],
            optional: [],
            params: {
              stakeAccount: { type: 'string', description: 'Stake account address to deactivate' }
            },
            example: { stakeAccount: 'StakeAccount...' }
          },
          withdraw: {
            required: ['stakeAccount', 'amount'],
            optional: ['destination'],
            params: {
              stakeAccount: { type: 'string', description: 'Stake account address' },
              amount: { type: 'number', description: 'Amount to withdraw' },
              destination: { type: 'string', description: 'Destination wallet address (optional)', optional: true }
            },
            example: { stakeAccount: 'StakeAccount...', amount: 0.9, destination: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' }
          }
        }
      };
    default:
      return {};
  }
}

function getProtocolProgramId(protocolName: string): string {
  const programIds: Record<string, string> = {
    system: '11111111111111111111111111111112',
    'spl-token': 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    jupiter: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
    memo: 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
    jito: 'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
    raydium: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
    pumpfun: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
    orca: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
    marinade: '8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC',
    meteora: 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
    token2022: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
    stake: 'Stake11111111111111111111111111111111111111'
  };
  
  return programIds[protocolName] || 'Unknown';
}

function getProtocolDocumentation(protocolName: string): string {
  return `https://docs.solforge.dev/protocols/${protocolName}`;
}

export default router;