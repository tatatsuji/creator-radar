#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const env: Record<string, string> = {};
for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split(/\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  env[t.slice(0, i)] = t.slice(i + 1);
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

const { data: runs } = await sb
  .from("discovery_runs")
  .select("*")
  .gte("started_at", since)
  .order("started_at", { ascending: false })
  .limit(10);

const { data: sources } = await sb
  .from("candidate_discoveries")
  .select("source_type")
  .gte("discovered_at", since);

const counts: Record<string, number> = {};
for (const row of sources ?? []) {
  counts[row.source_type as string] = (counts[row.source_type] ?? 0) + 1;
}

const { count: videoCount } = await sb
  .from("videos")
  .select("*", { count: "exact", head: true })
  .eq("is_active", true);

console.log(JSON.stringify({ runs, sourceCounts6h: counts, activeVideos: videoCount }, null, 2));
