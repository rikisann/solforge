import { Transaction, TransactionInstruction, PublicKey } from '@solana/web3.js';

export interface BuildIntent {
  intent: string;
  params: Record<string, any>;
  payer: string;
  network?: 'mainnet' | 'devnet';
  priorityFee?: number;
  computeBudget?: number;
}

export interface NaturalLanguageIntent {
  prompt: string;
  payer: string;
  network?: 'mainnet' | 'devnet';
  priorityFee?: number;
  computeBudget?: number;
}

export interface BuildResponse {
  success: boolean;
  transaction?: string; // base64 serialized transaction
  simulation?: SimulationResult;
  details?: TransactionDetails;
  error?: string;
}

export interface SimulationResult {
  success: boolean;
  logs: string[];
  unitsConsumed: number;
  error?: string;
}

export interface TransactionDetails {
  protocol: string;
  instructions: number;
  accounts: string[];
  estimatedFee?: string;
  [key: string]: any; // Protocol-specific details
}

export interface ProtocolHandler {
  name: string;
  description: string;
  supportedIntents: string[];
  build(intent: BuildIntent): Promise<TransactionInstruction[]>;
  validateParams(params: Record<string, any>): boolean;
  getRequiredAccounts?(params: Record<string, any>): PublicKey[];
}

export interface ParsedIntent {
  protocol: string;
  action: string;
  params: Record<string, any>;
  confidence: number;
}

export interface ProtocolInfo {
  name: string;
  description: string;
  supportedActions: string[];
  documentation: string;
  examples: Record<string, any>;
}

// Common token interface
export interface TokenInfo {
  mint: string;
  symbol: string;
  decimals: number;
  name?: string;
}

// Swap-related types
export interface SwapParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps: number;
  payer: PublicKey;
}

export interface SwapQuote {
  inputAmount: string;
  outputAmount: string;
  priceImpactPct: string;
  route: any[];
}