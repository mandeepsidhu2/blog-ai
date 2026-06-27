#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");
const distDir = path.join(rootDir, "dist");

function parseArgs(argv) {
  const args = {
    delete: false,
    dryRun: false,
    siteUrl: process.env.SITE_URL || "https://learn.toolsite.com",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--delete") {
      args.delete = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--skip-check") {
      throw new Error("--skip-check is not allowed for publishing. Public content quality gates are mandatory.");
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${arg}`);
      }
      args[key] = value;
      index += 1;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!args.appBucket) throw new Error("Missing --app-bucket");
  if (!args.contentBucket) throw new Error("Missing --content-bucket");
  return args;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env: { ...process.env, ...options.env },
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function runAws(args, dryRun) {
  const aws = process.env.AWS_CLI || "aws";
  if (dryRun) {
    console.log(`[dry-run] ${aws} ${args.join(" ")}`);
    return;
  }
  run(aws, args);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const syncFlags = args.delete ? ["--delete"] : [];

  run(process.execPath, ["operator/scripts/check-public-content.mjs"]);
  run(process.execPath, ["app-scripts/build-site.mjs"], {
    env: { SITE_URL: args.siteUrl },
  });
  run(process.execPath, ["app-scripts/check-site.mjs"]);

  runAws(["s3", "sync", path.join(distDir, "content"), `s3://${args.contentBucket}`, ...syncFlags], args.dryRun);
  runAws(["s3", "sync", path.join(distDir, "app"), `s3://${args.appBucket}`, ...syncFlags], args.dryRun);

  if (args.distributionId) {
    runAws(
      ["cloudfront", "create-invalidation", "--distribution-id", args.distributionId, "--paths", "/*"],
      args.dryRun,
    );
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
