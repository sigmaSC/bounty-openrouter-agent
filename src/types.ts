export interface Bounty {
  id: string;
  title: string;
  description: string;
  status: string;
  reward: string;
  rewardFormatted: string;
  tags: string[];
  claimedBy?: string;
  createdAt?: string;
  completedAt?: string;
  payment?: {
    grossAmount?: string;
    grossReward?: string;
  };
}

export interface BountyStats {
  totalBounties: number;
  openBounties: number;
  completedBounties: number;
  totalRewardsUSDC: string;
}

export interface AgentConfig {
  /** OpenRouter API key */
  openRouterApiKey: string;
  /** Wallet address for claiming/submitting bounties */
  walletAddress: string;
  /** OpenRouter model to use (default: anthropic/claude-sonnet-4) */
  model?: string;
  /** Agent skills/capabilities for matching */
  skills?: string[];
  /** Maximum bounty reward to auto-claim (safety limit, in USDC) */
  maxReward?: number;
  /** Bounty Board API base URL */
  apiBase?: string;
  /** Whether to actually claim/submit or just simulate */
  dryRun?: boolean;
  /** Polling interval in ms for the autonomous loop */
  pollInterval?: number;
}

export interface EvaluationResult {
  suitable: boolean;
  confidence: number;
  reasoning: string;
  estimatedEffort: string;
}

export interface SubmissionResult {
  bountyId: string;
  submission: string;
  proof: string;
  status: string;
}

export interface AgentState {
  claimedBounties: Set<string>;
  completedBounties: Set<string>;
  skippedBounties: Set<string>;
  isRunning: boolean;
}

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}
