# Model Route Release Gates

This project measures a policy router against a cheapest-first route and a single frontier-model route for mixed AI workloads.

The release gate combines quality, latency, cost, and unsafe-write controls. The script uses a controlled replay dataset with task difficulty, risk, citation need, and write capability flags.

Run it with:

```sh
node operator/diy-project-blogs/projects/model-route-release-gates/run-experiment.mjs
```

The script writes `dataset.json`, `results.json`, `output.txt`, and `chart.svg`.
