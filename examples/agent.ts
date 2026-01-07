import { Connection } from '@solana/web3.js';
import {
  AnthropicClient,
  ClaudeAgent,
  keypairFromSource,
  getBalanceLamports
} from '../src/index';

async function main() {
  const conn = new Connection(process.env.SOLANA_RPC!, 'confirmed');
  const signer = keypairFromSource(process.env.SOLANA_SECRET_KEY!);

  const anthropic = new AnthropicClient({
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20240620'
  });

  const agent = new ClaudeAgent({
    anthropic,
    jupiter: { apiKey: process.env.JUPITER_API_KEY },
    policy: {
      // Example: allow only small transfers
      allowAllTransfers: false,
      allowedRecipients: [],
      maxTransferLamports: 1_000_000n,

      // Example: allow swaps only between these mints
      allowAllSwaps: false,
      allowedMints: [
        'So11111111111111111111111111111111111111112',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      ],
      maxSwapAmount: 10_000_000n,
      maxSlippageBps: 100
    },
    confirm: (action) => {
      console.log('About to execute action:', action);
      // Replace with real UI/CLI confirmation.
      return false; // default to "no" for safety
    }
  });

  const bal = await getBalanceLamports(conn, signer.publicKey);

  const plan = await agent.proposePlan({
    goal: 'Swap 0.01 SOL to USDC',
    context: {
      wallet: signer.publicKey.toBase58(),
      balanceLamports: bal.toString(),
      network: 'mainnet-beta'
    }
  });

  console.log('Plan:', JSON.stringify(plan, null, 2));
  console.log('Violations:', agent.validate(plan));

  // agent.execute(plan, { conn, signer })
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
