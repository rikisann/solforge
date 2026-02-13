import { VersionedTransaction, Keypair, Connection } from '@solana/web3.js';
import bs58 from 'bs58';
import { RPCConnection } from './connection';

export interface ExecuteResult {
  signature: string;
  explorerUrl: string;
}

/**
 * Sign and send a base64-encoded transaction using a base58 private key.
 * The private key is used in-memory only and never logged or persisted.
 */
export async function executeTransaction(
  transactionBase64: string,
  privateKeyBase58: string,
  network: 'mainnet' | 'devnet' = 'mainnet'
): Promise<ExecuteResult> {
  // Decode keypair from base58
  const secretKey = bs58.decode(privateKeyBase58);
  const keypair = Keypair.fromSecretKey(secretKey);

  // Deserialize the transaction
  const txBuffer = Buffer.from(transactionBase64, 'base64');
  const versionedTx = VersionedTransaction.deserialize(txBuffer);

  // Get fresh blockhash
  const connection = RPCConnection.getConnection(network);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  versionedTx.message.recentBlockhash = blockhash;

  // Sign
  versionedTx.sign([keypair]);

  // Send
  const signature = await connection.sendRawTransaction(versionedTx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });

  // Build explorer URL
  const explorerUrl = network === 'devnet'
    ? `https://solscan.io/tx/${signature}?cluster=devnet`
    : `https://solscan.io/tx/${signature}`;

  return { signature, explorerUrl };
}

/**
 * Execute multiple transactions sequentially.
 */
export async function executeMultipleTransactions(
  transactions: string[],
  privateKeyBase58: string,
  network: 'mainnet' | 'devnet' = 'mainnet'
): Promise<ExecuteResult[]> {
  const results: ExecuteResult[] = [];
  for (const tx of transactions) {
    const result = await executeTransaction(tx, privateKeyBase58, network);
    results.push(result);
  }
  return results;
}
