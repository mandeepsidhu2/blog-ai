---
title: Budget LLM Retries Against Correlated Failures
description: Reproduce a controlled retry study showing why jitter improves latency but a shared budget is needed to bound incident load.
topic: AI Reliability Engineering
level: Advanced
date: 2026-07-19
readingTime: 25
tags: llm-reliability, retries, backoff, capacity-planning, incident-response
image: /content/v1/assets/correlated-retry-amplification.svg
imageAlt: Two-panel measured chart comparing request completion and peak attempted calls for five retry policies during correlated failures
evidenceMode: experiment
qualityTier: deep-research
evidenceProject: operator/diy-project-blogs/projects/correlated-retry-amplification
evidenceManifest: operator/diy-project-blogs/projects/correlated-retry-amplification/evidence-manifest.json
---

An LLM request that fails once is often worth retrying. That local fact can produce a global incident: thousands of clients observe the same degraded provider, each creates extra attempts, and the recovery path receives its largest load exactly when it has the least spare capacity.

We tested five client policies in a controlled stochastic simulator: no retry, immediate retry up to three attempts, exponential backoff without jitter, exponential backoff with full jitter, and full jitter governed by a shared retry-token budget. Every policy saw the same original arrivals and exogenous fault trace within each repeat. The main design crossed two offered loads with independent or Markov-bursty faults over 200 repeats per cell, then added an 80-repeat no-fault control.

The result is a capacity trade-off, not a slogan. At 85 original requests per second against 100 modeled attempt slots per second, unbudgeted full-jitter retries increased completion from 89.74% to 96.91%. They also raised attempts per original request from 1.000 to 1.208 and the mean maximum rolling one-second load from 117.6 to 263.2 attempts per second. A shared budget reduced the peak to 134.0 and capacity-overflow failures by 2,336 per five-minute trace, but completion fell to 94.47%.

Jitter was not a capacity limit. Compared with deterministic exponential backoff, full jitter reduced successful-request p95 latency from 0.520 to 0.306 seconds but increased the peak by 14.3 attempts per second. In this model, spreading retries over each backoff window moved successes earlier while allowing more attempts to collide with short fault bursts. The appropriate conclusion is not “avoid jitter.” It is that timing randomization and total retry demand solve different problems.

## Finding and decision summary

- At the 85-request/s focal load, full jitter improved original-request completion by 7.17 percentage points versus no retry, with paired bootstrap 95% interval [7.12, 7.21].
- That gain cost 0.208 additional attempts per request [0.203, 0.214] and 145.7 more peak attempts/s [142.9, 148.3].
- Budgeted full jitter cut the peak by 129.2 attempts/s [-131.9, -126.4] and capacity-overflow failures by 2,336 [-2,456, -2,217] versus unbudgeted full jitter.
- The budget also reduced completion by 2.44 points [-2.49, -2.39]. A retry budget is deliberate load shedding, not free resilience.
- Full jitter reduced p95 latency by 0.214 seconds versus no-jitter backoff, yet its peak was 14.3 attempts/s higher. Jitter did not bound aggregate incident demand.
- With the same 3.57% stationary exogenous failure probability, full jitter peaked at 263.2 attempts/s under correlated faults versus 174.0 under independent faults, while completion fell from 99.35% to 96.91%. Mean error rate alone missed the incident demand shape.
- At 60 requests/s, every unbudgeted retry policy completed at least 97.36% under correlated faults, but peak attempts ranged from 171.2 to 195.7/s; headroom changed the completion effect more than the amplification mechanism.
- In the no-exogenous-fault control at 85 requests/s, full jitter still raised the peak from 117.7 to 162.4 attempts/s because fine-grained Poisson bursts can overflow a fixed 100 ms service slot. That exposes the simulator's queue-free capacity boundary.

The engineering decision is to separate three controls: retry eligibility, retry timing, and retry volume. Use status-aware eligibility and idempotency first, jitter to reduce synchronization, then a workload-wide budget to cap the total incident load. The tested 8 retries/s setting is not a deployable default: sweep a disabled budget, the current attempt rate, and at least two stricter rates against an explicit completion-versus-load objective before selecting a canary.

## Research question, hypothesis, and claim ladder

The confirmatory hypothesis was directional and falsifiable: under correlated faults at 85 original requests/s, three-attempt full-jitter retries would more than double peak attempted load versus no retry; adding a shared retry budget would reduce that peak by at least 40% while retaining higher completion than no retry.

Both thresholds were supported. Full jitter produced a 2.24× peak relative to no retry. The shared budget cut that peak 49.1% and retained a 4.73-point completion advantage over no retry. The study did not preregister an optimal token refill rate, so 8 retries/s is one tested treatment rather than a recommendation.

The claim ladder is deliberately narrow:

1. **Direct measurement:** completion, attempt amplification, successful-request latency, rolling peak attempts, capacity overflow, and budget denials in the saved traces.
2. **Mechanism supported by controls:** correlated faults concentrate retry timing; retry ceilings do not impose a workload-wide ceiling; shared tokens bound aggregate demand by sacrificing some recoverable requests.
3. **Operational implication:** retry dashboards should report original requests and attempts separately, and canaries should sweep retry-budget rates against completion and recovery load.
4. **Not established:** no provider-specific quota, safe retry count, universal backoff base, production success rate, or non-idempotent retry policy is claimed.

[Amazon's retry guidance](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/) describes retries as self-interested load and notes that a five-deep stack with three attempts at each layer can amplify database work 243-fold. The [Google SRE treatment of cascading failure](https://sre.google/sre-book/addressing-cascading-failures/) likewise frames overload as a feedback loop. Our study isolates a one-layer client population; it does not model multiplicative retry layers.

## Methodology

### Arrival, service, and deadline model

Original requests arrive as a Poisson process for five minutes at either 60 or 85 requests per second. Time advances in 100 ms ticks. The dependency can process ten attempted calls per tick, equivalent to 100 attempts/s. Attempts beyond that instantaneous capacity fail as overload. There is no server queue: this is a deliberately sharp capacity model for studying synchronized demand.

Every original request has a 20-second deadline and at most three attempts. A successful attempt completes immediately at the tick boundary. Latency therefore measures retry delay, not generation time. We do not simulate token lengths, streaming, prompt caching, provider-side batching, or partial responses. Those omissions prevent the numeric latencies from being transported to an LLM API.

```python
for tick in range(total_ticks):
    retry_tokens = min(token_capacity, retry_tokens + refill_per_tick)
    if tick < active_ticks:
        for _ in range(poisson(arrivals_rng, load * tick_seconds)):
            requests[next_id] = {
                "arrival": tick,
                "success": None,
                "attempts": 0,
            }
            scheduled[tick].append((next_id, 1))
            next_id += 1

    attempts = scheduled.pop(tick, [])
    policy_rng.shuffle(attempts)
    for position, (request_id, attempt) in enumerate(attempts):
        failed = position >= capacity_per_tick
        if not failed and policy_rng.random() < fault_trace[tick]:
            failed = True
        if not failed:
            requests[request_id]["success"] = tick
```

This slot-based service is harsher than a real queue that can absorb microbursts. It is useful because it makes one failure mode observable: even below mean capacity, a burst can overflow a tick. Production replay should substitute measured queueing, quotas, and service-time distributions.

### Matched independent and correlated faults

The correlated process alternates between good and bad states. Each 100 ms good tick enters the bad state with probability 0.0025; each bad tick recovers with probability 0.05. A bad state fails 75% of capacity-admitted attempts. Its stationary bad-state fraction is 0.0025 / (0.0025 + 0.05) = 4.76%, giving a stationary attempt-failure probability of 3.57% before overload.

The independent control uses a 3.5714% failure probability on every capacity-admitted attempt. This matches the correlated process's stationary mean while removing temporal dependence. An earlier screen incorrectly used 10%; we detected the mismatch, corrected the configuration, and regenerated every cited artifact. The saved manifest and results contain only the corrected design.

Matching the mean did not match the outcome. At 85 original requests/s, full jitter produced similar attempt amplification under independent and correlated faults, 1.198 versus 1.208, but the correlated peak was 51.3% higher, 263.2 versus 174.0 attempts/s. Completion was 2.44 points lower. The temporal arrangement of failures changed capacity risk even when average exogenous failure probability did not.

```python
def build_fault_trace(shape, ticks, seed):
    rng = random.Random(seed)
    if shape == "independent":
        return [0.0357142857] * ticks

    bad = False
    trace = []
    for _ in range(ticks):
        if bad and rng.random() < 0.05:
            bad = False
        elif not bad and rng.random() < 0.0025:
            bad = True
        trace.append(0.75 if bad else 0.0)
    return trace
```

Policies within a repeat share original arrivals and the exogenous fault-probability trace. Retry timing uses a policy-specific random stream, because jitter necessarily changes attempt times. The pairing therefore removes variation in the incident and incoming demand, not variation caused by the treatment itself.

### Retry treatments

No retry is the availability and load baseline. Immediate retry waits one tick. Exponential backoff waits 0.5 seconds after the first failure and 1.0 second after the second. Full jitter samples uniformly between zero and the corresponding exponential ceiling, with a minimum one-tick delay.

Budgeted full jitter shares a token bucket across the simulated client population. It refills at 8 retry tokens/s with capacity 16. An original attempt never consumes a token. When no retry token is available, the failed request is not rescheduled.

```python
if policy == "no_retry" or attempt >= 3:
    continue

if policy == "budgeted_full_jitter":
    if retry_tokens < 1:
        retries_denied += 1
        continue
    retry_tokens -= 1

base_ticks = 5 * (2 ** (attempt - 1))
if policy == "exponential_no_jitter":
    delay_ticks = base_ticks
else:
    delay_ticks = max(1, int(rng.uniform(0, base_ticks)))

retry_tick = tick + delay_ticks
if retry_tick - request["arrival"] <= deadline_ticks:
    scheduled[retry_tick].append((request_id, attempt + 1))
```

The bucket is global inside one simulated workload. A per-process bucket would not bound a fleet unless token rates were partitioned by replica or coordinated. The tested 8 retries/s equals 8% of nominal provider capacity and 9.4% of the focal original load; neither percentage is asserted as optimal.

Only one nonzero bucket rate was tested. That is the largest unresolved design ablation. A confirmatory study should sweep refill rate and burst capacity separately, then freeze a Pareto choice before unseen incident traces. The present evidence establishes that a shared ceiling changes the load-completion frontier, not where a production system should operate on it.

## Baselines, controls, and ablations

The no-retry baseline identifies success available without additional demand. Deterministic exponential backoff separates timing randomization from the three-attempt ceiling. Independent faults test whether equal mean failure with different temporal dependence changes the trade-off. The 60-request/s cell supplies headroom. The no-fault cell tests whether retry behavior can amplify ordinary microbursts even without an incident.

That negative control matters. At 85 requests/s with no exogenous faults, no retry completed 93.12%; full jitter completed 99.77% but raised average peak attempts by 44.7/s [43.1, 46.4]. The slot model makes overload retryable, so a retry can recover from one crowded 100 ms interval. It also shows that “no provider fault” is not “no capacity failure.” A queued provider would behave differently.

The main negative result concerns jitter. Full jitter is commonly recommended to prevent clients from retrying in lockstep. It did lower p95 retry latency in our correlated cell, but the mean peak was 263.2/s versus 248.9/s for deterministic backoff. The two-attempt delay windows were short relative to fault bursts, so randomized early retries could pile into the same degraded period. Jitter is still appropriate for desynchronization; the result rejects treating it as a fleet-wide demand cap.

## Results

All rows below come from the saved aggregate artifact. Values are means across 200 matched repeats except the no-fault control, which uses 80. Success is measured over original requests; peak is the maximum rolling one-second attempted load.

The retry-policy vocabulary and production caveat are grounded in [AWS's primary retry and jitter guidance](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/); every number in the table is from the controlled run described here.

| Fault shape and load | Policy | Completion | Attempts / request | Successful p95 latency | Peak attempts/s |
|---|---|---:|---:|---:|---:|
| correlated, 85/s | no retry | 89.74% | 1.000 | 0.000 s | 117.6 |
| correlated, 85/s | immediate ×3 | 96.05% | 1.223 | 0.100 s | 277.1 |
| correlated, 85/s | exponential, no jitter | 97.03% | 1.229 | 0.520 s | 248.9 |
| correlated, 85/s | exponential, full jitter | 96.91% | 1.208 | 0.306 s | 263.2 |
| correlated, 85/s | budgeted full jitter | 94.47% | 1.086 | 0.117 s | 134.0 |
| independent, 85/s | exponential, full jitter | 99.35% | 1.198 | 0.332 s | 174.0 |
| independent, 85/s | budgeted full jitter | 95.20% | 1.094 | 0.200 s | 130.9 |
| correlated, 60/s | exponential, full jitter | 97.88% | 1.087 | 0.008 s | 183.6 |
| correlated, 60/s | budgeted full jitter | 96.68% | 1.025 | 0.000 s | 97.7 |

The comparison limit is strict: independent and correlated rows match exogenous failure probability in expectation, but overload makes realized attempt populations policy-dependent. This is a coupled system, not a simple Bernoulli calculation. Do not compare the table with a provider SLA or interpret a simulated completion percentage as availability.

```output
Focal cell: 85 requests/s, correlated failures, 200 matched repeats
no_retry: success=0.8974 attempts/request=1.000 peak=117.6/s
immediate_three: success=0.9605 attempts/request=1.223 peak=277.1/s
exponential_no_jitter: success=0.9703 attempts/request=1.229 peak=248.9/s
exponential_full_jitter: success=0.9691 attempts/request=1.208 peak=263.2/s
budgeted_full_jitter: success=0.9447 attempts/request=1.086 peak=134.0/s
budgeted_vs_full_jitter overload_failures_delta=-2336.4
rows=4800 aggregate_cells=30
```

## Statistical analysis and uncertainty

We computed paired mean deltas at the repeat level and resampled the 200 paired repeats 5,000 times with seed 20260719. The intervals quantify Monte Carlo variation under the declared generator. They do not cover uncertainty about the provider, arrival process, timeout semantics, or correlation model.

```python
def paired_bootstrap(policy_a, policy_b, metric, repeats=200):
    deltas = []
    for repeat in range(repeats):
        a = result_index[(85, "correlated", policy_a, repeat)]
        b = result_index[(85, "correlated", policy_b, repeat)]
        deltas.append(float(a[metric]) - float(b[metric]))

    bootstrap_means = []
    for _ in range(5_000):
        sample = [
            deltas[bootstrap_rng.randrange(repeats)]
            for _ in range(repeats)
        ]
        bootstrap_means.append(statistics.fmean(sample))

    bootstrap_means.sort()
    return {
        "mean_delta": statistics.fmean(deltas),
        "ci95": [bootstrap_means[124], bootstrap_means[4_874]],
        "wins": sum(delta > 0 for delta in deltas),
        "ties": sum(delta == 0 for delta in deltas),
        "repeats": repeats,
    }
```

| Correlated 85/s contrast | Mean paired delta | Paired bootstrap 95% interval |
|---|---:|---:|
| full jitter − no retry, completion | +0.0717 | [+0.0712, +0.0721] |
| full jitter − no retry, attempts/request | +0.2081 | [+0.2027, +0.2137] |
| full jitter − no retry, peak attempts/s | +145.7 | [+142.9, +148.3] |
| budgeted − full jitter, completion | −0.0244 | [−0.0249, −0.0239] |
| budgeted − full jitter, peak attempts/s | −129.2 | [−131.9, −126.4] |
| budgeted − full jitter, overload failures | −2,336 | [−2,456, −2,217] |
| full jitter − no-jitter, p95 latency | −0.214 s | [−0.233, −0.198] |
| full jitter − no-jitter, peak attempts/s | +14.3 | [+12.8, +15.8] |

```output
paired bootstrap samples=5000 seed=20260719
full_jitter-no_retry success=+0.0717 [0.0712,0.0721]
full_jitter-no_retry peak=+145.665 [142.905,148.330]
full_jitter-no_retry amplification=+0.2081 [0.2027,0.2137]
budgeted-full_jitter success=-0.0244 [-0.0249,-0.0239]
budgeted-full_jitter peak=-129.210 [-131.900,-126.410]
budgeted-full_jitter overflow=-2336.375 [-2455.965,-2217.425]
full_jitter-no_jitter latency=-0.2137s [-0.2327,-0.1977]
full_jitter-no_jitter peak=+14.300 [12.805,15.795]
```

The intervals are narrow because each five-minute trace contains roughly 25,500 original requests at the focal load. Statistical precision is not model validity. A very precise answer to a misspecified queue is still misspecified.

## Production implementation boundary

First classify outcomes. Retry transport disconnects, 408, 429, and selected 5xx responses only when the operation is safe and the provider contract permits it. Do not retry authentication errors, invalid requests, policy refusals, context-limit errors, or deterministic tool failures with the same payload. Honor `Retry-After` where supplied; [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#name-retry-after) defines the field, but providers differ in which statuses include it.

Second, make side effects idempotent. A timeout does not prove the provider failed before committing an action. Text generation is often read-like, but an agent request may send email, place an order, or mutate a record after model output. Retry the model step separately from the side effect, and attach an idempotency key at the mutation boundary.

Third, centralize the budget at the layer that owns the dependency. [gRPC's retry guide](https://grpc.io/docs/guides/retry/) distinguishes transparent retry from configured policy and supports throttling; [Azure's Retry pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/retry) emphasizes operation idempotency and exception-specific handling. The important architectural choice is one retry owner. Multiple SDK, proxy, orchestration, and application layers can multiply attempts invisibly.

Fourth, budget cost as well as count. An LLM attempt can vary by prompt tokens, cached tokens, generated tokens, tool calls, and accelerator time. A single retry token is suitable only if requests are approximately homogeneous. For mixed workloads, spend a weighted token proportional to expected provider work and reserve a small pool for high-priority, idempotent operations.

The [OpenAI Cookbook rate-limit example](https://cookbook.openai.com/examples/how_to_handle_rate_limits) recommends random exponential backoff and notes that unsuccessful requests contribute to per-minute limits. That is client-level timing advice. A production fleet still needs shared attempt accounting, because independent client decorators cannot observe their combined pressure.

## Error analysis and limitations

The largest limitation is the dependency model. It has fixed capacity per 100 ms, no queue, instantaneous success, and an exogenous failure process unrelated to offered load. Real incidents can reduce capacity gradually, return heterogeneous status codes, recover by region, or exhibit slow responses that retain server work after the client times out. Hedged requests are not modeled.

The independent control matches the stationary exogenous failure probability, not the exact number of failed attempts in each trace. A stricter control would permute one realized correlated failure vector across time while holding attempt opportunities fixed. That is difficult because each policy changes its own attempt times. A future event-level potential-outcome simulator could assign latent outcomes to every time slot and request identity before treatments run.

Successful-request p95 excludes failed requests. That is why no retry reports 0.000 seconds: its successful calls finish on the first tick while failures disappear from the latency distribution. Completion and latency must be read together. A composite expected user delay or restricted mean time-to-success would be more decision-useful when failures are expensive.

The budget is not tenant-fair. Eight noisy tenants can consume tokens before a critical request arrives. Production needs per-tenant floors, global ceilings, priority classes, and anti-starvation rules. It also needs a recovery mode: a bucket that remains empty after the provider is healthy can slow restoration.

Finally, the treatment knows only local failures. A provider health signal, concurrency header, or accurate `Retry-After` could dominate blind jitter. We did not simulate those positive controls, so the study cannot rank protocol-aware retries.

## Reproducibility

The saved evidence contains the configuration, dependency-free Python runner, 4,800 repeat-policy rows, 30 aggregate cells, paired bootstrap analysis, focal output, and the rendered result figure. The runner uses Python's standard library and no Torch, model service, accelerator, or network request.

```sh
python3 run_experiment.py
python3 analyze_results.py
python3 render_figure.py
```

Reproduction checks internal consistency. External confirmation should replay anonymized production arrivals against a failure-injection proxy, preserve the real SDK and timeout stack, and hold the fault trace fixed across policies. Freeze primary metrics and the retry budget before inspecting the confirmatory results.

## Production readiness, canary, and rollback

Instrument `original_request_id`, `attempt_number`, retry owner, status class, timeout phase, scheduled delay, actual delay, budget decision, prompt/output work estimate, dependency region, model revision, and end-to-end outcome. Report four ratios: attempts per original request, retry success conditional on first failure, budget-denied fraction, and provider work per completed original request.

Canary at one retry owner with a conservative global budget. Randomize eligible original requests between current and budgeted policies while pairing by time bucket, tenant class, and model. Predeclare a completion noninferiority margin and a maximum allowable increase in attempted calls during injected faults. Evaluate independent microfailures, five-to-ten-second correlated faults, explicit 429 with `Retry-After`, slow timeouts, and regional partial failure.

Roll back if attempts per original request exceed the approved ceiling, p99 queueing or provider throttles rise, duplicate side effects occur, completion crosses its noninferiority margin, or the budget disproportionately denies one tenant class. Disable retries entirely for non-idempotent actions until deduplication is verified.

## Claim boundary and source ledger

This study supports one decision: jittered retries need a separate aggregate budget when incident capacity matters. It does not say that budgeted retries always maximize completion, that full jitter is inferior, or that 8 retries/s is portable.

- Current — AWS Builders' Library, [timeouts, retries, backoff, jitter, token buckets, and multi-layer amplification](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/).
- Current — Google SRE, [cascading failures and overload feedback](https://sre.google/sre-book/addressing-cascading-failures/).
- Current — gRPC, [retry configuration, transparent retries, throttling, and observability](https://grpc.io/docs/guides/retry/).
- Current — Microsoft Azure Architecture Center, [Retry pattern and idempotency boundary](https://learn.microsoft.com/en-us/azure/architecture/patterns/retry).
- June 2022 — IETF RFC 9110, [HTTP `Retry-After` semantics](https://www.rfc-editor.org/rfc/rfc9110.html#name-retry-after).
- Current — OpenAI Cookbook, [random exponential backoff and rate-limit accounting](https://cookbook.openai.com/examples/how_to_handle_rate_limits).
- 2009 — IEEE/ACM Transactions on Networking, [exponential backoff instability under contention](https://doi.org/10.1109/TNET.2008.2007433), older scholarly context for why local retry rules can create system-level dynamics.

The practical lesson is uncomfortable but actionable: retries convert spare capacity into availability. During a correlated incident, spare capacity is the unknown. Measure the conversion rate, cap the spend, and decide explicitly which completion points are worth the added pressure.
