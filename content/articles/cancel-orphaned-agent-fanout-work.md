---
title: Cancel Orphaned Agent Fan-Out Work Before It Consumes the Queue
description: Reproduce a controlled study of how parent-deadline propagation changes orphan work, queue depth, and completion in fan-out agent services.
topic: Agent Runtime Engineering
level: Advanced
date: 2026-07-22
readingTime: 25
tags: ai-agents, cancellation, structured-concurrency, queueing, reliability
image: /content/v1/assets/agent-fanout-cancellation.svg
imageAlt: Measured bar chart comparing orphan worker time and parent success across four fan-out cancellation policies
evidenceMode: experiment
qualityTier: deep-research
evidenceProject: operator/diy-project-blogs/projects/agent-fanout-cancellation
evidenceManifest: operator/diy-project-blogs/projects/agent-fanout-cancellation/evidence-manifest.json
---

An agent request can be dead to its caller and still very alive in the cluster. The coordinator times out, returns an error, and abandons six retrieval, browsing, or model calls. Those children keep running. Their answers will never be consumed, but their CPU, accelerator, connection, and quota demand remain real. Under burst load, that orphan work delays requests that still have a chance to succeed.

We tested this mechanism with a matched discrete-event experiment: 24 workers, six child tasks per parent, a six-second parent deadline, lognormal child service times, and steady or periodically bursty Poisson arrivals. Four policies received exactly the same arrival times and task durations within each of 240 repeats: never cancel, cancel only queued children, cooperatively stop running children after one second, and stop them after 250 milliseconds. A 60-second no-timeout control checks that the implementation produces no policy difference when cancellation never activates.

In the bursty scenario, 250-millisecond cooperative cancellation reduced orphan worker time from 5.449 to 0.348 seconds per parent and reduced total work from 16.765 to 14.523 worker-seconds. Parent completion before deadline rose from 37.62% to 46.22%, while maximum queue depth fell from 116.9 to 94.8 tasks. Paired-bootstrap intervals put the completion gain at 8.60 percentage points [8.27, 8.95], the orphan-work change at -5.101 seconds [-5.271, -4.938], and the queue change at -22.1 tasks [-23.7, -20.4].

This is mechanism evidence, not a universal cancellation SLA. The workload is synthetic, side effects are absent, and a child that has crossed an irreversible boundary may need completion or compensation rather than interruption. The decision is therefore conditional: propagate parent lifetime into cancellable work, separate abandonable computation from durable effects, and measure reclaimed capacity—not merely latency among parents that survived.

## Finding and decision summary

- No cancellation spent 32.48% of worker time after the relevant parent deadline in the bursty workload; 250-millisecond cooperative cancellation spent 2.41%.
- Cancelling only queued work helped, but running children still produced 3.064 orphan seconds per parent and a 19.72% orphan share.
- One-second cooperative cancellation reached 44.78% completion; shortening propagation to 250 milliseconds reached 46.22%. The experiment supports faster propagation in this workload, not an exact universal threshold.
- Completed-parent p95 barely changed: 5.824 seconds without cancellation and 5.818 seconds with the 250-millisecond policy. A survivor-only latency chart would miss the important capacity and completion changes.
- The 60-second no-timeout control produced exactly zero difference on success, latency, work, orphan work, and queue depth. That negative control ties the treatment effect to deadline activation.
- Every policy comparison is paired on the same parents and child durations across 240 repeats; 5,000 paired-bootstrap resamples quantify Monte Carlo uncertainty.
- The simulator contains no retries, rate limits, cache hits, token lengths, provider billing, network partitions, partial results, or external side effects.
- Production adoption requires a cancellation contract for each child operation, idempotency or compensation for durable actions, and telemetry that joins parent and child lifetimes.

The release gate should combine parent completion, useful work, orphan work, queue depth, and side-effect safety. Do not approve cancellation solely because completed-request p95 is flat or slightly better.

Two ledgers are required when work can be shared. A child with one expired subscriber but another live subscriber is not orphaned; cancelling it would destroy useful deduplication. Track subscriber count and retained value separately from parent liveness. The experiment has no shared children, so its orphan metric applies only where the expired parent is the sole consumer.

## Research question, hypothesis, and claim ladder

The confirmatory question was: when a fan-out parent misses its deadline, does promptly stopping work that can no longer contribute reclaim enough capacity to improve other parents' probability of finishing before the same deadline?

The directional hypothesis predicted that cooperative cancellation within 250 milliseconds would reduce orphan work and queue depth and improve parent completion relative to no cancellation under bursts. It also predicted no policy difference when deadlines were effectively removed. Both predictions held in the declared model.

The evidence supports four levels of claim:

1. **Measured:** the saved simulator rows establish the reported policy differences for the exact capacity, arrival, service, fan-out, and deadline configuration.
2. **Mechanistic:** unfinished children occupy workers after their result has lost value; reclaiming that work changes the capacity available to later parents.
3. **Operational:** agent platforms should propagate parent cancellation, distinguish queued from running work, and record orphan worker-seconds by child type.
4. **Not established:** the run does not identify a universal cancellation delay, prove a benefit for lightly loaded services, or authorize interruption of irreversible tool actions.

The design follows structured-concurrency's lifetime intuition: child tasks belong to a parent scope. The [Go `context` documentation](https://pkg.go.dev/context) propagates deadlines and cancellation across API boundaries. Python's [asyncio task-group documentation](https://docs.python.org/3/library/asyncio-task.html#task-groups) defines a scope that waits for or cancels related tasks. Kotlin's [coroutine cancellation guide](https://kotlinlang.org/docs/cancellation-and-timeouts.html) explains cooperative cancellation and the need for suspending or explicit checks. These are programming contracts, not performance evidence; the numeric claims below come from the local experiment.

## Methodology

### Workload and execution model

Each repeat generates parent arrivals for 360 simulated seconds. A steady scenario holds the rate at 1.25 parents per second. The bursty scenario averages 1.05 parents per second but spends the first quarter of every 60-second period at 2.1 times the base rate, with the remaining three quarters reduced so the long-run average stays fixed. Each parent creates six children.

Child service time is lognormal with a 2.4-second median and log-space sigma 0.55. The distribution creates heterogeneous work without assigning any provider semantics. Twenty-four identical workers execute first-in, first-out from one queue. The simulator uses an event queue rather than wall-clock sleeps, so results are reproducible and do not depend on host speed.

```javascript
function makeWorkload(seed, spec) {
  const rng = mulberry32(seed);
  const parents = [];
  let time = 0;
  const maxRate = spec.arrivalRate * Math.max(1, spec.burstMultiplier);

  while (time < durationSeconds) {
    time += -Math.log(Math.max(rng(), Number.EPSILON)) / maxRate;
    if (time >= durationSeconds) break;
    if (rng() > rateAt(time, spec) / maxRate) continue;

    const services = Array.from({length: fanout}, () =>
      Math.exp(
        Math.log(serviceMedianSeconds) + serviceSigma * normal(rng)
      )
    );
    parents.push({id: parents.length, arrival: time, services});
  }
  return parents;
}
```

The thinning procedure produces the intended time-varying Poisson process. All four policies reuse the same generated parent objects within a repeat, so a difference is not attributable to one policy receiving easier child durations.

### Parent and child state

A parent succeeds only if all six children complete before the parent deadline. At six seconds, the runtime marks an unfinished parent timed out. The no-cancel baseline changes no child state. Queued-only cancellation invalidates that parent's unstarted queue entries. Cooperative policies also schedule cancellation events for running children after the declared propagation delay.

```javascript
if (event.type === 'deadline') {
  const state = states[event.parentId];
  if (state.successTime !== null) continue;
  state.timedOut = true;

  if (policy.cancelQueued) {
    for (const task of queue) {
      if (task.parent.id === event.parentId) task.cancelled = true;
    }
  }

  if (policy.runningCancelDelaySeconds !== null) {
    for (const task of running.values()) {
      if (task.parent.id === event.parentId) {
        push({
          time: event.time + policy.runningCancelDelaySeconds,
          type: 'cancel',
          taskId: task.id
        });
      }
    }
  }
  startQueued(event.time);
}
```

Cancellation is cooperative in the model because a running child remains active for 250 milliseconds or one second after the deadline. Real systems can take longer because cancellation must traverse gateways, brokers, runtimes, and provider APIs. Some provider calls expose cancellation only at the client connection while remote billing or computation continues; that must be measured separately.

### Metrics

Worker time accumulates only while a task is running. Orphan time is the intersection between that run interval and the period after the parent deadline. Queue entries cancelled before execution consume no worker time. Maximum queue depth is sampled exactly at event transitions.

```javascript
function stopTask(task, now, completed) {
  if (!running.has(task.id)) return;
  running.delete(task.id);

  const worked = Math.max(0, now - task.start);
  workerSeconds += worked;
  const deadline = task.parent.arrival + deadlineSeconds;
  orphanWorkerSeconds += Math.max(
    0,
    now - Math.max(task.start, deadline)
  );

  if (completed) {
    const state = states[task.parent.id];
    state.completed += 1;
    if (!state.timedOut && state.completed === fanout) {
      state.successTime = now;
    }
  }
  startQueued(now);
}
```

The main metrics are parent success rate, p95 latency among successful parents, worker-seconds per parent, orphan seconds per parent, orphan share, and maximum queue depth. Successful-parent latency is retained precisely to show its limitation: it remains nearly constant while completion and capacity move materially.

## Baselines and controls

The no-cancel policy is the operational baseline. Queued-only cancellation is an ablation that asks how much benefit comes from preventing new work without interrupting running work. The one-second and 250-millisecond treatments test sensitivity to propagation speed.

The no-timeout scenario sets the deadline to 60 seconds. Every parent completes before that boundary under the configured load, so none of the cancellation policies activates. Every paired difference is exactly zero. This is stronger than observing a small nonsignificant change: the negative control verifies that policy labels alone do not alter scheduling.

The steady scenario checks whether the finding depends entirely on periodic bursts. Cooperative cancellation improved completion by 11.94 percentage points [11.20, 12.74] there and reduced orphan work by 3.178 seconds per parent [-3.429, -2.941]. The magnitude differs from the burst treatment; the direction does not.

An important missing control is a side-effecting child. The simulator treats every task as safely abandonable computation. A production rollout must add child classes such as read-only retrieval, model inference, metered external call, idempotent write, and irreversible action. Only the first categories should inherit automatic interruption without an additional protocol.

## Results

The locally generated bursty-scenario comparison is the focal result. All rows share matched arrivals and service times, and the table is derived from `aggregate-results.json`. Cancellation semantics are bounded by the [gRPC cancellation guide](https://grpc.io/docs/guides/cancellation/); the numeric rows come only from the saved local study.

| Cancellation policy | Parent success | Successful p95 | Work / parent | Orphan work / parent | Orphan share | Max queue |
|---|---:|---:|---:|---:|---:|---:|
| no cancellation | 37.62% | 5.824s | 16.765s | 5.449s | 32.48% | 116.9 |
| queued children only | 42.07% | 5.815s | 15.588s | 3.064s | 19.72% | 107.8 |
| cooperative after 1,000ms | 44.78% | 5.818s | 14.827s | 1.315s | 8.92% | 101.2 |
| cooperative after 250ms | 46.22% | 5.818s | 14.523s | 0.348s | 2.41% | 94.8 |

The biggest interpretive trap is the flat p95. It is conditional on success, and successful parents finish close to the six-second boundary in every policy. The capacity benefit appears as more successful parents, less discarded work, and a shorter queue—not as a dramatic change among survivors.

```output
no_cancel: success=37.62% p95=5.824s work=16.765s orphan=5.449s orphan_share=32.48% max_queue=116.9
queued_only: success=42.07% p95=5.815s work=15.588s orphan=3.064s orphan_share=19.72% max_queue=107.8
cooperative_1000ms: success=44.78% p95=5.818s work=14.827s orphan=1.315s orphan_share=8.92% max_queue=101.2
cooperative_250ms: success=46.22% p95=5.818s work=14.523s orphan=0.348s orphan_share=2.41% max_queue=94.8
```

Queued-only cancellation captures less than half the orphan-work reduction of the 250-millisecond treatment. This negative result matters: removing waiting tasks is useful, but it is not equivalent to propagating lifetime into active children.

## Statistical analysis and uncertainty

The unit of resampling is the repeat, not the child. Within each repeat, the treatment-minus-baseline contrast preserves shared workload draws. Five thousand bootstrap samples resample the 240 paired repeat differences with replacement.

```javascript
function pairedBootstrap(deltas, seed) {
  const rng = mulberry32(seed);
  const draws = [];
  for (let b = 0; b < bootstrapSamples; b += 1) {
    let total = 0;
    for (let i = 0; i < deltas.length; i += 1) {
      total += deltas[Math.floor(rng() * deltas.length)];
    }
    draws.push(total / deltas.length);
  }
  return {
    mean: mean(deltas),
    ciLow: quantile(draws, 0.025),
    ciHigh: quantile(draws, 0.975)
  };
}
```

```output
success_delta=8.60pp 95%CI[8.27,8.95]
orphan_delta=-5.101s 95%CI[-5.271,-4.938]
work_delta=-2.241s 95%CI[-2.301,-2.183]
queue_delta=-22.1 95%CI[-23.7,-20.4]
no_timeout_control: every paired policy delta = 0
```

These intervals quantify simulation variability under a fixed generator. They exclude uncertainty about whether the generator resembles a production trace. The narrowness reflects 240 repeats and hundreds of parents per repeat; it must not be presented as confidence about a named system.

## Production Readiness and decision gate

Cancellation needs one identity that crosses the coordinator, child scheduler, worker, and provider client. Record `parent_id`, `child_id`, parent deadline, enqueue/start/stop time, cancellation-request time, cancellation-observed time, completion disposition, work units, and whether a side effect crossed its commit boundary. OpenTelemetry's [trace specification](https://opentelemetry.io/docs/specs/otel/trace/) supplies parent-child correlation, while its [semantic conventions](https://opentelemetry.io/docs/specs/semconv/) can be extended with cancellation outcome and abandoned-work attributes.

For gRPC, a cancelled client call does not automatically make application code safe: the [gRPC cancellation guide](https://grpc.io/docs/guides/cancellation/) requires servers to stop work and notes that libraries do not roll back prior changes. For HTTP, use an abort signal through every layer rather than merely closing a browser promise. Database and tool adapters need explicit interruption semantics.

Instrument remote acknowledgement separately from local cancellation. Closing a socket can release a local worker while the provider continues generating and billing. Count locally reclaimed time, remotely acknowledged stop time, and billed post-deadline units as three metrics; the simulator establishes only the first.

Canary by child class. Compare incumbent and propagating runtimes on matched traffic for parent success, useful child completions, orphan compute, provider-billed tokens or seconds, queue depth, cancellation propagation p50/p95/p99, duplicate side effects, and compensations. Require zero increase in unsafe partial writes and a material decrease in orphan work before expanding.

Rollback if cancellation interrupts committed writes, increases duplicate actions, leaks child tasks, causes provider-client instability, or shifts failures into retry storms. Rollback should disable automatic interruption for the affected child class while preserving parent deadlines and queued-work rejection.

## Limitations and error analysis

The model uses one FIFO queue and homogeneous workers. Real deployments have per-provider pools, priorities, batching, rate limits, token-dependent service, and autoscaling delay. Those mechanisms can amplify or attenuate the result.

The task-duration distribution is declared rather than trace-fitted. Parent success requires all six children; systems accepting partial results may benefit differently. The simulator treats cancellation as free except for propagation delay, while cleanup can consume capacity. It also assumes a cancelled remote call stops billable work, which may be false.

The strongest counterargument is that aggressive cancellation can waste nearly complete work and worsen cache population or shared results. That is plausible. The evidence supports cancelling work whose value is scoped only to the expired parent. It does not support cancelling deduplicated work with other subscribers, cache fills that retain future value, or operations beyond a commit boundary.

The largest reproduction barrier is workload calibration. A production team must reconstruct parent-child traces with censored and cancelled work retained; ordinary request logs often delete exactly the child lifetime needed for this analysis.

## Reproducibility

The evidence project contains the frozen configuration, generator, 2,880 repeat-policy rows, aggregates, paired-bootstrap analysis, focal text summary, and result SVG. It uses only the bundled Node standard library.

```sh
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node run-experiment.mjs
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node render-figure.mjs
```

Verify that the regenerated `focal-summary.txt`, `statistical-analysis.json`, and SVG match the committed artifacts. Then change one factor at a time: fan-out, worker count, deadline, propagation delay, service distribution, or burst shape. Treat those as new experimental cells, not post-hoc replacements for the focal result.

## Claim boundary

The experiment supports one bounded conclusion: in the specified capacity-constrained fan-out system, promptly propagating an expired parent's lifetime into safely cancellable queued and running children reclaimed otherwise orphaned worker time and improved completion for other parents. It does not prove that cancellation is safe for side effects, that 250 milliseconds is universally optimal, or that the measured effect transfers unchanged to a provider, model, or trace.

Use the result to change what you measure and what contract you require. A child should either belong to a live parent scope, retain independently declared value, or cross a durable-action protocol. “The coordinator returned” is not evidence that the work stopped.
