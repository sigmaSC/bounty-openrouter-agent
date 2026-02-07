export { BountyAgent } from "./agent";
export { BountyClient } from "./bounty-client";
export type {
  AgentConfig,
  AgentState,
  Bounty,
  BountyStats,
  EvaluationResult,
  SubmissionResult,
} from "./types";

// --- CLI Entry Point ---

async function main() {
  const { BountyAgent } = await import("./agent");

  const apiKey = process.env.OPENROUTER_API_KEY;
  const wallet = process.env.WALLET_ADDRESS;

  if (!apiKey || !wallet) {
    console.error("Required environment variables:");
    console.error("  OPENROUTER_API_KEY - Your OpenRouter API key");
    console.error("  WALLET_ADDRESS     - Your wallet address");
    console.error("\nOptional:");
    console.error("  MODEL              - OpenRouter model (default: anthropic/claude-sonnet-4)");
    console.error("  DRY_RUN            - Set to 'true' for simulation mode");
    console.error("  MAX_REWARD         - Max bounty reward in USDC (default: 100)");
    console.error("  POLL_INTERVAL      - Loop interval in seconds (default: 300)");
    console.error("  SKILLS             - Comma-separated skills list");
    process.exit(1);
  }

  const skills = process.env.SKILLS
    ? process.env.SKILLS.split(",").map((s) => s.trim())
    : ["typescript", "javascript", "web development", "api integration"];

  const agent = new BountyAgent({
    openRouterApiKey: apiKey,
    walletAddress: wallet,
    model: process.env.MODEL || "anthropic/claude-sonnet-4",
    skills,
    maxReward: Number(process.env.MAX_REWARD) || 100,
    dryRun: process.env.DRY_RUN === "true",
    pollInterval: (Number(process.env.POLL_INTERVAL) || 300) * 1000,
  });

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nReceived SIGINT, stopping...");
    agent.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\nReceived SIGTERM, stopping...");
    agent.stop();
    process.exit(0);
  });

  const mode = process.argv[2] || "loop";

  switch (mode) {
    case "once":
      // Run a single cycle
      console.log("Running single bounty hunt cycle...");
      await agent.runCycle();
      break;

    case "discover":
      // Just discover and evaluate bounties
      console.log("Discovering bounties...");
      const { BountyClient } = await import("./bounty-client");
      const client = new BountyClient();
      const bounties = await client.listOpenBounties();
      console.log(`\nFound ${bounties.length} open bounties:\n`);
      for (const b of bounties) {
        console.log(`  #${b.id} [${b.rewardFormatted}] ${b.title}`);
        console.log(`    Tags: ${(b.tags || []).join(", ")}`);
      }
      break;

    case "loop":
    default:
      // Start the autonomous loop
      await agent.startLoop();
      break;
  }
}

// Run if executed directly
const isMain =
  typeof Bun !== "undefined"
    ? Bun.main === import.meta.path
    : process.argv[1]?.includes("index");

if (isMain) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
