import { Connection } from '@solana/web3.js';
import { getBalanceLamports, keypairFromSource } from '../src/index';

async function main() {
  const conn = new Connection(process.env.SOLANA_RPC!, 'confirmed');
  const kp = keypairFromSource(process.env.SOLANA_SECRET_KEY!);
  const bal = await getBalanceLamports(conn, kp.publicKey);
  console.log({ pubkey: kp.publicKey.toBase58(), lamports: bal.toString() });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
