import { Connection } from '@solana/web3.js';
import { executeJupiterSwap, getJupiterQuote, keypairFromSource } from '../src/index';

// Example: swap SOL -> USDC (ExactIn)
// WARNING: test on devnet first and validate your quote.

async function main() {
  const conn = new Connection(process.env.SOLANA_RPC!, 'confirmed');
  const signer = keypairFromSource(process.env.SOLANA_SECRET_KEY!);

  const SOL = 'So11111111111111111111111111111111111111112';
  const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

  const quote = await getJupiterQuote(
    {
      inputMint: SOL,
      outputMint: USDC,
      amount: 10000000n, // 0.01 SOL in lamports
      slippageBps: 100
    },
    { apiKey: process.env.JUP_API_KEY }
  );

  console.log({ outAmount: quote.outAmount, priceImpactPct: (quote as any).priceImpactPct });

  const sig = await executeJupiterSwap({
    conn,
    signer,
    quoteResponse: quote,
    jupiter: { apiKey: process.env.JUP_API_KEY }
  });

  console.log({ sig });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
