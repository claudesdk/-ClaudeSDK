import { Connection, Keypair } from '@solana/web3.js';
import { asPublicKey, transferSol } from '../wallet';
import { executeJupiterSwap, getJupiterQuote, JupiterClientOptions } from '../jupiter';
import { AnthropicClient } from './anthropic';
import { AgentAction, AgentPlan } from './types';
import { AgentPolicy, validatePlanPolicy } from './policy';

export type ClaudeAgentOptions = {
  /** Optional Anthropic client. If omitted, `proposePlan` returns a noop plan. */
  anthropic?: AnthropicClient;

  /** Optional guardrails. Always validate before executing. */
  policy?: AgentPolicy;

  /** Jupiter client options for swap actions. */
  jupiter?: JupiterClientOptions;

  /**
   * Called before executing each action. Return true to proceed.
   * Use this to implement manual confirmations / UI prompts.
   */
  confirm?: (action: AgentAction) => Promise<boolean> | boolean;
};

/**
 * ClaudeAgent: asks Claude for a structured plan (JSON) and can execute it (with guardrails).
 *
 * IMPORTANT: this is intentionally conservative:
 * - private keys stay local
 * - you validate the plan against a policy
 * - you can require manual confirmation per action
 */
export class ClaudeAgent {
  private readonly anthropic?: AnthropicClient;
  private readonly policy?: AgentPolicy;
  private readonly jupiter?: JupiterClientOptions;
  private readonly confirm?: (action: AgentAction) => Promise<boolean> | boolean;

  constructor(opts: ClaudeAgentOptions = {}) {
    this.anthropic = opts.anthropic;
    this.policy = opts.policy;
    this.jupiter = opts.jupiter;
    this.confirm = opts.confirm;
  }

  /**
   * Ask Claude to propose actions.
   *
   * The returned value MUST be validated before executing.
   */
  async proposePlan(args: {
    goal: string;
    context?: Record<string, unknown>;
    maxActions?: number;
  }): Promise<AgentPlan> {
    if (!this.anthropic) {
      return { goal: args.goal, summary: 'No Anthropic client configured', actions: [{ type: 'noop' }] };
    }

    const maxActions = args.maxActions ?? 3;

    const system = [
      'You are an automated trading/wallet assistant for Solana.',
      'You MUST output ONLY valid JSON, no markdown.',
      'You propose actions, but you DO NOT have access to private keys.',
      'Use conservative defaults and prefer no-op when unsure.'
    ].join('\n');

    const schemaHint = {
      goal: 'string',
      summary: 'string',
      actions: [
        { type: 'noop', reason: 'string?' },
        { type: 'transferSol', to: 'base58 pubkey', lamports: 'string u64' },
        {
          type: 'swapJupiter',
          inputMint: 'base58 mint',
          outputMint: 'base58 mint',
          amount: 'string u64 raw',
          slippageBps: 'number?',
          swapMode: '"ExactIn" | "ExactOut"?'
        }
      ]
    };

    const prompt = [
      `Goal: ${args.goal}`,
      '',
      `Constraints:`,
      `- Return at most ${maxActions} actions.`,
      `- If you do not have enough info, return a single noop action.`,
      '',
      `Context (JSON):`,
      JSON.stringify(args.context ?? {}, null, 2),
      '',
      `Output JSON schema (informal):`,
      JSON.stringify(schemaHint, null, 2),
      '',
      `Return ONLY a JSON object with keys: goal, summary, actions.`
    ].join('\n');

    const plan = await this.anthropic.createJson<AgentPlan>({
      system,
      prompt,
      maxTokens: 900,
      temperature: 0
    });

    // Basic normalization / safety
    if (!plan || typeof plan !== 'object') {
      return { goal: args.goal, summary: 'Invalid plan', actions: [{ type: 'noop' }] };
    }
    if (!Array.isArray((plan as any).actions)) (plan as any).actions = [{ type: 'noop' }];
    (plan as any).actions = (plan as any).actions.slice(0, maxActions);

    return plan;
  }

  /** Validate plan against configured policy (if provided). */
  validate(plan: AgentPlan) {
    if (!this.policy) return [];
    return validatePlanPolicy(plan, this.policy);
  }

  /**
   * Execute an already validated plan.
   * You should call `validate()` first and handle violations.
   */
  async execute(plan: AgentPlan, params: { conn: Connection; signer: Keypair }): Promise<string[]> {
    const violations = this.validate(plan);
    if (violations.length) {
      const msg = violations.map((x) => `${x.path}: ${x.message}`).join('; ');
      throw new Error(`Plan violates policy: ${msg}`);
    }

    const sigs: string[] = [];
    for (const action of plan.actions) {
      const ok = await Promise.resolve(this.confirm?.(action) ?? true);
      if (!ok) continue;

      if (action.type === 'noop') continue;

      if (action.type === 'transferSol') {
        const sig = await transferSol(
          params.conn,
          params.signer,
          asPublicKey(action.to),
          BigInt(action.lamports),
          { confirm: true }
        );
        sigs.push(sig);
        continue;
      }

      if (action.type === 'swapJupiter') {
        const quote = await getJupiterQuote(
          {
            inputMint: action.inputMint,
            outputMint: action.outputMint,
            amount: action.amount,
            slippageBps: action.slippageBps ?? 50,
            swapMode: action.swapMode
          },
          this.jupiter
        );

        const sig = await executeJupiterSwap({
          conn: params.conn,
          signer: params.signer,
          quoteResponse: quote,
          jupiter: this.jupiter,
          confirm: true
        });
        sigs.push(sig);
        continue;
      }

      const _never: never = action;
      throw new Error(`Unsupported action: ${JSON.stringify(_never)}`);
    }

    return sigs;
  }
}
