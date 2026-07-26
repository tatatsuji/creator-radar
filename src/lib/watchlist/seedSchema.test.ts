import { describe, expect, it } from "vitest";

import {
  normalizeSeedRows,
  parseSeedCsv,
  validateSeedRows,
} from "@/lib/watchlist/seedSchema";

const SAMPLE_CSV = `channel_id,name,category,source,priority,notes
UC1234567890abcdefghij,Creator One,gaming,manual_seed,10,note one
UC2345678901abcdefghij,Creator Two,music,manual_seed,5,note two
`;

describe("seed CSV schema", () => {
  it("parses valid CSV rows", () => {
    const rows = parseSeedCsv(SAMPLE_CSV);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.channelId).toBe("UC1234567890abcdefghij");
    expect(rows[0]?.priority).toBe(10);
  });

  it("validates normalized rows", () => {
    const rows = normalizeSeedRows(parseSeedCsv(SAMPLE_CSV));
    const result = validateSeedRows(rows);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("rejects invalid channel_id and empty name", () => {
    const result = validateSeedRows([
      {
        channelId: "invalid",
        name: "",
        category: "gaming",
        source: "manual_seed",
        priority: -1,
        notes: "",
      },
    ]);

    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("detects duplicate channel_id rows", () => {
    const rows = normalizeSeedRows(parseSeedCsv(SAMPLE_CSV));
    rows.push({ ...rows[0]!, notes: "dup" });
    const result = validateSeedRows(rows);
    expect(result.valid).toBe(false);
    expect(result.duplicateChannelIds).toContain("UC1234567890abcdefghij");
  });

  it("rejects malformed headers", () => {
    expect(() =>
      parseSeedCsv("id,name\nUC1234567890abcdefghij,Creator"),
    ).toThrow(/Invalid CSV header/);
  });
});
