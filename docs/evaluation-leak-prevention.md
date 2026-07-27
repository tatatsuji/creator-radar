# Evaluation Leak Prevention

Discovery Recall must reflect real production discovery capability, not artifacts of shared evaluation infrastructure.

## Separation Requirements

| Layer | Ground Truth (evaluation) | Production Discovery |
|-------|---------------------------|----------------------|
| Fetch module | `recallGroundTruthFetch.ts` | `candidateFetch.ts` |
| Orchestration | `discoveryRecallGroundTruth.ts` | `candidateDiscoveryEngine.ts` |
| Output | `.validation/*.json` (read-only audit) | Supabase `candidate_discoveries` |
| DB input | Never reads Creator Radar DB for GT | Reads DB for db_remeasure only |

## Verified Protections

1. **Code path separation** — Ground truth uses `evalSearchVideos` / `evalFetchMostPopular`; discovery uses `searchVideoItems` / `fetchMostPopularVideoItems`. Same low-level `youtubeFetch` client is acceptable (different calls, different times).

2. **No DB → GT feedback** — Ground truth generation never queries `candidate_discoveries` or `videos`.

3. **No GT → discovery feedback** — `.validation/` JSON files are never loaded by cron or registration code.

4. **No shared in-memory cache** — API responses are not cached between GT build and discovery runs.

5. **Fresh GT per measurement** — Re-measurement always rebuilds ground truth (`npm run recall:run`), never optimizes against a fixed historical GT set.

6. **Independent scoring** — GT uses external buzzScore; discovery registration does not use GT scores.

## Residual Risks

- **Same API key / quota pool** — GT build consumes YouTube quota from the same project. Budget separately (see `quotaBudget.ts`).
- **Temporal correlation** — Running GT immediately after discovery may show temporarily high recall. Report includes `groundTruthGeneratedAt` vs `measuredAt` for audit.
- **mostPopular overlap** — Both systems query JP mostPopular, but with different schedules and limits. This is intentional production overlap, not leak.

## Audit Checklist

Before claiming Recall improvement:

- [ ] GT rebuilt after deploy (`recall:build-ground-truth`)
- [ ] At least one discovery cron executed post-deploy
- [ ] GT and measure timestamps documented
- [ ] No code imports `.validation/` from production paths
