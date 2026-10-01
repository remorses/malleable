---
title: Swap esbuild-wasm for Rollup
description: Plan, baseline latency and cache design for replacing esbuild-wasm with @rollup/browser + sucrase in the Worker bundler.
---

# Swap esbuild-wasm for Rollup

All bundler code sits behind `buildFiles()` in `src/build.ts`. `worker.ts` and `project-do.ts` only call that. The swap touches about 5 files and no callers.

## Status: done

esbuild-wasm is replaced by `@rollup/browser` + sucrase. Plugins live in `src/rollup-plugins.ts`. The wasm loader is patched (`patches/@rollup__browser.patch`) to read a precompiled module from `globalThis.__ROLLUP_WASM_MODULE__`. See https://github.com/rollup/rollup/issues/5722.

## Results (measured in Workers)

`scripts/bench-bundle.ts` for wall time. CPU time comes from `wrangler tail` (`cpuTime`), because `performance.now()` is frozen during CPU in Workers. Old version was deployed as `lovepack-esbuild-bench` for A/B.

| Scenario | Metric | esbuild | rollup + KV cache |
|---|---|---|---|
| same source repeated | CPU median | 128 ms | 11 ms |
| same source repeated | wall p50 | 310 ms | 140 ms |
| `--vary` (every run misses cache) | CPU median | 265 ms | 254 ms |
| `--vary` | wall p50 | 521 ms | 547 ms |
| `--scenario npm` (date-fns from esm.sh) | CPU median | 764 ms | 383 ms (1 sample) |
| `--scenario npm` | wall p50 | 1312 ms | 358 ms |
| cold isolate | CPU | 650-840 ms | 490-530 ms |

**Where the time goes (workerd, local):** Tailwind v3 (PostCSS, since replaced by v4 `compile()`) about 40 ms. Rollup plus sucrase about 3 ms. So the bundler is no longer the cost. Tailwind is.

Rollup alone is not faster end to end on a cache miss, because Tailwind dominates. The wins come from the cache and from dropping the esbuild wasm.

## Cache (implemented)

KV prefix `cache:v3:`, separate from `/bundle/*`. A KV error is a miss. Writes use `waitUntil`.

| Cache | Key | TTL |
|---|---|---|
| Tailwind CSS | `tw:<sha256(all source)>` | 7 d |
| esm.sh module | `esm:<url>` | 1 h |

Both also have a per-isolate memory layer. Rollup's own `bundle.cache` is not used yet.

## Next

- Tailwind is the remaining cost on a miss. Cache per class set instead of per full source, so edits that keep the same classes still hit.
- Rollup `bundle.cache` in ProjectDO memory.
