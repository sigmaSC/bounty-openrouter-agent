import type { Bounty, BountyStats } from "./types";

const DEFAULT_API_BASE = "https://bounty.owockibot.xyz";

export class BountyClient {
  private apiBase: string;

  constructor(apiBase?: string) {
    this.apiBase = apiBase || DEFAULT_API_BASE;
  }

  private async request<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const res = await fetch(`${this.apiBase}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Bounty API ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  /** Fetch all bounties */
  async listBounties(): Promise<Bounty[]> {
    const bounties = await this.request<Bounty[]>("/bounties");
    return bounties.filter((b) => b.title);
  }

  /** Fetch only open bounties */
  async listOpenBounties(): Promise<Bounty[]> {
    const bounties = await this.listBounties();
    return bounties.filter((b) => b.status === "open");
  }

  /** Fetch bounty board stats */
  async getStats(): Promise<BountyStats> {
    return this.request<BountyStats>("/stats");
  }

  /** Get a specific bounty by ID */
  async getBounty(id: string): Promise<Bounty | undefined> {
    const bounties = await this.listBounties();
    return bounties.find((b) => b.id === id);
  }

  /** Search bounties by keyword */
  async searchBounties(query: string): Promise<Bounty[]> {
    const bounties = await this.listBounties();
    const q = query.toLowerCase();
    return bounties.filter(
      (b) =>
        (b.title || "").toLowerCase().includes(q) ||
        (b.description || "").toLowerCase().includes(q)
    );
  }

  /** Filter bounties by tag */
  async filterByTag(tag: string): Promise<Bounty[]> {
    const bounties = await this.listBounties();
    const t = tag.toLowerCase();
    return bounties.filter((b) =>
      (b.tags || []).some((bt) => bt.toLowerCase() === t)
    );
  }

  /** Claim a bounty */
  async claimBounty(
    id: string,
    walletAddress: string
  ): Promise<{ status: string }> {
    return this.request<{ status: string }>(`/bounties/${id}/claim`, {
      method: "POST",
      body: JSON.stringify({ address: walletAddress }),
    });
  }

  /** Submit work for a bounty */
  async submitBounty(
    id: string,
    walletAddress: string,
    submission: string,
    proof: string
  ): Promise<{ status: string }> {
    return this.request<{ status: string }>(`/bounties/${id}/submit`, {
      method: "POST",
      body: JSON.stringify({ address: walletAddress, submission, proof }),
    });
  }
}
