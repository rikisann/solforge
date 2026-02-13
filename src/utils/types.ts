import { Transaction, TransactionInstruction, PublicKey } from '@solana/web3.js';

export interface BuildIntent {
  intent: string;
  params: Record<string, any>;
  payer: string;
  network?: 'mainnet' | 'devnet';
  priorityFee?: number;
  computeBudget?: number;
  skipSimulation?: boolean;
}

export interface NaturalLanguageIntent {
  prompt: string;
  payer: string;
  network?: 'mainnet' | 'devnet';
  skipSimulation?: boolean;
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

// Multi-build types
export interface MultiBuildIntent {
  intents: BuildIntent[];
  payer: string;
  network?: 'mainnet' | 'devnet';
  priorityFee?: number;
  computeBudget?: number;
}

export interface MultiBuildResponse {
  success: boolean;
  transaction?: string; // base64 serialized transaction
  simulation?: SimulationResult;
  details?: MultiTransactionDetails;
  error?: string;
}

export interface MultiTransactionDetails {
  protocols: string[];
  totalInstructions: number;
  accounts: string[];
  estimatedFee?: string;
  intentsProcessed: number;
  breakdown: Array<{
    intent: string;
    protocol: string;
    instructions: number;
  }>;
}

// Decode types
export interface DecodeRequest {
  transaction: string; // base64 encoded transaction
}

export interface DecodeResponse {
  success: boolean;
  decoded?: DecodedTransaction;
  error?: string;
}

export interface DecodedTransaction {
  instructions: DecodedInstruction[];
  accounts: string[];
  recentBlockhash?: string;
  feePayer?: string;
}

export interface DecodedInstruction {
  programId: string;
  protocol?: string;
  protocolName?: string;
  description?: string;
  accounts: Array<{
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }>;
  data: string; // hex encoded instruction data
}

// Estimate types
export interface EstimateRequest {
  intent?: string;
  intents?: BuildIntent[];
  params?: Record<string, any>;
  payer: string;
  network?: 'mainnet' | 'devnet';
  priorityFee?: number;
  computeBudget?: number;
}

export interface EstimateResponse {
  success: boolean;
  estimate?: TransactionEstimate;
  error?: string;
}

export interface TransactionEstimate {
  baseFee: string; // in SOL
  priorityFee: string; // in SOL
  totalFee: string; // in SOL
  computeUnits: number;
  rentCost?: string; // in SOL (for account creation)
}