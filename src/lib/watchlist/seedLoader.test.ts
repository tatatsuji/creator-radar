import { describe, expect, it } from "vitest";

import {
  loadSeedChannelsFromContent,
} from "@/lib/watchlist/seedLoader";

const SAMPLE_CSV = `channel_id,name,category,source,priority,notes
UC1234567890abcdefghij,Creator One,gaming,manual_seed,10,note one
UC2345678901abcdefghij,Creator Two,music,manual_seed,5,note two
`;

describe("seed loader", () => {
  it("supports dry-run without Supabase", async () => {
    const summary = await loadSeedChannelsFromContent(SAMPLE_CSV, {
      dryRun: true,
      csvPath: "sample.csv",
    });

    expect(summary.dryRun).toBe(true);
    expect(summary.validRows).toBe(2);
    expect(summary.loadedChannels).toBe(0);
    expect(summary.rows.every((row) => row.status === "validated")).toBe(true);
  });

  it("reports duplicate rows separately in dry-run", async () => {
    const duplicateCsv = `${SAMPLE_CSV}UC1234567890abcdefghij,Creator One Duplicate,gaming,manual_seed,1,dup\n`;
    const summary = await loadSeedChannelsFromContent(duplicateCsv, {
      dryRun: true,
    });

    expect(summary.validation.valid).toBe(false);
    expect(summary.validation.duplicateChannelIds.length).toBeGreaterThan(0);
  });
});
