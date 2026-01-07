export type AgentAction =
  | {
      type: 'noop';
      reason?: string;
    }
  | {
      type: 'transferSol';
      to: string;
      lamports: string; // u64
    }
  | {
      type: 'swapJupiter';
      inputMint: string;
      outputMint: string;
      amount: string; // u64 raw
      slippageBps?: number;
      swapMode?: 'ExactIn' | 'ExactOut';
    };

export type AgentPlan = {
  goal: string;
  summary?: string;
  actions: AgentAction[];
};

export type AgentContext = {
  walletAddress: string;
  network: string;
  notes?: string;
};
