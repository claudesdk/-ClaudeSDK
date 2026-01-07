import { AgentAction, AgentPlan } from './types';

export type AgentPolicy = {
  /** Allowlist of recipient addresses for SOL transfers. If omitted, transfers are blocked unless allowAllTransfers=true */
  allowedRecipients?: string[];
  allowAllTransfers?: boolean;
  /** Max lamports per transfer */
  maxTransferLamports?: bigint;

  /** Allowlist of token mints for swaps (input/output). If omitted, swaps are blocked unless allowAllSwaps=true */
  allowedMints?: string[];
  allowAllSwaps?: boolean;
  /** Max raw amount for swaps (u64 as bigint) */
  maxSwapAmount?: bigint;

  /** Max slippage bps allowed */
  maxSlippageBps?: number;
};

export type PolicyViolation = { path: string; message: string };

export function validatePlanPolicy(
  plan: AgentPlan,
  policy: AgentPolicy
): PolicyViolation[] {
  const v: PolicyViolation[] = [];

  for (let i = 0; i < plan.actions.length; i++) {
    v.push(...validateActionPolicy(plan.actions[i]!, policy, `actions[${i}]`));
  }

  return v;
}

export function validateActionPolicy(
  action: AgentAction,
  policy: AgentPolicy,
  path: string
): PolicyViolation[] {
  const v: PolicyViolation[] = [];

  if (action.type === 'transferSol') {
    if (!policy.allowAllTransfers) {
      const allowed = new Set((policy.allowedRecipients ?? []).map((s) => s.trim()));
      if (!allowed.has(action.to.trim())) {
        v.push({ path: `${path}.to`, message: 'Recipient is not allowlisted' });
      }
    }

    const lamports = BigInt(action.lamports);
    if (policy.maxTransferLamports != null && lamports > policy.maxTransferLamports) {
      v.push({ path: `${path}.lamports`, message: 'Transfer exceeds maxTransferLamports' });
    }
  }

  if (action.type === 'swapJupiter') {
    if (!policy.allowAllSwaps) {
      const allowed = new Set((policy.allowedMints ?? []).map((s) => s.trim()));
      if (!allowed.has(action.inputMint.trim())) {
        v.push({ path: `${path}.inputMint`, message: 'inputMint is not allowlisted' });
      }
      if (!allowed.has(action.outputMint.trim())) {
        v.push({ path: `${path}.outputMint`, message: 'outputMint is not allowlisted' });
      }
    }

    const amount = BigInt(action.amount);
    if (policy.maxSwapAmount != null && amount > policy.maxSwapAmount) {
      v.push({ path: `${path}.amount`, message: 'Swap exceeds maxSwapAmount' });
    }

    if (action.slippageBps != null && policy.maxSlippageBps != null) {
      if (action.slippageBps > policy.maxSlippageBps) {
        v.push({ path: `${path}.slippageBps`, message: 'slippageBps exceeds maxSlippageBps' });
      }
    }
  }

  return v;
}
