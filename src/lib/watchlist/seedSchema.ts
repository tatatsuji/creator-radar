export const SEED_CSV_COLUMNS = [
  "channel_id",
  "name",
  "category",
  "source",
  "priority",
  "notes",
] as const;

export type SeedCsvColumn = (typeof SEED_CSV_COLUMNS)[number];

const YOUTUBE_CHANNEL_ID_PATTERN = /^UC[\w-]{10,}$/;

export interface SeedChannelRow {
  channelId: string;
  name: string;
  category: string;
  source: string;
  priority: number;
  notes: string;
}

export interface SeedValidationIssue {
  line: number;
  field: string;
  message: string;
}

export interface SeedValidationResult {
  valid: boolean;
  rows: SeedChannelRow[];
  issues: SeedValidationIssue[];
  duplicateChannelIds: string[];
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

export function parseSeedCsv(content: string): SeedChannelRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  if (lines.length === 0) {
    return [];
  }

  const header = parseCsvLine(lines[0]).map((value) => value.toLowerCase());
  const expectedHeader = [...SEED_CSV_COLUMNS];

  if (header.length !== expectedHeader.length) {
    throw new Error(
      `Invalid CSV header. Expected ${expectedHeader.join(",")}`,
    );
  }

  for (let index = 0; index < expectedHeader.length; index += 1) {
    if (header[index] !== expectedHeader[index]) {
      throw new Error(
        `Invalid CSV header at column ${index + 1}. Expected ${expectedHeader[index]}`,
      );
    }
  }

  const rows: SeedChannelRow[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const values = parseCsvLine(lines[lineIndex]);
    if (values.length !== expectedHeader.length) {
      throw new Error(`Invalid column count at CSV line ${lineIndex + 1}`);
    }

    rows.push({
      channelId: values[0],
      name: values[1],
      category: values[2],
      source: values[3],
      priority: Number.parseInt(values[4] || "0", 10),
      notes: values[5] ?? "",
    });
  }

  return rows;
}

export function validateSeedRows(rows: SeedChannelRow[]): SeedValidationResult {
  const issues: SeedValidationIssue[] = [];
  const seen = new Map<string, number>();
  const duplicateChannelIds: string[] = [];

  rows.forEach((row, index) => {
    const line = index + 2;

    if (!row.channelId.trim()) {
      issues.push({
        line,
        field: "channel_id",
        message: "channel_id must not be empty",
      });
    } else if (!YOUTUBE_CHANNEL_ID_PATTERN.test(row.channelId.trim())) {
      issues.push({
        line,
        field: "channel_id",
        message: "channel_id format is invalid",
      });
    }

    if (!row.name.trim()) {
      issues.push({ line, field: "name", message: "name must not be empty" });
    }

    if (!row.source.trim()) {
      issues.push({ line, field: "source", message: "source must not be empty" });
    }

    if (!Number.isFinite(row.priority) || row.priority < 0) {
      issues.push({
        line,
        field: "priority",
        message: "priority must be a non-negative integer",
      });
    }

    const normalizedChannelId = row.channelId.trim();
    if (normalizedChannelId) {
      if (seen.has(normalizedChannelId)) {
        duplicateChannelIds.push(normalizedChannelId);
      } else {
        seen.set(normalizedChannelId, line);
      }
    }
  });

  return {
    valid: issues.length === 0 && duplicateChannelIds.length === 0,
    rows,
    issues,
    duplicateChannelIds: [...new Set(duplicateChannelIds)],
  };
}

export function normalizeSeedRows(rows: SeedChannelRow[]): SeedChannelRow[] {
  return rows.map((row) => ({
    channelId: row.channelId.trim(),
    name: row.name.trim(),
    category: row.category.trim(),
    source: row.source.trim(),
    priority: row.priority,
    notes: row.notes.trim(),
  }));
}
