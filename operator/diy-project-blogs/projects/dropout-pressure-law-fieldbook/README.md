# Dropout Pressure-Law Fieldbook

This project turns the completed dropout-decay study into a compact,
article-specific evidence bundle. It does not rerun training. The analyzer reads
the frozen paper summary, checks the paired-gain arithmetic, extracts the
multi-seed confidence intervals and stage-level negative results, and renders
the publication figure.

## Evidence boundary

The copied summary contains matched static-dropout and decaying-dropout runs for
OpenWebText10K, TinyStories, and WikiText-103 at 4M- and 8M-token prefixes. The
article can support claims about these six small-transformer regimes. It cannot
establish a universal dropout law, predict behavior at frontier scale, or
separate every possible schedule shape from the fitted pressure formula.

## Reproduce the article artifacts

```sh
node operator/diy-project-blogs/projects/dropout-pressure-law-fieldbook/analyze-results.mjs
```

The command writes:

- `article-results.json`: normalized result rows used by the article.
- `output.txt`: a concise audit log of gains, intervals, wins, and negative
  early-stage deltas.
- `dropout-pressure-law.svg`: the evidence figure generated from those rows.

`paper-results-summary.json` is a frozen copy of the completed study's paper
summary. The original study contains the full training configs, checkpoints,
tables, and reproduction instructions; this bundle deliberately keeps only the
minimum evidence required to audit the published claims.
