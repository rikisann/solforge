import { PublicKey, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { RPCConnection } from '../utils/connection';

export class AccountResolver {
  
  /**
   * Get or derive Associated Token Account address
   */
  static async getAssociatedTokenAccount(
    mint: PublicKey,
    owner: PublicKey,
    allowOwnerOffCurve: boolean = false
  ): Promise<PublicKey> {
    return await getAssociatedTokenAddress(
      mint,
      owner,
      allowOwnerOffCurve,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
  }

  /**
   * Check if an account exists on-chain
   */
  static async accountExists(
    account: PublicKey,
    network: 'mainnet' | 'devnet' = 'devnet'
  ): Promise<boolean> {
    try {
      const connection = RPCConnection.getConnection(network);
      const accountInfo = await connection.getAccountInfo(account);
      return accountInfo !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get token account balance
   */
  static async getTokenBalance(
    tokenAccount: PublicKey,
    network: 'mainnet' | 'devnet' = 'devnet'
  ): Promise<bigint> {
    try {
      const connection = RPCConnection.getConnection(network);
      const balance = await connection.getTokenAccountBalance(tokenAccount);
      return BigInt(balance.value.amount);
    } catch {
      return BigInt(0);
    }
  }

  /**
   * Get SOL balance
   */
  static async getSolBalance(
    account: PublicKey,
    network: 'mainnet' | 'devnet' = 'devnet'
  ): Promise<number> {
    try {
      const connection = RPCConnection.getConnection(network);
      const balance = await connection.getBalance(account);
      return balance / 1e9; // Convert lamports to SOL
    } catch {
      return 0;
    }
  }

  /**
   * Find Program Derived Address
   */
  static findProgramAddress(
    seeds: (Buffer | Uint8Array)[],
    programId: PublicKey
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(seeds, programId);
  }

  /**
   * Get minimum rent exemption for account size
   */
  static async getMinimumRentExemption(
    dataLength: number,
    network: 'mainnet' | 'devnet' = 'devnet'
  ): Promise<number> {
    try {
      const connection = RPCConnection.getConnection(network);
      return await connection.getMinimumBalanceForRentExemption(dataLength);
    } catch {
      return 890880; // fallback rent exemption
    }
  }

  /**
   * Resolve a string to PublicKey, handling common formats
   */
  static resolvePublicKey(input: string): PublicKey {
    try {
      return new PublicKey(input);
    } catch (error) {
      throw new Error(`Invalid public key: ${input}`);
    }
  }

  /**
   * Get token accounts owned by a wallet
   */
  static async getTokenAccountsByOwner(
    owner: PublicKey,
    mint?: PublicKey,
    network: 'mainnet' | 'devnet' = 'devnet'
  ): Promise<Array<{ pubkey: PublicKey; account: any }>> {
    try {
      const connection = RPCConnection.getConnection(network);
      
      if (mint) {
        const response = await connection.getTokenAccountsByOwner(owner, {
          mint: mint
        });
        return [...response.value];
      } else {
        const response = await connection.getTokenAccountsByOwner(owner, {
          programId: TOKEN_PROGRAM_ID
        });
        return [...response.value];
      }
    } catch (error) {
      console.error('Failed to get token accounts:', error);
      return [];
    }
  }
}