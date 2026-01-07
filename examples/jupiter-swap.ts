import { Connection, PublicKey } from '@solana/web3.js';
import {
  executeJupiterSwap,
  getJupiterQuote,
  keypairFromSource
} from '../src/index';

// Example: swap SOL -> USDC using Jupiter.
// Requires a Jupiter API key: https://portal.jup.ag

async function main() {
  const conn = new Connection(process.env.SOLANA_RPC!, 'confirmed');
  const signer = keypairFromSource(process.env.SOLANA_SECRET_KEY!);

  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

  // 0.01 SOL in lamports
  const amount = 10_000_000n;

  const quote = await getJupiterQuote(
    {
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      amount,
      slippageBps: 75
    },
    {
      apiKey: process.env.JUPITER_API_KEY!
    }
  );

  console.log('Quote outAmount:', quote.outAmount);

  const sig = await executeJupiterSwap({
    conn,
    signer,
    quoteResponse: quote,
    jupiter: { apiKey: process.env.JUPITER_API_KEY! },
    confirm: true
  });

  console.log('Swap tx:', sig);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
