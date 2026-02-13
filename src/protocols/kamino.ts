import { 
  TransactionInstruction, 
  PublicKey, 
} from '@solana/web3.js';
import { BuildIntent, ProtocolHandler } from '../utils/types';
import { resolveMint, RPCConnection } from '../utils/connection';

export class KaminoProtocol implements ProtocolHandler {
  name = 'kamino';
  description = 'Kamino lending protocol for supply, borrow, repay, and withdraw operations';
  supportedIntents = [
    'supply', 'deposit', 'lend', 'borrow', 'repay', 'withdraw',
    'kamino-supply', 'kamino-deposit', 'kamino-borrow', 'kamino-repay', 'kamino-withdraw'
  ];

  private static marketCache: any = null;
  private static marketCacheTime = 0;
  private static readonly CACHE_TTL = 60000; // 1 min

  async build(intent: BuildIntent): Promise<TransactionInstruction[]> {
    const action = intent.intent;
    switch (action) {
      case 'supply': case 'deposit': case 'lend': case 'kamino-supply': case 'kamino-deposit':
        return this.buildWithSDK(intent, 'deposit');
      case 'borrow': case 'kamino-borrow':
        return this.buildWithSDK(intent, 'borrow');
      case 'repay': case 'kamino-repay':
        return this.buildWithSDK(intent, 'repay');
      case 'withdraw': case 'kamino-withdraw':
        return this.buildWithSDK(intent, 'withdraw');
      default:
        throw new Error(`Unsupported Kamino action: ${action}`);
    }
  }

  validateParams(params: Record<string, any>): boolean {
    if (typeof params.amount !== 'number' || params.amount <= 0) return false;
    if (!params.token || typeof params.token !== 'string') return false;
    return true;
  }

  private async getMarket() {
    const now = Date.now();
    if (KaminoProtocol.marketCache && (now - KaminoProtocol.marketCacheTime) < KaminoProtocol.CACHE_TTL) {
      return KaminoProtocol.marketCache;
    }
    
    const { createSolanaRpc } = require('@solana/kit');
    const { KaminoMarket } = require('@kamino-finance/klend-sdk');
    
    const rpcUrl = process.env.SOLANA_MAINNET_RPC || 'https://api.mainnet-beta.solana.com';
    const rpc = createSolanaRpc(rpcUrl);
    
    const market = await KaminoMarket.load(rpc, '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF', 400);
    KaminoProtocol.marketCache = { market, rpc };
    KaminoProtocol.marketCacheTime = now;
    return { market, rpc };
  }

  private async buildWithSDK(intent: BuildIntent, action: 'deposit' | 'borrow' | 'repay' | 'withdraw'): Promise<TransactionInstruction[]> {
    const { address, createNoopSigner } = require('@solana/kit');
    const { KaminoAction, VanillaObligation, PROGRAM_ID } = require('@kamino-finance/klend-sdk');
    const BN = require('bn.js');

    const { market, rpc } = await this.getMarket();
    
    const tokenMint = address(resolveMint(intent.params.token));
    const payerAddr = address(intent.payer);
    const owner = createNoopSigner(payerAddr);
    const obligation = new VanillaObligation(PROGRAM_ID);
    const slot = await rpc.getSlot().send();

    // Get token decimals
    const connection = RPCConnection.getConnection('mainnet');
    const mintPk = new PublicKey(resolveMint(intent.params.token));
    const mintInfo = await connection.getParsedAccountInfo(mintPk);
    let decimals = 6;
    if (mintInfo.value?.data && 'parsed' in mintInfo.value.data) {
      decimals = mintInfo.value.data.parsed.info.decimals;
    }
    // If amount is 0, look up wallet's full token balance
    let amount = intent.params.amount;
    if (!amount || amount <= 0) {
      try {
        const { getAssociatedTokenAddress } = require('@solana/spl-token');
        const ata = await getAssociatedTokenAddress(mintPk, new PublicKey(intent.payer));
        const balance = await connection.getTokenAccountBalance(ata);
        amount = parseFloat(balance.value.uiAmountString || '0');
        if (amount <= 0) throw new Error('No token balance found');
      } catch (e: any) {
        throw new Error(`Cannot determine amount. Specify an amount or ensure wallet has ${intent.params.token} balance.`);
      }
    }
    const amountBN = new BN(Math.floor(amount * Math.pow(10, decimals)));

    let kaminoAction: any;
    const commonArgs = [
      market, amountBN, tokenMint, owner, obligation,
      false, // useV2Ixs
      undefined, // scopeRefreshConfig
      1_400_000, // extraComputeBudget (max)
      true, // includeAtaIxs
      false, // requestElevationGroup
      { skipInitialization: false, skipLutCreation: true },
      undefined, // referrer
      slot,
    ] as const;

    switch (action) {
      case 'deposit':
        kaminoAction = await KaminoAction.buildDepositTxns(...commonArgs);
        break;
      case 'borrow':
        kaminoAction = await KaminoAction.buildBorrowTxns(...commonArgs);
        break;
      case 'repay':
        kaminoAction = await KaminoAction.buildRepayTxns(...commonArgs);
        break;
      case 'withdraw':
        kaminoAction = await KaminoAction.buildWithdrawTxns(...commonArgs);
        break;
    }

    // Convert @solana/kit instructions to @solana/web3.js TransactionInstructions
    const convertIx = (ix: any): TransactionInstruction => {
      return new TransactionInstruction({
        programId: new PublicKey(ix.programAddress.toString()),
        keys: (ix.accounts || []).map((acc: any) => ({
          pubkey: new PublicKey(acc.address.toString()),
          isSigner: acc.role === 2 || acc.role === 3,
          isWritable: acc.role === 1 || acc.role === 3,
        })),
        data: Buffer.from(ix.data || []),
      });
    };

    const allIxs: TransactionInstruction[] = [];
    if (kaminoAction.setupIxs) allIxs.push(...kaminoAction.setupIxs.map(convertIx));
    if (kaminoAction.lendingIxs) allIxs.push(...kaminoAction.lendingIxs.map(convertIx));
    if (kaminoAction.cleanupIxs) allIxs.push(...kaminoAction.cleanupIxs.map(convertIx));

    if (allIxs.length === 0) {
      throw new Error('Kamino SDK returned no instructions');
    }

    // Store the market's lookup table for the builder
    (intent as any)._lookupTables = ['FGMSBiyVE8TvZcdQnZETAAKw28tkQJ2ccZy6pyp95URb'];

    return allIxs;
  }

  getRequiredAccounts(params: Record<string, any>): PublicKey[] {
    return [];
  }
}
