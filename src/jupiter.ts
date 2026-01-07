import {
  Connection,
  Keypair,
  PublicKey,
  TransactionSignature,
  VersionedTransaction
} from '@solana/web3.js';

export type JupiterSwapMode = 'ExactIn' | 'ExactOut';

export type JupiterClientOptions = {
  /** Jupiter base URL, default: https://api.jup.ag/swap/v1 */
  baseUrl?: string;
  /** Jupiter API key (x-api-key). Get one at portal.jup.ag */
  apiKey?: string;
};

export type JupiterQuoteParams = {
  inputMint: string;
  outputMint: string;
  /** raw amount (u64). ExactIn: input amount, ExactOut: output amount */
  amount: string | number | bigint;
  slippageBps?: number;
  swapMode?: JupiterSwapMode;
  onlyDirectRoutes?: boolean;
  restrictIntermediateTokens?: boolean;
};

export type JupiterQuoteResponse = Record<string, unknown> & {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  slippageBps: number;
  swapMode: JupiterSwapMode;
};

export type JupiterSwapParams = {
  quoteResponse: JupiterQuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  dynamicComputeUnitLimit?: boolean;
  asLegacyTransaction?: boolean;
};

export type JupiterSwapResponse = {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports?: number;
};

function withDefaults(opts?: JupiterClientOptions) {
  return {
    baseUrl: opts?.baseUrl ?? 'https://api.jup.ag/swap/v1',
    apiKey: opts?.apiKey
  } as const;
}

function toAmountString(amount: string | number | bigint): string {
  if (typeof amount === 'string') return amount;
  if (typeof amount === 'bigint') return amount.toString();
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Invalid amount');
  // Ensure integer-ish
  if (!Number.isInteger(amount)) throw new Error('amount must be an integer (u64)');
  return String(amount);
}

export async function getJupiterQuote(
  params: JupiterQuoteParams,
  opts?: JupiterClientOptions
): Promise<JupiterQuoteResponse> {
  const { baseUrl, apiKey } = withDefaults(opts);

  const url = new URL(baseUrl.replace(/\/$/, '') + '/quote');
  url.searchParams.set('inputMint', params.inputMint);
  url.searchParams.set('outputMint', params.outputMint);
  url.searchParams.set('amount', toAmountString(params.amount));
  if (params.slippageBps != null) url.searchParams.set('slippageBps', String(params.slippageBps));
  if (params.swapMode) url.searchParams.set('swapMode', params.swapMode);
  if (params.onlyDirectRoutes != null)
    url.searchParams.set('onlyDirectRoutes', String(params.onlyDirectRoutes));
  if (params.restrictIntermediateTokens != null)
    url.searchParams.set('restrictIntermediateTokens', String(params.restrictIntermediateTokens));

  const res = await fetch(url, {
    headers: apiKey ? { 'x-api-key': apiKey } : undefined
  });
  if (!res.ok) throw new Error(`Jupiter /quote failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as JupiterQuoteResponse;
}

export async function buildJupiterSwapTx(
  params: JupiterSwapParams,
  opts?: JupiterClientOptions
): Promise<{ tx: VersionedTransaction; lastValidBlockHeight: number }> {
  const { baseUrl, apiKey } = withDefaults(opts);
  const res = await fetch(baseUrl.replace(/\/$/, '') + '/swap', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-api-key': apiKey } : {})
    },
    body: JSON.stringify({
      userPublicKey: params.userPublicKey,
      quoteResponse: params.quoteResponse,
      wrapAndUnwrapSol: params.wrapAndUnwrapSol ?? true,
      dynamicComputeUnitLimit: params.dynamicComputeUnitLimit ?? true,
      asLegacyTransaction: params.asLegacyTransaction ?? false
    })
  });

  if (!res.ok) throw new Error(`Jupiter /swap failed: ${res.status} ${res.statusText}`);
  const json = (await res.json()) as JupiterSwapResponse;

  const raw = Buffer.from(json.swapTransaction, 'base64');
  const tx = VersionedTransaction.deserialize(raw);
  return { tx, lastValidBlockHeight: json.lastValidBlockHeight };
}

export type ExecuteJupiterSwapParams = {
  conn: Connection;
  signer: Keypair;
  quoteResponse: JupiterQuoteResponse;
  /** Optional: send swap proceeds to a different wallet. Default: signer.publicKey */
  userPublicKey?: PublicKey;
  /** Jupiter options */
  jupiter?: JupiterClientOptions;
  /** Confirm swap */
  confirm?: boolean;
};

export async function executeJupiterSwap(
  params: ExecuteJupiterSwapParams
): Promise<TransactionSignature> {
  const userPk = (params.userPublicKey ?? params.signer.publicKey).toBase58();
  const { tx, lastValidBlockHeight } = await buildJupiterSwapTx(
    {
      quoteResponse: params.quoteResponse,
      userPublicKey: userPk
    },
    params.jupiter
  );

  tx.sign([params.signer]);
  const sig = await params.conn.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed'
  });

  if (params.confirm ?? true) {
    const latest = await params.conn.getLatestBlockhash('confirmed');
    // prefer Jupiter's lastValidBlockHeight if it is lower (more strict)
    const lvh = Math.min(latest.lastValidBlockHeight, lastValidBlockHeight);
    await params.conn.confirmTransaction(
      { signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: lvh },
      'confirmed'
    );
  }

  return sig;
}
