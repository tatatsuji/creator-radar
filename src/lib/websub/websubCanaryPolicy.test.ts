import { describe, expect, it } from "vitest";

import {
  isChannelInWebsubCanarySelection,
  selectWebsubCanaryChannels,
  type WebsubCanaryWatchlistCandidate,
} from "@/lib/websub/websubCanaryPolicy";

function candidate(
  channelId: string,
  watchTier: WebsubCanaryWatchlistCandidate["watchTier"],
): WebsubCanaryWatchlistCandidate {
  return { channelId, watchTier };
}

describe("selectWebsubCanaryChannels", () => {
  it("returns all candidates when maxChannels is zero (unlimited)", () => {
    const result = selectWebsubCanaryChannels(
      [
        candidate("UCcold", "cold"),
        candidate("UChot", "hot"),
        candidate("UCnormal", "normal"),
      ],
      0,
    );

    expect(result.selectedChannelIds).toEqual([
      "UChot",
      "UCnormal",
      "UCcold",
    ]);
    expect(result.eligibleCount).toBe(3);
    expect(result.maxChannels).toBe(0);
    expect(result.skippedByCapCount).toBe(0);
  });

  it("prioritizes hot over active over normal over cold", () => {
    const result = selectWebsubCanaryChannels(
      [
        candidate("UCcold-1", "cold"),
        candidate("UCactive-1", "active"),
        candidate("UCnormal-1", "normal"),
        candidate("UChot-1", "hot"),
        candidate("UCcold-2", "cold"),
        candidate("UChot-2", "hot"),
      ],
      4,
    );

    expect(result.selectedChannelIds).toEqual([
      "UChot-1",
      "UChot-2",
      "UCactive-1",
      "UCnormal-1",
    ]);
    expect(result.skippedByCapCount).toBe(2);
  });

  it("sorts by channel_id ascending within the same tier", () => {
    const result = selectWebsubCanaryChannels(
      [
        candidate("UCzzz", "hot"),
        candidate("UCaaa", "hot"),
        candidate("UCmmm", "hot"),
      ],
      2,
    );

    expect(result.selectedChannelIds).toEqual(["UCaaa", "UCmmm"]);
    expect(result.skippedByCapCount).toBe(1);
  });

  it("caps selection at maxChannels", () => {
    const result = selectWebsubCanaryChannels(
      Array.from({ length: 12 }, (_, index) =>
        candidate(`UC${String(index).padStart(3, "0")}`, "normal"),
      ),
      10,
    );

    expect(result.selectedChannelIds).toHaveLength(10);
    expect(result.eligibleCount).toBe(12);
    expect(result.maxChannels).toBe(10);
    expect(result.skippedByCapCount).toBe(2);
  });

  it("returns empty selection for empty candidates", () => {
    const result = selectWebsubCanaryChannels([], 10);

    expect(result.selectedChannelIds).toEqual([]);
    expect(result.eligibleCount).toBe(0);
    expect(result.skippedByCapCount).toBe(0);
  });

  it("places unknown tiers after known tiers", () => {
    const result = selectWebsubCanaryChannels(
      [
        candidate("UCunknown", "archive"),
        candidate("UChot", "hot"),
        candidate("UClegacy", "legacy"),
      ],
      2,
    );

    expect(result.selectedChannelIds).toEqual(["UChot", "UClegacy"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      candidate("UCb", "hot"),
      candidate("UCa", "hot"),
    ];
    const snapshot = [...input];

    selectWebsubCanaryChannels(input, 1);

    expect(input).toEqual(snapshot);
  });
});

describe("isChannelInWebsubCanarySelection", () => {
  it("returns true when channel is in the selection", () => {
    const selection = selectWebsubCanaryChannels(
      [candidate("UChot", "hot"), candidate("UCcold", "cold")],
      1,
    );

    expect(isChannelInWebsubCanarySelection("UChot", selection)).toBe(true);
    expect(isChannelInWebsubCanarySelection("UCcold", selection)).toBe(false);
  });
});
