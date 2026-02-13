import { Router, Request, Response } from 'express';
import { TransactionBuilder } from '../engine/builder';
import { IntentParser } from '../engine/intent-parser';
import { TransactionDecoder } from '../engine/decoder';
import { TransactionEstimator } from '../engine/estimator';
import { TokenResolver } from '../engine/token-resolver';
import { ProtocolRegistry } from '../protocols';
import { BuildIntent, NaturalLanguageIntent, MultiBuildIntent, DecodeRequest, EstimateRequest } from '../utils/types';
import { VersionedTransaction, TransactionMessage, SystemProgram, PublicKey, TransactionInstruction, AddressLookupTableAccount } from '@solana/web3.js';
import { RPCConnection } from '../utils/connection';
import { getAgentWallet, getAgentPublicKey, isAgentWalletEnabled } from '../utils/agent-wallet';
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

// RPC proxy — keeps Helius API key server-side, browser calls /api/rpc instead of direct RPC
router.post('/api/rpc', async (req: Request, res: Response) => {
  try {
    const rpcUrl = process.env.SOLANA_MAINNET_RPC || 'https://api.mainnet-beta.solana.com';
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(502).json({ jsonrpc: '2.0', error: { code: -32000, message: 'RPC proxy error' }, id: null });
  }
});

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

// Helper function to generate actionable suggestions based on error message
function generateErrorSuggestions(error: string, parsedIntent?: any): string[] {
  const suggestions: string[] = [];
  const errorLower = error.toLowerCase();

  // Insufficient funds errors
  if (errorLower.includes('insufficient lamports') || errorLower.includes('insufficient funds')) {
    suggestions.push("Try a smaller amount");
    suggestions.push("Make sure your wallet has enough SOL");
  }
  
  // Account not found errors
  else if (errorLower.includes('accountnotfound') || errorLower.includes('account not found')) {
    suggestions.push("The wallet may not have a token account for this token");
    suggestions.push("Try with skipSimulation: true");
  }
  
  // Token resolution errors
  else if (errorLower.includes('token not found') || errorLower.includes('could not resolve')) {
    suggestions.push("Use the full mint address instead of symbol");
    suggestions.push("Check the address on solscan.io");
  }
  
  // Blockhash errors
  else if (errorLower.includes('blockhash not found') || errorLower.includes('blockhash')) {
    suggestions.push("The transaction expired, try again");
  }
  
  // Simulation errors
  else if (errorLower.includes('simulation failed')) {
    suggestions.push("Try with skipSimulation: true for testing");
    suggestions.push("Make sure wallet is funded");
  }
  
  // Intent parsing errors - low confidence or no intent parsed
  else if (errorLower.includes('could not parse intent') || 
           errorLower.includes('parse intent') || 
           (parsedIntent && parsedIntent.confidence < 0.7)) {
    suggestions.push("Try a simpler prompt like 'swap 1 SOL for USDC'");
    suggestions.push("Use the full token mint address");
  }
  
  // Jupiter-specific errors
  else if (errorLower.includes('jupiter')) {
    suggestions.push("Token may not have enough liquidity");
    suggestions.push("Try a different token pair");
  }
  
  // Generic fallback for other errors
  else if (suggestions.length === 0) {
    suggestions.push("Check that all addresses are valid");
    suggestions.push("Try with a different wallet or smaller amount");
  }

  return suggestions;
}

// Build transaction from natural language
router.post('/api/build/natural', validateNaturalIntent, async (req: Request, res: Response) => {
  let parsedIntent: any = null;
  
  try {
    const naturalIntent: NaturalLanguageIntent = req.body;
    
    // Check if the prompt contains multiple intents
    const intents = IntentParser.parseMultipleIntents(naturalIntent.prompt);
    
    if (intents.length > 1) {
      // Handle multi-intent flow
      const parsedIntents = await IntentParser.parseMultipleIntentsAsync(naturalIntent.prompt, naturalIntent.payer);
      
      // Separate Jupiter swaps from other intents
      const jupiterSwaps: any[] = [];
      const nonSwapIntents: any[] = [];
      
      for (const parsedIntent of parsedIntents) {
        // Transform buy/sell params to swap params for DEX protocols
        let finalParams = { ...parsedIntent.params };
        if ((parsedIntent.action === 'buy' || parsedIntent.action === 'sell') && 
            ['jupiter', 'raydium', 'orca', 'meteora', 'pumpfun'].includes(parsedIntent.protocol)) {
          const solMint = 'So11111111111111111111111111111111111111112';
          if (parsedIntent.action === 'buy') {
            finalParams = {
              from: solMint,
              to: finalParams.token,
              amount: finalParams.amount,
              slippage: finalParams.slippage || 1.0,
              pool: finalParams.pool,
            };
          } else {
            finalParams = {
              from: finalParams.token,
              to: solMint,
              amount: finalParams.amount,
              slippage: finalParams.slippage || 1.0,
              pool: finalParams.pool,
            };
          }
        }

        // Check if this is a swap action that should go through Jupiter
        const isSwapAction = ['swap', 'buy', 'sell'].includes(parsedIntent.action);
        
        if (isSwapAction && finalParams.from && finalParams.to) {
          jupiterSwaps.push({
            parsedIntent,
            finalParams,
            buildIntent: {
              intent: 'swap',
              params: {
                from: finalParams.from,
                to: finalParams.to,
                amount: finalParams.amount,
                slippage: finalParams.slippage || 1.0,
              },
              payer: naturalIntent.payer,
              network: naturalIntent.network,
              priorityFee: naturalIntent.priorityFee,
              computeBudget: naturalIntent.computeBudget,
              skipSimulation: (req.body as any).skipSimulation
            }
          });
        } else {
          // Non-swap intent - can be combined
          const resolvedIntent = mapToBuilderIntent(parsedIntent.protocol, parsedIntent.action);
          nonSwapIntents.push({
            parsedIntent,
            buildIntent: {
              intent: resolvedIntent,
              params: finalParams,
              payer: naturalIntent.payer,
              network: naturalIntent.network,
              priorityFee: naturalIntent.priorityFee,
              computeBudget: naturalIntent.computeBudget,
              skipSimulation: (req.body as any).skipSimulation
            }
          });
        }
      }
      
      // Build transactions
      const transactions: Array<{
        transaction: string;
        details: any;
        simulation?: any;
      }> = [];
      
      // Handle Jupiter swaps (each must be a separate transaction)
      for (const swapData of jupiterSwaps) {
        try {
          const jupiterProtocol = ProtocolRegistry.getHandler('jupiter') as any;
          const transaction = await jupiterProtocol.buildSwapTransaction(swapData.buildIntent);
          
          transactions.push({
            transaction,
            details: {
              protocol: 'jupiter',
              action: swapData.parsedIntent.action,
              resolvedDex: swapData.parsedIntent.protocol,
              parsedIntent: swapData.parsedIntent,
              confidence: swapData.parsedIntent.confidence,
              note: swapData.parsedIntent.protocol !== 'jupiter' 
                ? `Token identified on ${swapData.parsedIntent.protocol} via DexScreener. Routed through Jupiter for optimal execution.`
                : undefined
            }
          });
        } catch (error) {
          console.warn('Jupiter routing failed for swap:', error);
          // Could fall back to direct protocol handler here
        }
      }
      
      // Check for Jito tips that should be bundled INTO swap transactions
      // Jito tips only work when in the same transaction as the swap (MEV protection)
      const jitoTips = nonSwapIntents.filter(item => item.parsedIntent.protocol === 'jito');
      const otherNonSwap = nonSwapIntents.filter(item => item.parsedIntent.protocol !== 'jito');
      
      if (jitoTips.length > 0 && jupiterSwaps.length > 0) {
        // Inject Jito tip instructions into the last Jupiter swap transaction
        const lastTxIdx = transactions.length - 1;
        if (lastTxIdx >= 0 && transactions[lastTxIdx]) {
          try {
            const txBase64 = transactions[lastTxIdx].transaction;
            const txBuffer = Buffer.from(txBase64, 'base64');
            const versionedTx = VersionedTransaction.deserialize(txBuffer);
            
            // Build Jito tip instructions
            const tipInstructions: TransactionInstruction[] = [];
            for (const tipData of jitoTips) {
              const tipAmount = Math.floor((tipData.parsedIntent.params.amount || 0.001) * 1e9);
              // Jito tip accounts - pick one randomly
              const jitoTipAccounts = [
                '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
                'HFqU5x63VTqvQss8hp11i4bPo7SWXkQPSYrJKw7Krcab',
                'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
                'ADaUMid9yfUC5Drf6YoR1zczB7CpMYzoSwqbiMDbfEra',
                'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
                'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
                'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
                '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
              ];
              const tipAccount = jitoTipAccounts[Math.floor(Math.random() * jitoTipAccounts.length)];
              
              tipInstructions.push(
                SystemProgram.transfer({
                  fromPubkey: new PublicKey(naturalIntent.payer),
                  toPubkey: new PublicKey(tipAccount),
                  lamports: tipAmount,
                })
              );
            }
            
            // Resolve address lookup tables for decompilation
            const network = (naturalIntent.network === 'mainnet' || !naturalIntent.network) ? 'mainnet' : 'devnet';
            const connection = RPCConnection.getConnection(network as any);
            const lookupTableAccounts: AddressLookupTableAccount[] = [];
            
            if (versionedTx.message.addressTableLookups.length > 0) {
              const lookupTableAddresses = versionedTx.message.addressTableLookups.map(l => l.accountKey);
              const lookupResults = await connection.getMultipleAccountsInfo(lookupTableAddresses);
              for (let i = 0; i < lookupTableAddresses.length; i++) {
                const accountInfo = lookupResults[i];
                if (accountInfo) {
                  const lookupTable = new AddressLookupTableAccount({
                    key: lookupTableAddresses[i],
                    state: AddressLookupTableAccount.deserialize(accountInfo.data),
                  });
                  lookupTableAccounts.push(lookupTable);
                }
              }
            }
            
            // Decompile, add tip instructions, recompile
            const message = TransactionMessage.decompile(versionedTx.message, { addressLookupTableAccounts: lookupTableAccounts });
            message.instructions.push(...tipInstructions);
            versionedTx.message = message.compileToV0Message(lookupTableAccounts);
            
            // Re-serialize
            transactions[lastTxIdx].transaction = Buffer.from(versionedTx.serialize()).toString('base64');
            transactions[lastTxIdx].details.jitoTip = jitoTips.map(t => t.parsedIntent.params.amount).reduce((a: number, b: number) => a + b, 0);
            transactions[lastTxIdx].details.note = (transactions[lastTxIdx].details.note || '') + 
              ` Jito tip of ${transactions[lastTxIdx].details.jitoTip} SOL bundled into swap transaction.`;
          } catch (jitoError) {
            console.warn('Failed to inject Jito tip into swap transaction, building separately:', jitoError);
            // Fall back to separate transaction
            otherNonSwap.push(...jitoTips);
          }
        }
      } else if (jitoTips.length > 0) {
        // No swaps to bundle with — build Jito tips as regular transactions
        otherNonSwap.push(...jitoTips);
      }

      // Handle remaining non-swap intents (try to combine into one transaction if possible)
      if (otherNonSwap.length > 0) {
        if (otherNonSwap.length === 1) {
          // Single non-swap intent
          const result = await TransactionBuilder.buildTransaction(otherNonSwap[0].buildIntent);
          if (result.success && result.transaction) {
            transactions.push({
              transaction: result.transaction,
              details: {
                ...result.details,
                parsedIntent: otherNonSwap[0].parsedIntent,
                confidence: otherNonSwap[0].parsedIntent.confidence
              },
              simulation: result.simulation
            });
          }
        } else {
          // Multiple non-swap intents - combine into one transaction
          const multiIntent = {
            intents: otherNonSwap.map(item => item.buildIntent),
            payer: naturalIntent.payer,
            network: naturalIntent.network,
            priorityFee: naturalIntent.priorityFee,
            computeBudget: naturalIntent.computeBudget
          };
          
          const result = await TransactionBuilder.buildMultiTransaction(multiIntent);
          if (result.success && result.transaction) {
            transactions.push({
              transaction: result.transaction,
              details: {
                ...result.details,
                parsedIntents: otherNonSwap.map(item => item.parsedIntent)
              },
              simulation: result.simulation
            });
          }
        }
      }
      
      // Generate summary
      const operationCounts: Record<string, number> = {};
      parsedIntents.forEach(intent => {
        operationCounts[intent.action] = (operationCounts[intent.action] || 0) + 1;
      });
      
      const summaryParts = Object.entries(operationCounts).map(([action, count]) => 
        count > 1 ? `${count} ${action}s` : `${action}`
      );
      const summary = `${parsedIntents.length} operations: ${summaryParts.join(', ')}`;
      
      res.json({
        success: true,
        multi: true,
        transactions,
        summary
      });
      return;
    }
    
    // Single intent flow (existing logic)
    parsedIntent = await IntentParser.parseNaturalLanguageAsync(naturalIntent);
    
    // Map resolved protocol + action to the correct intent name for the builder
    const resolvedIntent = mapToBuilderIntent(parsedIntent.protocol, parsedIntent.action);

    // Transform buy/sell params to swap params for DEX protocols
    let finalParams = { ...parsedIntent.params };
    if ((parsedIntent.action === 'buy' || parsedIntent.action === 'sell') && 
        ['jupiter', 'raydium', 'orca', 'meteora', 'pumpfun'].includes(parsedIntent.protocol)) {
      const solMint = 'So11111111111111111111111111111111111111112';
      if (parsedIntent.action === 'buy') {
        finalParams = {
          from: solMint,
          to: finalParams.token,
          amount: finalParams.amount,
          slippage: finalParams.slippage || 1.0,
          pool: finalParams.pool,
        };
      } else {
        finalParams = {
          from: finalParams.token,
          to: solMint,
          amount: finalParams.amount,
          slippage: finalParams.slippage || 1.0,
          pool: finalParams.pool,
        };
      }
    }

    // Convert to BuildIntent
    const buildIntent: BuildIntent = {
      intent: resolvedIntent,
      params: finalParams,
      payer: naturalIntent.payer,
      network: naturalIntent.network,
      priorityFee: naturalIntent.priorityFee,
      computeBudget: naturalIntent.computeBudget,
      skipSimulation: (req.body as any).skipSimulation
    };

    // Route all swap/buy/sell operations through Jupiter API for real executable transactions.
    // Individual DEX handlers (Raydium, Orca, Meteora, etc.) build instruction-level transactions
    // but lack real on-chain account resolution. Jupiter aggregates all DEXes and returns
    // fully constructed, simulation-ready transactions.
    const isSwapAction = ['swap', 'buy', 'sell'].includes(parsedIntent.action) ||
      resolvedIntent.includes('swap');
    
    if (isSwapAction && finalParams.from && finalParams.to) {
      try {
        const jupiterProtocol = ProtocolRegistry.getHandler('jupiter') as any;
        const jupiterIntent = {
          ...buildIntent,
          params: {
            from: finalParams.from,
            to: finalParams.to,
            amount: finalParams.amount,
            slippage: finalParams.slippage || 1.0,
          }
        };
        const transaction = await jupiterProtocol.buildSwapTransaction(jupiterIntent);
        
        res.json({
          success: true,
          transaction,
          details: {
            protocol: 'jupiter',
            resolvedDex: parsedIntent.protocol,
            parsedIntent: parsedIntent,
            confidence: parsedIntent.confidence,
            note: parsedIntent.protocol !== 'jupiter' 
              ? `Token identified on ${parsedIntent.protocol} via DexScreener. Routed through Jupiter for optimal execution.`
              : undefined
          }
        });
        return;
      } catch (jupiterError) {
        // Fall back to regular transaction building if Jupiter fails
        console.warn('Jupiter routing failed, falling back to direct protocol handler:', jupiterError);
        
        // If Jupiter fails, return error with suggestions
        const errorMessage = jupiterError instanceof Error ? jupiterError.message : 'Jupiter swap failed';
        res.status(400).json({
          success: false,
          error: errorMessage,
          suggestions: generateErrorSuggestions(errorMessage, parsedIntent)
        });
        return;
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
    const errorMessage = error instanceof Error ? error.message : 'Failed to parse intent';
    res.status(400).json({
      success: false,
      error: errorMessage,
      suggestions: generateErrorSuggestions(errorMessage, parsedIntent)
    });
  }
});

// Execute transaction with agent wallet (server-side signing)
router.post('/api/execute/natural', async (req: Request, res: Response) => {
  try {
    // Validate request
    const { prompt } = req.body;
    
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required and must be a non-empty string'
      });
    }

    if (prompt.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Prompt too long. Maximum 500 characters allowed.'
      });
    }

    // Check if agent wallet is enabled
    if (!isAgentWalletEnabled()) {
      return res.status(503).json({
        success: false,
        error: 'Agent wallet not configured. Please set AGENT_WALLET_SECRET_KEY environment variable.'
      });
    }

    const agentWallet = getAgentWallet()!;
    const naturalIntent: NaturalLanguageIntent = req.body;

    // Override payer with agent wallet address
    const executionIntent = {
      ...naturalIntent,
      payer: agentWallet.publicKey.toBase58()
    };

    // Parse the intent using existing logic
    const parsedIntent = await IntentParser.parseNaturalLanguageAsync(executionIntent);

    // Map resolved protocol + action to the correct intent name for the builder
    const resolvedIntent = mapToBuilderIntent(parsedIntent.protocol, parsedIntent.action);

    // Transform buy/sell params to swap params for DEX protocols
    let finalParams = { ...parsedIntent.params };
    if ((parsedIntent.action === 'buy' || parsedIntent.action === 'sell') && 
        ['jupiter', 'raydium', 'orca', 'meteora', 'pumpfun'].includes(parsedIntent.protocol)) {
      const solMint = 'So11111111111111111111111111111111111111112';
      if (parsedIntent.action === 'buy') {
        finalParams = {
          from: solMint,
          to: finalParams.token,
          amount: finalParams.amount,
          slippage: finalParams.slippage || 1.0,
          pool: finalParams.pool,
        };
      } else {
        finalParams = {
          from: finalParams.token,
          to: solMint,
          amount: finalParams.amount,
          slippage: finalParams.slippage || 1.0,
          pool: finalParams.pool,
        };
      }
    }

    // Convert to BuildIntent
    const buildIntent: BuildIntent = {
      intent: resolvedIntent,
      params: finalParams,
      payer: agentWallet.publicKey.toBase58(),
      network: naturalIntent.network,
      priorityFee: naturalIntent.priorityFee,
      computeBudget: naturalIntent.computeBudget,
      skipSimulation: (req.body as any).skipSimulation || false
    };

    // Build the transaction
    let transactionBase64: string;

    // Route swaps through Jupiter
    const isSwapAction = ['swap', 'buy', 'sell'].includes(parsedIntent.action) ||
      resolvedIntent.includes('swap');
    
    if (isSwapAction && finalParams.from && finalParams.to) {
      const jupiterProtocol = ProtocolRegistry.getHandler('jupiter') as any;
      const jupiterIntent = {
        ...buildIntent,
        params: {
          from: finalParams.from,
          to: finalParams.to,
          amount: finalParams.amount,
          slippage: finalParams.slippage || 1.0,
        }
      };
      transactionBase64 = await jupiterProtocol.buildSwapTransaction(jupiterIntent);
    } else {
      const result = await TransactionBuilder.buildTransaction(buildIntent);
      if (!result.success || !result.transaction) {
        throw new Error(result.error || 'Failed to build transaction');
      }
      transactionBase64 = result.transaction;
    }

    // Get connection for signing and sending
    const network = (naturalIntent.network === 'mainnet' || !naturalIntent.network) ? 'mainnet' : 'devnet';
    const connection = RPCConnection.getConnection(network as any);

    // Deserialize, sign, and send transaction
    let signature: string;
    try {
      const txBuffer = Buffer.from(transactionBase64, 'base64');
      const transaction = VersionedTransaction.deserialize(txBuffer);

      // Sign with agent wallet
      transaction.sign([agentWallet]);

      // Send transaction
      const rawTransaction = transaction.serialize();
      signature = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: (req.body as any).skipSimulation || false
      });

    } catch (signingError) {
      return res.status(400).json({
        success: false,
        error: 'Failed to sign or send transaction: ' + (signingError instanceof Error ? signingError.message : 'Unknown error'),
        details: {
          agentWallet: agentWallet.publicKey.toBase58(),
          parsedIntent: parsedIntent
        }
      });
    }

    // Return success response
    const explorerUrl = network === 'mainnet' 
      ? `https://solscan.io/tx/${signature}`
      : `https://solscan.io/tx/${signature}?cluster=devnet`;

    res.json({
      success: true,
      signature,
      explorer: explorerUrl,
      details: {
        protocol: parsedIntent.protocol,
        action: parsedIntent.action,
        parsedIntent: parsedIntent,
        confidence: parsedIntent.confidence,
        agentWallet: agentWallet.publicKey.toBase58()
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to execute transaction';
    res.status(400).json({
      success: false,
      error: errorMessage,
      suggestions: generateErrorSuggestions(errorMessage)
    });
  }
});

// Get agent wallet information
router.get('/api/agent-wallet', (req: Request, res: Response) => {
  try {
    if (isAgentWalletEnabled()) {
      const publicKey = getAgentPublicKey();
      res.json({
        enabled: true,
        publicKey,
        note: "Fund this wallet to enable agent execution"
      });
    } else {
      res.json({
        enabled: false,
        note: "Set AGENT_WALLET_SECRET_KEY environment variable to enable agent execution"
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get agent wallet information'
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

// Resolve endpoint for token/pair resolution without building transaction
// GET version of resolve for easy browser/agent access
router.get('/api/resolve', async (req: Request, res: Response) => {
  try {
    const query = req.query.query as string;
    if (!query) {
      return res.status(400).json({ success: false, error: 'query parameter is required. Usage: /api/resolve?query=BONK' });
    }
    
    // Try token resolution
    const tokenResult = await TokenResolver.resolve(query);
    if (tokenResult) {
      return res.json({ success: true, token: tokenResult });
    }
    
    // Try pair resolution
    const pairResult = await TokenResolver.resolveByPair(query);
    if (pairResult) {
      return res.json({ success: true, pair: pairResult });
    }
    
    return res.status(404).json({ success: false, error: `Could not resolve "${query}". Try a full mint address or pair address.` });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Resolution failed' });
  }
});

router.post('/api/resolve', async (req: Request, res: Response) => {
  try {
    const { address, type } = req.body;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'address is required'
      });
    }

    let result;
    
    if (type === 'pair' || (!type && address.length > 10)) {
      // Try pair resolution first for longer addresses or explicit pair type
      result = await TokenResolver.resolveByPair(address);
      
      if (result) {
        return res.json({
          success: true,
          type: 'pair',
          address,
          result: {
            protocol: result.protocol,
            baseToken: result.baseToken,
            quoteToken: result.quoteToken,
            pool: result.pool,
            tokenInfo: result.tokenInfo
          }
        });
      }
      
      // If pair resolution failed, try token resolution
      if (!type) {
        const tokenResult = await TokenResolver.resolve(address);
        if (tokenResult) {
          return res.json({
            success: true,
            type: 'token',
            address,
            result: tokenResult
          });
        }
      }
    } else {
      // Try token resolution
      result = await TokenResolver.resolve(address);
      
      if (result) {
        return res.json({
          success: true,
          type: 'token',
          address,
          result
        });
      }
    }

    // Neither resolution worked
    return res.status(404).json({
      success: false,
      error: `Could not resolve ${type || 'token/pair'}: ${address}`,
      address,
      type: type || 'unknown'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Resolution failed',
      address: req.body.address
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

/**
 * Maps a resolved protocol + action to the correct intent name used by the protocol handler.
 * E.g. protocol='meteora' + action='buy' → 'meteora-swap'
 *      protocol='raydium' + action='buy' → 'raydium-swap'
 *      protocol='pumpfun' + action='buy' → 'pumpfun-buy' (pump.fun has distinct buy/sell)
 */
function mapToBuilderIntent(protocol: string, action: string): string {
  const mapping: Record<string, Record<string, string>> = {
    'jupiter': { buy: 'swap', sell: 'swap', swap: 'swap' },
    'raydium': { buy: 'raydium-swap', sell: 'raydium-swap', swap: 'raydium-swap' },
    'orca': { buy: 'orca-swap', sell: 'orca-swap', swap: 'orca-swap' },
    'meteora': { buy: 'meteora-swap', sell: 'meteora-swap', swap: 'meteora-swap' },
    'pumpfun': { buy: 'pumpfun-buy', sell: 'pumpfun-sell', create: 'pumpfun-create' },
    'marinade': { stake: 'marinade-stake', unstake: 'marinade-unstake' },
    'system': { transfer: 'transfer' },
    'spl-token': { transfer: 'token-transfer' },
    'memo': { memo: 'memo' },
    'jito': { tip: 'tip' },
    'stake': { stake: 'stake', delegate: 'delegate', deactivate: 'deactivate', withdraw: 'withdraw' },
    'token2022': { transfer: 'token2022-transfer' },
  };

  const protocolMap = mapping[protocol];
  if (protocolMap && protocolMap[action]) {
    return protocolMap[action];
  }

  // Fallback: try protocol-action, then just action
  return `${protocol}-${action}`;
}


export default router;
