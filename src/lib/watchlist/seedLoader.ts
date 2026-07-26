import { readFile } from "node:fs/promises";

import { upsertChannelRecord } from "@/lib/snapshots/repository";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { upsertWatchlistChannel } from "@/lib/watchlist/repository";
import {
  normalizeSeedRows,
  parseSeedCsv,
  validateSeedRows,
  type SeedChannelRow,
  type SeedValidationResult,
} from "@/lib/watchlist/seedSchema";

export interface SeedLoadOptions {
  csvPath: string;
  dryRun?: boolean;
}

export interface SeedLoadRowResult {
  channelId: string;
  name: string;
  status: "loaded" | "validated" | "skipped_duplicate" | "failed";
  message?: string;
}

export interface SeedLoadSummary {
  dryRun: boolean;
  csvPath: string;
  totalRows: number;
  validRows: number;
  loadedChannels: number;
  loadedWatchlist: number;
  skippedDuplicates: number;
  failed: number;
  validation: SeedValidationResult;
  rows: SeedLoadRowResult[];
}

function dedupeSeedRows(rows: SeedChannelRow[]): {
  uniqueRows: SeedChannelRow[];
  duplicateChannelIds: string[];
} {
  const uniqueRows: SeedChannelRow[] = [];
  const duplicateChannelIds: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (seen.has(row.channelId)) {
      duplicateChannelIds.push(row.channelId);
      continue;
    }
    seen.add(row.channelId);
    uniqueRows.push(row);
  }

  return {
    uniqueRows,
    duplicateChannelIds: [...new Set(duplicateChannelIds)],
  };
}

export async function loadSeedChannelsFromContent(
  content: string,
  options: { dryRun?: boolean; csvPath?: string } = {},
): Promise<SeedLoadSummary> {
  const dryRun = options.dryRun ?? false;
  const parsed = normalizeSeedRows(parseSeedCsv(content));
  const validation = validateSeedRows(parsed);
  const { uniqueRows, duplicateChannelIds } = dedupeSeedRows(parsed);

  const summary: SeedLoadSummary = {
    dryRun,
    csvPath: options.csvPath ?? "<inline>",
    totalRows: parsed.length,
    validRows: 0,
    loadedChannels: 0,
    loadedWatchlist: 0,
    skippedDuplicates: duplicateChannelIds.length,
    failed: 0,
    validation,
    rows: [],
  };

  if (!validation.valid) {
    return summary;
  }

  summary.validRows = uniqueRows.length;

  if (!dryRun && !isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  for (const row of parsed) {
    if (duplicateChannelIds.includes(row.channelId)) {
      summary.rows.push({
        channelId: row.channelId,
        name: row.name,
        status: "skipped_duplicate",
        message: "Duplicate channel_id in CSV",
      });
      continue;
    }

    if (dryRun) {
      summary.rows.push({
        channelId: row.channelId,
        name: row.name,
        status: "validated",
      });
      continue;
    }

    try {
      await upsertChannelRecord({
        youtubeChannelId: row.channelId,
        name: row.name,
        subscriberCountHidden: false,
      });

      await upsertWatchlistChannel({
        channelId: row.channelId,
        name: row.name,
        category: row.category,
        source: row.source,
        priority: row.priority,
        notes: row.notes,
        watchStatus: "seed",
      });

      summary.loadedChannels += 1;
      summary.loadedWatchlist += 1;
      summary.rows.push({
        channelId: row.channelId,
        name: row.name,
        status: "loaded",
      });
    } catch (error) {
      summary.failed += 1;
      summary.rows.push({
        channelId: row.channelId,
        name: row.name,
        status: "failed",
        message:
          error instanceof Error ? error.message : "Unknown seed load error",
      });
    }
  }

  return summary;
}

export async function loadSeedChannelsFromFile(
  options: SeedLoadOptions,
): Promise<SeedLoadSummary> {
  const content = await readFile(options.csvPath, "utf8");
  return loadSeedChannelsFromContent(content, {
    dryRun: options.dryRun,
    csvPath: options.csvPath,
  });
}

export function formatSeedLoadSummary(summary: SeedLoadSummary): string {
  const lines = [
    `Seed load ${summary.dryRun ? "(dry-run)" : "(apply)"}`,
    `CSV: ${summary.csvPath}`,
    `Total rows: ${summary.totalRows}`,
    `Valid rows: ${summary.validRows}`,
    `Loaded channels: ${summary.loadedChannels}`,
    `Loaded watchlist: ${summary.loadedWatchlist}`,
    `Skipped duplicates: ${summary.skippedDuplicates}`,
    `Failed: ${summary.failed}`,
  ];

  if (!summary.validation.valid) {
    lines.push("Validation issues:");
    for (const issue of summary.validation.issues) {
      lines.push(`  line ${issue.line} ${issue.field}: ${issue.message}`);
    }
    for (const channelId of summary.validation.duplicateChannelIds) {
      lines.push(`  duplicate channel_id: ${channelId}`);
    }
  }

  if (summary.failed > 0) {
    lines.push("Failed rows:");
    for (const row of summary.rows.filter((entry) => entry.status === "failed")) {
      lines.push(`  ${row.channelId}: ${row.message ?? "unknown error"}`);
    }
  }

  return lines.join("\n");
}
