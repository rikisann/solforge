import { Connection, Commitment } from '@solana/web3.js';
import dotenv from 'dotenv';

dotenv.config();

export class RPCConnection {
  private static instances: Map<string, Connection> = new Map();

  static getConnection(network: 'mainnet' | 'devnet' = 'devnet'): Connection {
    if (this.instances.has(network)) {
      return this.instances.get(network)!;
    }

    let rpcUrl: string;
    
    if (network === 'mainnet') {
      // Prefer Helius if available, otherwise use public endpoint
      const heliusKey = process.env.HELIUS_API_KEY;
      rpcUrl = heliusKey 
        ? `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`
        : process.env.SOLANA_MAINNET_RPC || 'https://api.mainnet-beta.solana.com';
    } else {
      rpcUrl = process.env.SOLANA_DEVNET_RPC || 'https://api.devnet.solana.com';
    }

    const connection = new Connection(rpcUrl, {
      commitment: 'confirmed' as Commitment,
      confirmTransactionInitialTimeout: 30000,
    });

    this.instances.set(network, connection);
    return connection;
  }

  static async testConnection(network: 'mainnet' | 'devnet' = 'devnet'): Promise<boolean> {
    try {
      const connection = this.getConnection(network);
      await connection.getSlot();
      return true;
    } catch (error) {
      console.error(`Failed to connect to ${network}:`, error);
      return false;
    }
  }

  static getDefaultNetwork(): 'mainnet' | 'devnet' {
    const defaultNet = process.env.DEFAULT_NETWORK as 'mainnet' | 'devnet';
    return defaultNet === 'mainnet' ? 'mainnet' : 'devnet';
  }
}

// Well-known mint addresses
export const WELL_KNOWN_MINTS = {
  SOL: 'So11111111111111111111111111111111111111112', // Wrapped SOL
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  SRM: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',
  FTT: 'AGFEad2et2ZJif9jaGpdMixQqvW5i81aBdvKe7PHNfz3',
  MNGO: 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac',
  MSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  GMT: '7i5KKsX2weiTkry7jA4ZwSuXGhs5eJBEjY8vVxR4pfRx',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  PYTH: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  JTO: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
  RNDR: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',
  HNT: 'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux',
  MNDE: 'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey'
};

// Helper function to resolve token mints
export function resolveMint(token: string): string {
  const upper = token.toUpperCase();
  return WELL_KNOWN_MINTS[upper as keyof typeof WELL_KNOWN_MINTS] || token;
}