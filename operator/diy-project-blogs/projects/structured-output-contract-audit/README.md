# Structured-output contract audit

This dependency-free matched Monte Carlo study tests whether a release gate
based on marginal field accuracy can approve a structured-output system whose
whole-call exact-match rate is below the application contract.

The confirmatory run uses 800 repeats of 3,000 calls across mixed 4-, 8-, 16-,
and 32-field schemas. All release policies see the same calls and error draws
within a repeat. A one-field negative control makes field and call units
coincide; fixed-eight and independent-error controls isolate schema mixture and
call-correlated failures.

Reproduce:

```sh
node operator/diy-project-blogs/projects/structured-output-contract-audit/run-experiment.mjs
node operator/diy-project-blogs/projects/structured-output-contract-audit/render-figure.mjs
```

This is a mechanism study under declared synthetic parameters. It does not
measure a named model, provider, or schema, and it cannot select a universal
release threshold. Production evaluation requires real schemas, validators,
repair behavior, semantic checks, and field criticality.
