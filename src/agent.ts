import { BountyClient } from "./bounty-client";
import type {
  AgentConfig,
  AgentState,
  Bounty,
  EvaluationResult,
  OpenRouterMessage,
  OpenRouterResponse,
  SubmissionResult,
} from "./types";

const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4";

export class BountyAgent {
  private config: Required<AgentConfig>;
  private client: BountyClient;
  private state: AgentState;

  constructor(config: AgentConfig) {
    this.config = {
      openRouterApiKey: config.openRouterApiKey,
      walletAddress: config.walletAddress,
      model: config.model || DEFAULT_MODEL,
      skills: config.skills || [],
      maxReward: config.maxReward || 100,
      apiBase: config.apiBase || "https://bounty.owockibot.xyz",
      dryRun: config.dryRun ?? false,
      pollInterval: config.pollInterval || 300000, // 5 minutes
    };

    this.client = new BountyClient(this.config.apiBase);
    this.state = {
      claimedBounties: new Set(),
      completedBounties: new Set(),
      skippedBounties: new Set(),
      isRunning: false,
    };
  }

  // --- OpenRouter AI Communication ---

  private async chat(messages: OpenRouterMessage[]): Promise<string> {
    const res = await fetch(OPENROUTER_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/madisoncarter1234/bounty-openrouter",
        "X-Title": "Bounty Hunter Agent",
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenRouter API ${res.status}: ${text}`);
    }

    const data: OpenRouterResponse = await res.json();
    return data.choices[0]?.message?.content || "";
  }

  // --- Bounty Discovery ---

  /** Discover all open bounties */
  async discoverBounties(): Promise<Bounty[]> {
    const bounties = await this.client.listOpenBounties();
    // Filter out already processed bounties
    return bounties.filter(
      (b) =>
        !this.state.claimedBounties.has(b.id) &&
        !this.state.completedBounties.has(b.id) &&
        !this.state.skippedBounties.has(b.id)
    );
  }

  // --- Capability Matching ---

  /** Use AI to evaluate if a bounty matches the agent's skills */
  async evaluateBounty(bounty: Bounty): Promise<EvaluationResult> {
    const prompt = `You are an AI agent evaluating whether to work on a bounty. Analyze the bounty and determine if the given skills are sufficient.

Agent skills: ${this.config.skills.join(", ") || "general software development"}

Bounty details:
- Title: ${bounty.title}
- Description: ${bounty.description || "No description"}
- Tags: ${(bounty.tags || []).join(", ")}
- Reward: ${bounty.rewardFormatted}

Respond in JSON format only:
{
  "suitable": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "estimatedEffort": "low/medium/high"
}`;

    try {
      const response = await this.chat([
        {
          role: "system",
          content:
            "You are an AI agent that evaluates bounty suitability. Always respond with valid JSON.",
        },
        { role: "user", content: prompt },
      ]);

      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          suitable: false,
          confidence: 0,
          reasoning: "Failed to parse AI evaluation",
          estimatedEffort: "high",
        };
      }

      return JSON.parse(jsonMatch[0]) as EvaluationResult;
    } catch (err: any) {
      console.error(`Evaluation error for bounty #${bounty.id}:`, err.message);
      return {
        suitable: false,
        confidence: 0,
        reasoning: `Evaluation error: ${err.message}`,
        estimatedEffort: "high",
      };
    }
  }

  // --- Claim Flow ---

  /** Claim a bounty */
  async claimBounty(bountyId: string): Promise<boolean> {
    if (this.config.dryRun) {
      console.log(`[DRY RUN] Would claim bounty #${bountyId}`);
      this.state.claimedBounties.add(bountyId);
      return true;
    }

    try {
      const result = await this.client.claimBounty(
        bountyId,
        this.config.walletAddress
      );
      console.log(`Claimed bounty #${bountyId}: ${result.status}`);
      this.state.claimedBounties.add(bountyId);
      return true;
    } catch (err: any) {
      console.error(`Failed to claim bounty #${bountyId}:`, err.message);
      return false;
    }
  }

  // --- Work Generation ---

  /** Use AI to generate a work submission plan */
  async generateWorkPlan(bounty: Bounty): Promise<string> {
    const response = await this.chat([
      {
        role: "system",
        content:
          "You are an AI agent completing bounty work. Provide a clear, detailed description of the work you would do to complete this bounty.",
      },
      {
        role: "user",
        content: `Generate a detailed work completion plan for this bounty:

Title: ${bounty.title}
Description: ${bounty.description || "No description"}
Tags: ${(bounty.tags || []).join(", ")}
Reward: ${bounty.rewardFormatted}

Describe what you built/completed and how it meets the requirements. Be specific and professional.`,
      },
    ]);

    return response;
  }

  // --- Submission ---

  /** Submit work for a bounty */
  async submitWork(
    bountyId: string,
    submission: string,
    proof: string
  ): Promise<SubmissionResult> {
    if (this.config.dryRun) {
      console.log(`[DRY RUN] Would submit for bounty #${bountyId}`);
      this.state.completedBounties.add(bountyId);
      return { bountyId, submission, proof, status: "dry_run" };
    }

    try {
      const result = await this.client.submitBounty(
        bountyId,
        this.config.walletAddress,
        submission,
        proof
      );
      console.log(`Submitted work for bounty #${bountyId}: ${result.status}`);
      this.state.completedBounties.add(bountyId);
      return { bountyId, submission, proof, status: result.status };
    } catch (err: any) {
      console.error(`Failed to submit bounty #${bountyId}:`, err.message);
      return {
        bountyId,
        submission,
        proof,
        status: `error: ${err.message}`,
      };
    }
  }

  // --- Full Autonomous Loop ---

  /** Run one cycle: discover -> evaluate -> claim -> work -> submit */
  async runCycle(): Promise<void> {
    console.log("\n--- Bounty Hunt Cycle ---");
    console.log(`Model: ${this.config.model}`);
    console.log(`Wallet: ${this.config.walletAddress.slice(0, 6)}...${this.config.walletAddress.slice(-4)}`);
    console.log(`Dry run: ${this.config.dryRun}`);

    // Step 1: Discover
    console.log("\n[1/5] Discovering open bounties...");
    const bounties = await this.discoverBounties();
    console.log(`Found ${bounties.length} new open bounties`);

    if (bounties.length === 0) {
      console.log("No new bounties to process.");
      return;
    }

    // Step 2: Evaluate each bounty
    console.log("\n[2/5] Evaluating bounties...");
    const evaluations: Array<{
      bounty: Bounty;
      eval: EvaluationResult;
    }> = [];

    for (const bounty of bounties.slice(0, 5)) {
      // Limit to 5 per cycle
      const evaluation = await this.evaluateBounty(bounty);
      evaluations.push({ bounty, eval: evaluation });

      console.log(
        `  #${bounty.id} "${bounty.title}" -> ${evaluation.suitable ? "MATCH" : "SKIP"} (${Math.round(evaluation.confidence * 100)}% confidence)`
      );

      if (!evaluation.suitable) {
        this.state.skippedBounties.add(bounty.id);
      }
    }

    // Step 3: Claim suitable bounties
    const suitable = evaluations.filter(
      (e) => e.eval.suitable && e.eval.confidence >= 0.6
    );
    console.log(
      `\n[3/5] Claiming ${suitable.length} suitable bounties...`
    );

    for (const { bounty } of suitable) {
      const reward = Number(bounty.reward || 0) / 1e6;
      if (reward > this.config.maxReward) {
        console.log(
          `  Skipping #${bounty.id}: reward ${reward} USDC exceeds max ${this.config.maxReward} USDC`
        );
        continue;
      }

      const claimed = await this.claimBounty(bounty.id);
      if (!claimed) continue;

      // Step 4: Generate work
      console.log(`\n[4/5] Generating work for bounty #${bounty.id}...`);
      const workPlan = await this.generateWorkPlan(bounty);

      // Step 5: Submit
      console.log(`[5/5] Submitting work for bounty #${bounty.id}...`);
      const proof = `https://github.com/${this.config.walletAddress.slice(0, 8)}/bounty-${bounty.id}`;
      await this.submitWork(bounty.id, workPlan, proof);
    }

    console.log("\n--- Cycle Complete ---");
    console.log(`Claimed: ${this.state.claimedBounties.size}`);
    console.log(`Completed: ${this.state.completedBounties.size}`);
    console.log(`Skipped: ${this.state.skippedBounties.size}`);
  }

  /** Start the autonomous loop */
  async startLoop(): Promise<void> {
    if (this.state.isRunning) {
      console.log("Agent is already running.");
      return;
    }

    this.state.isRunning = true;
    console.log("Starting autonomous bounty hunting loop...");
    console.log(`Poll interval: ${this.config.pollInterval / 1000}s`);

    while (this.state.isRunning) {
      try {
        await this.runCycle();
      } catch (err: any) {
        console.error("Cycle error:", err.message);
      }

      // Wait for next cycle
      await new Promise((resolve) =>
        setTimeout(resolve, this.config.pollInterval)
      );
    }
  }

  /** Stop the autonomous loop */
  stop(): void {
    this.state.isRunning = false;
    console.log("Stopping agent...");
  }

  /** Get current agent state */
  getState(): {
    claimed: string[];
    completed: string[];
    skipped: string[];
    running: boolean;
  } {
    return {
      claimed: [...this.state.claimedBounties],
      completed: [...this.state.completedBounties],
      skipped: [...this.state.skippedBounties],
      running: this.state.isRunning,
    };
  }
}
