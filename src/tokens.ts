import { Connection, PublicKey } from '@solana/web3.js';

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

export type SplTokenBalance = {
  mint: string;
  amountRaw: string;
  decimals: number;
  uiAmount: number | null;
  uiAmountString: string;
  tokenAccount: string;
};

/**
 * List SPL token balances using `getParsedTokenAccountsByOwner`.
 * No dependency on @solana/spl-token required.
 */
export async function getSplTokenBalances(
  conn: Connection,
  owner: PublicKey
): Promise<SplTokenBalance[]> {
  const resp = await conn.getParsedTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID
  });

  const out: SplTokenBalance[] = [];
  for (const { pubkey, account } of resp.value) {
    const parsed = account.data.parsed as any;
    const info = parsed?.info;
    const tokenAmount = info?.tokenAmount;

    if (!info?.mint || !tokenAmount) continue;

    out.push({
      mint: info.mint,
      amountRaw: String(tokenAmount.amount ?? '0'),
      decimals: Number(tokenAmount.decimals ?? 0),
      uiAmount: tokenAmount.uiAmount ?? null,
      uiAmountString: String(tokenAmount.uiAmountString ?? ''),
      tokenAccount: pubkey.toBase58()
    });
  }
  return out;
}
