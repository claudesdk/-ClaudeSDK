import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionSignature
} from '@solana/web3.js';
import bs58 from 'bs58';

export type KeypairSource =
  | string
  | Uint8Array
  | number[]
  | { secretKey: Uint8Array | number[] };

/**
 * Load a Keypair from either:
 * - Base58-encoded secret key (common for Solana tooling)
 * - JSON array (as string) of secret key bytes
 * - Uint8Array / number[]
 */
export function keypairFromSource(source: KeypairSource): Keypair {
  if (typeof source === 'string') {
    const trimmed = source.trim();

    // JSON secret key: "[1,2,3,...]"
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const arr = JSON.parse(trimmed) as unknown;
      if (!Array.isArray(arr)) throw new Error('Invalid JSON secret key: expected array');
      return Keypair.fromSecretKey(Uint8Array.from(arr as number[]));
    }

    // Base58 secret key
    return Keypair.fromSecretKey(bs58.decode(trimmed));
  }

  if (source instanceof Uint8Array) {
    return Keypair.fromSecretKey(source);
  }

  if (Array.isArray(source)) {
    return Keypair.fromSecretKey(Uint8Array.from(source));
  }

  // { secretKey: ... }
  const sk = source.secretKey;
  if (sk instanceof Uint8Array) return Keypair.fromSecretKey(sk);
  if (Array.isArray(sk)) return Keypair.fromSecretKey(Uint8Array.from(sk));

  throw new Error('Unsupported keypair source');
}

export async function getBalanceLamports(
  conn: Connection,
  pubkey: PublicKey
): Promise<bigint> {
  const bal = await conn.getBalance(pubkey, 'confirmed');
  return BigInt(bal);
}

export type TransferSolOptions = {
  /** Confirm with `conn.confirmTransaction` */
  confirm?: boolean;
  /** Commitment used for `sendTransaction` + confirm */
  commitment?: 'processed' | 'confirmed' | 'finalized';
};

export async function transferSol(
  conn: Connection,
  payer: Keypair,
  to: PublicKey,
  lamports: bigint,
  opts: TransferSolOptions = {}
): Promise<TransactionSignature> {
  if (lamports > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(
      `lamports is too large for a JS number (max safe: ${Number.MAX_SAFE_INTEGER}). ` +
        `Split into multiple transfers or use a different builder.`
    );
  }

  const ix = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: to,
    lamports: Number(lamports)
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = payer.publicKey;

  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash(
    opts.commitment ?? 'confirmed'
  );
  tx.recentBlockhash = blockhash;

  const sig = await conn.sendTransaction(tx, [payer], {
    preflightCommitment: opts.commitment ?? 'confirmed'
  });

  if (opts.confirm) {
    await conn.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      opts.commitment ?? 'confirmed'
    );
  }

  return sig;
}

/** Convenience: parse a PublicKey from string or pass-through. */
export function asPublicKey(pubkey: PublicKey | string): PublicKey {
  return typeof pubkey === 'string' ? new PublicKey(pubkey) : pubkey;
}
