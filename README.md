![ClaudeSDK banner](./assets/bannerclaudesdk.png)

# Claude SDK

SDK for managing Solana wallets with an AI agent (Claude).

> Goal: give an AI agent a **safe** way to propose wallet actions (read balance, build tx, send tx),
> while **private keys stay local** and every action can be validated and confirmed.

---

## Install

```bash
npm i claude-sdk
```

---

## Quickstart

```ts
import { Connection, PublicKey } from "@solana/web3.js";
import { keypairFromSource, getBalanceLamports, transferSol } from "claude-sdk";

const conn = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

// From base58 or JSON secret key
const payer = keypairFromSource(process.env.SOLANA_SECRET_KEY!);

const to = new PublicKey("11111111111111111111111111111111");
const before = await getBalanceLamports(conn, payer.publicKey);
console.log({ before });

// Example: send 0.001 SOL (1_000_000 lamports)
const sig = await transferSol(conn, payer, to, 1_000_000n, {
  confirm: true
});
console.log({ sig });
```

---

## API

### Wallet helpers

- `keypairFromSource(source)` — load a `Keypair` from **Base58** or **JSON secret key**
- `getBalanceLamports(conn, pubkey)` — get SOL balance in lamports
- `transferSol(conn, payer, to, lamports)` — send SOL (signs locally)
- `getSplTokenBalances(conn, owner)` — list SPL token balances via parsed token accounts

### Trading (memecoins)

ClaudeSDK includes an optional **Jupiter** swap wrapper:

- `getJupiterQuote(params)` — fetch a quote
- `buildJupiterSwapTx(params)` — request a swap tx from Jupiter and return a `VersionedTransaction`
- `executeJupiterSwap(params)` — sign locally and send to Solana

> Safety: you should **ALWAYS** validate quotes, token allowlists, max spend, and require manual confirmation.

### Agent interface (Claude)

- `ClaudeAgent` — ask Claude for a **structured plan** (JSON) and validate it against a policy before execution.
- `AnthropicClient` — minimal HTTP client for Claude Messages API (optional; no extra deps).

---

## Security model (important)

This SDK is designed with a strict rule:

- **Private keys never go to Claude**
- Claude returns a *plan* (structured actions)
- Your app validates the plan (limits, allowlists, confirmations)
- Only then a transaction is signed locally and sent

Recommended safety checks in your app:
- allowlist destination addresses
- allowlist token mints (for swaps)
- max lamports/token amount per tx
- require manual confirmation for transfers/swaps
- run on **devnet** while testing

---

## Roadmap

Planned:
- richer policy/guardrails module (limits, allowlists, confirmations)
- SPL token helpers (transfers)
- transaction simulation before signing
- optional integrations (Phantom/Ledger) — no raw secret keys

---

## License

MIT
