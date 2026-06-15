#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildAiHubImageReviewBundle } from "../../lib/automation/ai-hub-image-review-bundle.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultOutputsDir = path.resolve(repoRoot, "../../outputs");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`AI HUB image review bundle failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outputsDir = path.resolve(options.outputsDir || defaultOutputsDir);
  const generationPlanPath = path.resolve(options.generationPlan || path.join(outputsDir, "pilot-generation-execution-plan.json"));
  const outputPath = path.resolve(options.output || path.join(outputsDir, "ai-hub-image-review-bundle.json"));

  if (!fs.existsSync(generationPlanPath)) throw new Error(`Generation plan not found: ${generationPlanPath}`);
  const generationPlan = filterGenerationPlanBySku(
    JSON.parse(fs.readFileSync(generationPlanPath, "utf8")),
    options.sku
  );
  const executionArtifacts = options.executionPaths.map((executionPath) => {
    const resolvedPath = path.resolve(executionPath);
    if (!fs.existsSync(resolvedPath)) throw new Error(`Execution artifact not found: ${resolvedPath}`);
    return JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  });

  const bundle = buildAiHubImageReviewBundle({ generationPlan, executionArtifacts });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  console.info(`AI HUB image review bundle wrote: ${outputPath}`);
  console.info(`Summary: ${JSON.stringify(bundle.summary)}`);
}

function parseArgs(args) {
  const parsed = {
    executionPaths: []
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--generation-plan") parsed.generationPlan = args[++index];
    else if (arg === "--sku") parsed.sku = args[++index];
    else if (arg === "--execution") parsed.executionPaths.push(...splitPathList(args[++index]));
    else if (arg === "--output") parsed.output = args[++index];
    else if (arg === "--outputs-dir") parsed.outputsDir = args[++index];
    else if (arg === "--help" || arg === "-h") printHelpAndExit();
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function filterGenerationPlanBySku(generationPlan, sku) {
  const normalizedSku = normalizeSku(sku);
  if (!normalizedSku) return generationPlan;
  return {
    ...generationPlan,
    items: (generationPlan.items || []).filter((item) => normalizeSku(item.sku) === normalizedSku)
  };
}

function normalizeSku(value) {
  return String(value || "").trim().toUpperCase();
}

function splitPathList(value = "") {
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function printHelpAndExit() {
  console.info([
    "Usage: node scripts/automation/build-ai-hub-image-review-bundle.mjs [options]",
    "",
    "Options:",
    "  --generation-plan <path>   Generation execution plan JSON. Defaults to outputs/pilot-generation-execution-plan.json.",
    "  --sku <sku>                Optional SKU filter for focused review bundles.",
    "  --execution <path[,path]>   Smoke/execution artifact JSON. Repeatable.",
    "  --output <path>            Output JSON path. Defaults to outputs/ai-hub-image-review-bundle.json.",
    "  --outputs-dir <path>       Outputs directory."
  ].join("\n"));
  process.exit(0);
}
