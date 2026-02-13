import { 
  TransactionInstruction, 
  PublicKey, 
  Keypair
} from '@solana/web3.js';
import { BuildIntent, ProtocolHandler } from '../utils/types';
import { resolveMint, RPCConnection } from '../utils/connection';

export class MarginfiProtocol implements ProtocolHandler {
  name = 'marginfi';
  description = 'Marginfi lending protocol for supply, borrow, repay, and withdraw operations';
  supportedIntents = [
    'supply', 'deposit', 'lend', 'borrow', 'repay', 'withdraw',
    'marginfi-supply', 'marginfi-deposit', 'marginfi-borrow', 'marginfi-repay', 'marginfi-withdraw'
  ];

  private static clientCache: any = null;
  private static clientCacheTime = 0;
  private static readonly CACHE_TTL = 60000; // 1 min

  async build(intent: BuildIntent): Promise<TransactionInstruction[]> {
    const action = intent.intent;
    switch (action) {
      case 'supply': case 'deposit': case 'lend': case 'marginfi-supply': case 'marginfi-deposit':
        return this.buildWithSDK(intent, 'deposit');
      case 'borrow': case 'marginfi-borrow':
        return this.buildWithSDK(intent, 'borrow');
      case 'repay': case 'marginfi-repay':
        return this.buildWithSDK(intent, 'repay');
      case 'withdraw': case 'marginfi-withdraw':
        return this.buildWithSDK(intent, 'withdraw');
      default:
        throw new Error(`Unsupported Marginfi action: ${action}`);
    }
  }

  validateParams(params: Record<string, any>): boolean {
    if (typeof params.amount !== 'number' || params.amount <= 0) return false;
    if (!params.token || typeof params.token !== 'string') return false;
    return true;
  }

  private async getClient() {
    const now = Date.now();
    if (MarginfiProtocol.clientCache && (now - MarginfiProtocol.clientCacheTime) < MarginfiProtocol.CACHE_TTL) {
      return MarginfiProtocol.clientCache;
    }
    
    const { MarginfiClient, getConfig } = require('@mrgnlabs/marginfi-client-v2');
    const { Connection } = require('@solana/web3.js');
    
    const rpcUrl = process.env.SOLANA_MAINNET_RPC || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    
    // Use the mainnet production configuration
    const config = getConfig('production');
    
    // Create a minimal wallet for the client (it just needs the interface)
    const dummyWallet = {
      publicKey: new PublicKey('11111111111111111111111111111111'),
      signTransaction: async () => { throw new Error('Dummy wallet cannot sign'); },
      signAllTransactions: async () => { throw new Error('Dummy wallet cannot sign'); },
    };
    
    const client = await MarginfiClient.fetch(config, dummyWallet, connection);
    
    MarginfiProtocol.clientCache = { client, connection, config };
    MarginfiProtocol.clientCacheTime = now;
    return { client, connection, config };
  }

  private async buildWithSDK(intent: BuildIntent, action: 'deposit' | 'borrow' | 'repay' | 'withdraw'): Promise<TransactionInstruction[]> {
    const BN = require('bn.js');
    const { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
    const { instructions } = require('@mrgnlabs/marginfi-client-v2');

    const { client, connection } = await this.getClient();
    
    const tokenMint = new PublicKey(resolveMint(intent.params.token));
    const payerPk = new PublicKey(intent.payer);

    // Find the bank for this token
    const bank = client.getBankByMint(tokenMint);
    
    if (!bank) {
      throw new Error(`No Marginfi bank found for token ${intent.params.token}. Available tokens: ${Array.from(client.banks.values()).map((b: any) => b.mint?.toString()).filter(Boolean).join(', ')}`);
    }

    // Get token decimals
    const mintInfo = await connection.getParsedAccountInfo(tokenMint);
    let decimals = 6;
    if (mintInfo.value?.data && 'parsed' in mintInfo.value.data) {
      decimals = mintInfo.value.data.parsed.info.decimals;
    }

    // Handle amount calculation
    let amount = intent.params.amount;
    if (!amount || amount <= 0) {
      try {
        const ata = await getAssociatedTokenAddress(tokenMint, payerPk);
        const balance = await connection.getTokenAccountBalance(ata);
        amount = parseFloat(balance.value.uiAmountString || '0');
        if (amount <= 0) throw new Error('No token balance found');
      } catch (e: any) {
        throw new Error(`Cannot determine amount. Specify an amount or ensure wallet has ${intent.params.token} balance.`);
      }
    }
    
    const amountBN = new BN(Math.floor(amount * Math.pow(10, decimals)));

    // Check if user has existing marginfi accounts
    let marginfiAccounts = [];
    try {
      marginfiAccounts = await client.getMarginfiAccountsForAuthority(payerPk);
    } catch (error) {
      console.warn('Failed to fetch marginfi accounts:', error);
    }

    const allInstructions: TransactionInstruction[] = [];

    // If no marginfi account exists, create one
    let marginfiAccountPk: PublicKey;
    if (marginfiAccounts.length === 0) {
      console.log('No existing Marginfi account found. Creating new account...');
      
      // Generate a new keypair for the marginfi account
      const marginfiAccountKeypair = Keypair.generate();
      marginfiAccountPk = marginfiAccountKeypair.publicKey;
      
      // Create account initialization instruction
      const initAccountIx = await instructions.makeInitMarginfiAccountIx(
        client.program,
        {
          marginfiGroup: client.groupAddress,
          marginfiAccount: marginfiAccountPk,
          authority: payerPk,
          feePayer: payerPk,
        }
      );
      
      allInstructions.push(initAccountIx);
    } else {
      // Use existing account
      marginfiAccountPk = marginfiAccounts[0].address;
    }

    // Get token account address
    const tokenAccountPk = await getAssociatedTokenAddress(tokenMint, payerPk);

    // Build the specific operation instruction
    let operationIx: TransactionInstruction;

    switch (action) {
      case 'deposit':
        operationIx = await instructions.makeDepositIx(
          client.program,
          {
            marginfiAccount: marginfiAccountPk,
            signerTokenAccount: tokenAccountPk,
            bank: bank.address,
            tokenProgram: TOKEN_PROGRAM_ID,
            group: client.groupAddress,
            authority: payerPk,
          },
          { amount: amountBN }
        );
        break;
      case 'borrow':
        operationIx = await instructions.makeBorrowIx(
          client.program,
          {
            marginfiAccount: marginfiAccountPk,
            bank: bank.address,
            destinationTokenAccount: tokenAccountPk,
            tokenProgram: TOKEN_PROGRAM_ID,
            group: client.groupAddress,
            authority: payerPk,
          },
          { amount: amountBN }
        );
        break;
      case 'repay':
        operationIx = await instructions.makeRepayIx(
          client.program,
          {
            marginfiAccount: marginfiAccountPk,
            signerTokenAccount: tokenAccountPk,
            bank: bank.address,
            tokenProgram: TOKEN_PROGRAM_ID,
            group: client.groupAddress,
            authority: payerPk,
          },
          { amount: amountBN, repayAll: false }
        );
        break;
      case 'withdraw':
        operationIx = await instructions.makeWithdrawIx(
          client.program,
          {
            marginfiAccount: marginfiAccountPk,
            bank: bank.address,
            destinationTokenAccount: tokenAccountPk,
            tokenProgram: TOKEN_PROGRAM_ID,
            group: client.groupAddress,
            authority: payerPk,
          },
          { amount: amountBN, withdrawAll: false }
        );
        break;
      default:
        throw new Error(`Unsupported action: ${action}`);
    }

    allInstructions.push(operationIx);

    if (allInstructions.length === 0) {
      throw new Error('No instructions generated for Marginfi operation');
    }

    return allInstructions;
  }

  getRequiredAccounts(params: Record<string, any>): PublicKey[] {
    return [];
  }
}