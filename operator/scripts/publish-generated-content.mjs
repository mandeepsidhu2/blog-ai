#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");
const articleDir = path.join(rootDir, "content", "articles");
const assetDir = path.join(rootDir, "content", "assets");
const distDir = path.join(rootDir, "dist");
const contentQualityScript = path.join(rootDir, "operator", "scripts", "check-public-content.mjs");
const publicArticleBlocklist = [
  {
    label: "local model catalog article",
    pattern: /local[- ]model[- ]catalog[- ]health[- ]check/i,
  },
  {
    label: "local model catalog endpoint",
    pattern: /http:\/\/localhost:1234\/api\/v1\/models/i,
  },
  {
    label: "local model catalog run status",
    pattern: /model catalog status|catalog status unavailable|unavailable catalog/i,
  },
  {
    label: "operator filesystem path",
    pattern: /\/Users\/|\/private\/tmp\//i,
  },
  {
    label: "operator AWS profile",
    pattern: /AWS_PROFILE=macbook-terraform|macbook-terraform/i,
  },
];

function parseArgs(argv) {
  const args = {
    delete: false,
    dryRun: false,
    skipCheck: false,
    siteUrl: process.env.SITE_URL || "https://learn.toolsite.com",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--delete") {
      args.delete = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--skip-check") {
      args.skipCheck = true;
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

  if (!args.sourceDir) throw new Error("Missing --source-dir");
  if (!args.contentBucket) throw new Error("Missing --content-bucket");
  if (args.skipCheck) {
    throw new Error("--skip-check is not allowed for publishing. Public content quality gates are mandatory.");
  }
  return args;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dirPath) {
  if (!(await exists(dirPath))) return [];

  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function stageFile(sourcePath, targetPath, restorePlan) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });

  if (await exists(targetPath)) {
    restorePlan.push({
      type: "restore",
      path: targetPath,
      content: await fs.readFile(targetPath),
    });
  } else {
    restorePlan.push({ type: "remove", path: targetPath });
  }

  await fs.copyFile(sourcePath, targetPath);
}

async function assertPublicArticleSource(articleFiles) {
  const issues = [];

  for (const articleFile of articleFiles) {
    const content = await fs.readFile(articleFile, "utf8");
    for (const rule of publicArticleBlocklist) {
      if (rule.pattern.test(content)) {
        issues.push(`${path.basename(articleFile)} contains ${rule.label}`);
      }
    }
  }

  if (issues.length) {
    throw new Error(
      [
        "Generated article source contains operator-only details that must not be published.",
        ...issues.map((issue) => `- ${issue}`),
      ].join("\n"),
    );
  }
}

async function stageGeneratedContent(sourceDir) {
  const restorePlan = [];
  const sourceArticleDir = path.join(sourceDir, "articles");
  const sourceAssetDir = path.join(sourceDir, "assets");

  const articleFiles = (await listFiles(sourceArticleDir)).filter((filePath) => filePath.endsWith(".md"));
  if (!articleFiles.length) {
    throw new Error(`No Markdown articles found in ${sourceArticleDir}`);
  }
  await assertPublicArticleSource(articleFiles);

  for (const sourcePath of articleFiles) {
    await stageFile(sourcePath, path.join(articleDir, path.basename(sourcePath)), restorePlan);
  }

  for (const sourcePath of await listFiles(sourceAssetDir)) {
    const relativePath = path.relative(sourceAssetDir, sourcePath);
    await stageFile(sourcePath, path.join(assetDir, relativePath), restorePlan);
  }

  return restorePlan.reverse();
}

async function restoreGeneratedContent(restorePlan) {
  for (const entry of restorePlan) {
    if (entry.type === "restore") {
      await fs.mkdir(path.dirname(entry.path), { recursive: true });
      await fs.writeFile(entry.path, entry.content);
    } else if (entry.type === "remove") {
      await fs.rm(entry.path, { force: true });
    }
  }
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceDir = path.resolve(args.sourceDir);
  const sourceArticleDir = path.join(sourceDir, "articles");
  const sourceAssetDir = path.join(sourceDir, "assets");
  let restorePlan = [];

  try {
    run(process.execPath, [
      contentQualityScript,
      "--articles-dir",
      sourceArticleDir,
      "--assets-dir",
      sourceAssetDir,
      "--source-label",
      "generated publish batch",
    ]);

    restorePlan = await stageGeneratedContent(sourceDir);

    run(process.execPath, ["app-scripts/build-site.mjs"], {
      env: { SITE_URL: args.siteUrl },
    });

    run(process.execPath, ["app-scripts/check-site.mjs"]);

    const syncFlags = args.delete ? ["--delete"] : [];
    runAws(["s3", "sync", path.join(distDir, "content"), `s3://${args.contentBucket}`, ...syncFlags], args.dryRun);

    if (args.appBucket) {
      runAws(["s3", "sync", path.join(distDir, "app"), `s3://${args.appBucket}`, ...syncFlags], args.dryRun);
    }

    if (args.distributionId) {
      runAws(
        ["cloudfront", "create-invalidation", "--distribution-id", args.distributionId, "--paths", "/*"],
        args.dryRun,
      );
    }
  } finally {
    await restoreGeneratedContent(restorePlan);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
