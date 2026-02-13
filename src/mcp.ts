import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import dotenv from 'dotenv';

// Import SolForge engine classes and protocols
import { TransactionBuilder } from './engine/builder';
import { IntentParser } from './engine/intent-parser';
import { TransactionDecoder } from './engine/decoder';
import { TransactionEstimator } from './engine/estimator';
import { TokenResolver } from './engine/token-resolver';
import { ProtocolRegistry } from './protocols';
import { BuildIntent, NaturalLanguageIntent, EstimateRequest } from './utils/types';

// Load environment variables
dotenv.config();

const server = new McpServer({
  name: "solforge",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {}
  }
});

/**
 * Maps a resolved protocol + action to the correct intent name used by the protocol handler.
 * Same logic as in routes.ts
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

// Tool 1: build_transaction_natural - Natural language → transaction (the star tool)
server.registerTool(
  "build_transaction_natural",
  {
    description: "Build a Solana transaction from natural language description",
    inputSchema: z.object({
      prompt: z.string().describe("Natural language description of the transaction to build"),
      payer: z.string().describe("Payer wallet address (base58 public key)"),
      skipSimulation: z.boolean().optional().describe("Skip transaction simulation (default: false)"),
      network: z.enum(["mainnet", "devnet"]).optional().describe("Network to use (default: mainnet)")
    })
  },
  async (params) => {
    try {
      const naturalIntent: NaturalLanguageIntent = {
        prompt: params.prompt,
        payer: params.payer,
        network: params.network || 'mainnet',
        skipSimulation: params.skipSimulation || false
      };
      
      // Parse natural language to structured intent (async to resolve token addresses via DexScreener)
      const parsedIntent = await IntentParser.parseNaturalLanguageAsync(naturalIntent);
      
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
        skipSimulation: naturalIntent.skipSimulation
      };

      // Route swap operations through Jupiter API for real executable transactions
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
          
          const result = {
            success: true,
            transaction,
            protocol: 'jupiter',
            resolvedDex: parsedIntent.protocol,
            parsedIntent: parsedIntent,
            confidence: parsedIntent.confidence,
            note: parsedIntent.protocol !== 'jupiter' 
              ? `Token identified on ${parsedIntent.protocol} via DexScreener. Routed through Jupiter for optimal execution.`
              : undefined
          };

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (jupiterError) {
          // Fall back to regular transaction building if Jupiter fails
          console.error('Jupiter routing failed, falling back to direct protocol handler:', jupiterError);
        }
      }

      // Build transaction normally
      const result = await TransactionBuilder.buildTransaction(buildIntent);
      
      // Add parsing details to response
      const response = {
        success: result.success,
        transaction: result.transaction,
        protocol: parsedIntent.protocol,
        parsedIntent: parsedIntent,
        confidence: parsedIntent.confidence,
        details: result.details,
        simulation: result.simulation,
        error: result.error
      };

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(response, null, 2)
        }]
      };
      
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to parse natural language intent'
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

// Tool 2: build_transaction - Structured intent → transaction
server.registerTool(
  "build_transaction",
  {
    description: "Build a Solana transaction from structured intent parameters",
    inputSchema: z.object({
      intent: z.string().describe("Structured intent name (e.g., 'swap', 'transfer', 'stake')"),
      params: z.record(z.string(), z.any()).describe("Intent-specific parameters object"),
      payer: z.string().describe("Payer wallet address (base58 public key)"),
      skipSimulation: z.boolean().optional().describe("Skip transaction simulation (default: false)"),
      network: z.enum(["mainnet", "devnet"]).optional().describe("Network to use (default: mainnet)")
    })
  },
  async (params) => {
    try {
      const buildIntent: BuildIntent = {
        intent: params.intent,
        params: params.params,
        payer: params.payer,
        network: params.network || 'mainnet',
        skipSimulation: params.skipSimulation || false
      };

      const result = await TransactionBuilder.buildTransaction(buildIntent);
      
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: result.success,
            transaction: result.transaction,
            details: result.details,
            simulation: result.simulation,
            error: result.error
          }, null, 2)
        }]
      };
      
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to build transaction'
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

// Tool 3: resolve_token - Look up token/pair info
server.registerTool(
  "resolve_token",
  {
    description: "Look up token or trading pair information",
    inputSchema: z.object({
      query: z.string().describe("Token address, pair address, or symbol to resolve")
    })
  },
  async (params) => {
    try {
      // Try pair resolution first for longer addresses
      if (params.query.length > 10) {
        const pairResult = await TokenResolver.resolveByPair(params.query);
        
        if (pairResult) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                type: 'pair',
                address: params.query,
                result: {
                  protocol: pairResult.protocol,
                  baseToken: pairResult.baseToken,
                  quoteToken: pairResult.quoteToken,
                  pool: pairResult.pool,
                  tokenInfo: pairResult.tokenInfo
                }
              }, null, 2)
            }]
          };
        }
      }
      
      // Try token resolution
      const tokenResult = await TokenResolver.resolve(params.query);
      
      if (tokenResult) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              type: 'token',
              address: params.query,
              result: tokenResult
            }, null, 2)
          }]
        };
      }

      // Neither resolution worked
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: `Could not resolve token/pair: ${params.query}`,
            address: params.query
          }, null, 2)
        }],
        isError: true
      };
      
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Token resolution failed',
            address: params.query
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

// Tool 4: list_protocols - List all supported protocols
server.registerTool(
  "list_protocols",
  {
    description: "List all supported blockchain protocols and their capabilities",
    inputSchema: z.object({})
  },
  async () => {
    try {
      const protocols = ProtocolRegistry.getProtocolInfo();
      
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            protocols,
            count: protocols.length
          }, null, 2)
        }]
      };
      
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch protocols'
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

// Tool 5: estimate_transaction - Estimate fees for an operation
server.registerTool(
  "estimate_transaction",
  {
    description: "Estimate transaction fees and compute costs",
    inputSchema: z.object({
      intent: z.string().describe("Intent name to estimate"),
      params: z.record(z.string(), z.any()).describe("Intent-specific parameters"),
      payer: z.string().describe("Payer wallet address (base58 public key)"),
      network: z.enum(["mainnet", "devnet"]).optional().describe("Network to use (default: mainnet)")
    })
  },
  async (params) => {
    try {
      const estimateRequest: EstimateRequest = {
        intent: params.intent,
        params: params.params,
        payer: params.payer,
        network: params.network || 'mainnet'
      };

      const result = await TransactionEstimator.estimateTransaction(estimateRequest);
      
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: result.success,
            estimate: result.estimate,
            error: result.error
          }, null, 2)
        }]
      };
      
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to estimate transaction'
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

// Tool 6: decode_transaction - Decode a base64 transaction
server.registerTool(
  "decode_transaction",
  {
    description: "Decode a base64-encoded Solana transaction into human-readable format",
    inputSchema: z.object({
      transaction: z.string().describe("Base64 encoded transaction to decode")
    })
  },
  async (params) => {
    try {
      const result = await TransactionDecoder.decodeTransaction(params.transaction);
      
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: result.success,
            decoded: result.decoded,
            error: result.error
          }, null, 2)
        }]
      };
      
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to decode transaction'
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

// Start the MCP server
async function main() {
  const transport = new StdioServerTransport();
  
  try {
    console.error('🚀 Starting SolForge MCP Server...');
    
    // Test connections like in index.ts
    console.error(`📡 Environment check: SOLANA_MAINNET_RPC=${!!process.env.SOLANA_MAINNET_RPC}, JUPITER_API_URL=${!!process.env.JUPITER_API_URL}`);
    
    await server.connect(transport);
    console.error('✅ SolForge MCP Server ready for tools!');
    
  } catch (error) {
    console.error('❌ Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.error('🛑 Shutting down MCP server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('🛑 Shutting down MCP server...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});