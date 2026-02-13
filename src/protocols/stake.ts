import { TransactionInstruction, PublicKey, LAMPORTS_PER_SOL, StakeProgram, SystemProgram, Transaction } from '@solana/web3.js';
import { BuildIntent, ProtocolHandler } from '../utils/types';
import { AccountResolver } from '../engine/resolver';
import { Buffer } from 'buffer';

interface StakeAccountParams {
  lamports: bigint;
  space: number;
}

interface DelegateParams {
  stakeAccount: PublicKey;
  voteAccount: PublicKey;
}

interface WithdrawParams {
  stakeAccount: PublicKey;
  lamports: bigint;
}

export class StakeProtocol implements ProtocolHandler {
  name = 'stake';
  description = 'Solana native staking program';
  supportedIntents = ['stake', 'delegate', 'deactivate', 'withdraw', 'create-stake-account', 'native-stake'];

  readonly PROGRAM_ID = new PublicKey('Stake11111111111111111111111111111111111111');

  async build(intent: BuildIntent): Promise<TransactionInstruction[]> {
    const { params } = intent;
    const action = intent.intent;

    switch (action) {
      case 'stake':
      case 'native-stake':
        return this.buildCreateAndDelegate(params, intent);
        
      case 'create-stake-account':
        return this.buildCreateStakeAccount(params, intent);
        
      case 'delegate':
        return this.buildDelegate(params, intent);
        
      case 'deactivate':
        return this.buildDeactivate(params, intent);
        
      case 'withdraw':
        return this.buildWithdraw(params, intent);
        
      default:
        throw new Error(`Unsupported Stake action: ${action}`);
    }
  }

  validateParams(params: Record<string, any>): boolean {
    if (params.action === 'stake' || params.action === 'native-stake') {
      return (
        typeof params.amount === 'number' &&
        params.amount > 0 &&
        (!params.validator || typeof params.validator === 'string')
      );
    }

    if (params.action === 'create-stake-account') {
      return typeof params.amount === 'number' && params.amount > 0;
    }

    if (params.action === 'delegate') {
      return (
        typeof params.stakeAccount === 'string' &&
        typeof params.validator === 'string'
      );
    }

    if (params.action === 'deactivate') {
      return typeof params.stakeAccount === 'string';
    }

    if (params.action === 'withdraw') {
      return (
        typeof params.stakeAccount === 'string' &&
        typeof params.amount === 'number' &&
        params.amount > 0
      );
    }

    // Direct intent validation
    if (typeof params.amount === 'number' && params.amount > 0) {
      return true;
    }

    return false;
  }

  private async buildCreateAndDelegate(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    const payer = AccountResolver.resolvePublicKey(intent.payer);
    const amount = params.amount;
    const validator = params.validator || this.getDefaultValidator();

    // Convert SOL to lamports
    const lamports = BigInt(Math.floor(amount * LAMPORTS_PER_SOL));

    if (lamports <= 0n) {
      throw new Error('Stake amount must be positive');
    }

    // Generate a new stake account keypair - in production, this would be provided
    const [stakeAccount] = AccountResolver.findProgramAddress(
      [payer.toBuffer(), Buffer.from('stake'), Buffer.from(Date.now().toString())],
      this.PROGRAM_ID
    );

    const voteAccount = AccountResolver.resolvePublicKey(validator);
    const network = intent.network || 'devnet';
    
    // Get minimum rent exemption for stake account
    const rentExemption = await AccountResolver.getMinimumRentExemption(200, network); // Stake account size
    const totalLamports = lamports + BigInt(rentExemption);

    const instructions: TransactionInstruction[] = [];

    // 1. Create stake account - extract instruction from transaction
    const createAccountTx = StakeProgram.createAccount({
      fromPubkey: payer,
      stakePubkey: stakeAccount,
      authorized: {
        staker: payer,
        withdrawer: payer
      },
      lockup: {
        unixTimestamp: 0,
        epoch: 0,
        custodian: payer
      },
      lamports: Number(totalLamports)
    });
    instructions.push(...createAccountTx.instructions);

    // 2. Delegate to validator - extract instruction from transaction
    const delegateTx = StakeProgram.delegate({
      stakePubkey: stakeAccount,
      authorizedPubkey: payer,
      votePubkey: voteAccount
    });
    instructions.push(...delegateTx.instructions);

    return instructions;
  }

  private async buildCreateStakeAccount(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    const payer = AccountResolver.resolvePublicKey(intent.payer);
    const amount = params.amount;

    // Convert SOL to lamports
    const lamports = BigInt(Math.floor(amount * LAMPORTS_PER_SOL));

    if (lamports <= 0n) {
      throw new Error('Stake account amount must be positive');
    }

    // Generate stake account address
    const [stakeAccount] = AccountResolver.findProgramAddress(
      [payer.toBuffer(), Buffer.from('stake-account'), Buffer.from(Date.now().toString())],
      this.PROGRAM_ID
    );

    const createAccountTx = StakeProgram.createAccount({
      fromPubkey: payer,
      stakePubkey: stakeAccount,
      authorized: {
        staker: payer,
        withdrawer: payer
      },
      lockup: {
        unixTimestamp: 0,
        epoch: 0,
        custodian: payer
      },
      lamports: Number(lamports)
    });

    return createAccountTx.instructions;
  }

  private async buildDelegate(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    const payer = AccountResolver.resolvePublicKey(intent.payer);
    const stakeAccount = AccountResolver.resolvePublicKey(params.stakeAccount);
    const voteAccount = AccountResolver.resolvePublicKey(params.validator);

    const delegateTx = StakeProgram.delegate({
      stakePubkey: stakeAccount,
      authorizedPubkey: payer,
      votePubkey: voteAccount
    });

    return delegateTx.instructions;
  }

  private async buildDeactivate(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    const payer = AccountResolver.resolvePublicKey(intent.payer);
    const stakeAccount = AccountResolver.resolvePublicKey(params.stakeAccount);

    const deactivateTx = StakeProgram.deactivate({
      stakePubkey: stakeAccount,
      authorizedPubkey: payer
    });

    return deactivateTx.instructions;
  }

  private async buildWithdraw(
    params: Record<string, any>,
    intent: BuildIntent
  ): Promise<TransactionInstruction[]> {
    const payer = AccountResolver.resolvePublicKey(intent.payer);
    const stakeAccount = AccountResolver.resolvePublicKey(params.stakeAccount);
    const amount = params.amount;
    const destination = params.destination ? AccountResolver.resolvePublicKey(params.destination) : payer;

    // Convert SOL to lamports
    const lamports = BigInt(Math.floor(amount * LAMPORTS_PER_SOL));

    if (lamports <= 0n) {
      throw new Error('Withdraw amount must be positive');
    }

    const withdrawTx = StakeProgram.withdraw({
      stakePubkey: stakeAccount,
      authorizedPubkey: payer,
      toPubkey: destination,
      lamports: Number(lamports)
    });

    return withdrawTx.instructions;
  }

  private getDefaultValidator(): string {
    // Return a well-known validator for the network
    // In production, this would be configurable or fetched from a validator list
    return 'J1to3PQfXidUUhprQWgdKkQAMWPJAEqSJ7amkBDE9qhF'; // Example validator
  }

  getRequiredAccounts(params: Record<string, any>): PublicKey[] {
    const accounts: PublicKey[] = [];
    
    if (params.stakeAccount) {
      accounts.push(AccountResolver.resolvePublicKey(params.stakeAccount));
    }
    
    if (params.validator) {
      accounts.push(AccountResolver.resolvePublicKey(params.validator));
    }

    if (params.destination) {
      accounts.push(AccountResolver.resolvePublicKey(params.destination));
    }

    return accounts;
  }

  // Helper methods for stake account management
  async getStakeAccountInfo(stakeAccount: string, network: string = 'devnet'): Promise<any> {
    // In a real implementation, this would fetch stake account data
    // and return parsed information about the stake account
    return {
      balance: 0,
      state: 'uninitialized', // 'uninitialized', 'initialized', 'delegated', 'stake', 'rewardsPool'
      voter: null,
      activationEpoch: null,
      deactivationEpoch: null
    };
  }

  async getRewards(stakeAccount: string, network: string = 'devnet'): Promise<number> {
    // In a real implementation, this would calculate accumulated staking rewards
    return 0;
  }

  async getValidatorList(network: string = 'devnet'): Promise<Array<{ voteAccount: string; name: string; commission: number }>> {
    // In a real implementation, this would fetch the current validator set
    return [
      {
        voteAccount: 'J1to3PQfXidUUhprQWgdKkQAMWPJAEqSJ7amkBDE9qhF',
        name: 'Example Validator',
        commission: 5.0
      }
    ];
  }

  // Note: Native staking has several important considerations:
  // 1. Stake accounts need to be warmed up (takes 1-2 epochs)
  // 2. Deactivation also takes 1-2 epochs before withdrawal is possible
  // 3. Minimum stake amounts vary by network
  // 4. Validator performance affects rewards
  // 5. Slashing risk if validator misbehaves
}