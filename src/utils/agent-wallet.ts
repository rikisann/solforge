import { Keypair, PublicKey } from '@solana/web3.js';

/**
 * Get the agent wallet keypair from environment variable
 * @returns Keypair if configured, null if not
 */
export function getAgentWallet(): Keypair | null {
  const secretKeyEnv = process.env.AGENT_WALLET_SECRET_KEY;
  
  if (!secretKeyEnv) {
    return null;
  }
  
  try {
    // Parse the JSON array of numbers from the env var
    const secretKeyArray = JSON.parse(secretKeyEnv);
    
    if (!Array.isArray(secretKeyArray) || secretKeyArray.length !== 64) {
      console.error('Invalid AGENT_WALLET_SECRET_KEY format - must be array of 64 numbers');
      return null;
    }
    
    // Create keypair from the secret key bytes
    const secretKey = Uint8Array.from(secretKeyArray);
    return Keypair.fromSecretKey(secretKey);
  } catch (error) {
    console.error('Failed to parse AGENT_WALLET_SECRET_KEY:', error);
    return null;
  }
}

/**
 * Get the agent wallet public key as string
 * @returns PublicKey string if configured, null if not
 */
export function getAgentPublicKey(): string | null {
  const wallet = getAgentWallet();
  return wallet ? wallet.publicKey.toBase58() : null;
}

/**
 * Check if agent wallet is enabled (configured)
 * @returns boolean
 */
export function isAgentWalletEnabled(): boolean {
  return getAgentWallet() !== null;
}