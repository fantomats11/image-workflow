#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadLocalEnv } from "../../lib/automation/env.mjs";
import {
  buildAiHubLocalCandidateManifest,
  buildAiHubRegenerationGate
} from "../../lib/automation/ai-hub-regen-candidate-phase.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultOutputsDir = path.resolve(repoRoot, "../../outputs");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`AI HUB regen/candidate phase failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export async function main() {
  loadLocalEnv(path.join(repoRoot, ".env"));
  const options = parseArgs(process.argv.slice(2));
  const outputsDir = path.resolve(options.outputsDir || defaultOutputsDir);
  const actionPlanPath = options.actionPlan
    ? path.resolve(options.actionPlan)
    : findLatestManifest(outputsDir, "ai_hub_product_image_review_action_plan");
  const reviewBundlePath = options.reviewBundle
    ? path.resolve(options.reviewBundle)
    : findLatestManifest(outputsDir, "ai_hub_product_image_review_bundle");

  if (!actionPlanPath) throw new Error(`No AI HUB review action plan found in ${outputsDir}`);
  if (!reviewBundlePath) throw new Error(`No AI HUB review bundle found in ${outputsDir}`);

  const actionPlan = readJson(actionPlanPath);
  const reviewBundle = readJson(reviewBundlePath);
  const regenGate = buildAiHubRegenerationGate({
    actionPlan,
    mode: options.mode || "all",
    maxRequests: Number(options.maxRequests || 12),
    liveRequested: Boolean(options.live),
    liveConfirmed: Boolean(options.confirmLiveGeneration),
    env: process.env
  });
  const candidateManifest = buildAiHubLocalCandidateManifest({ actionPlan, reviewBundle });

  const regenGatePath = path.resolve(options.regenGateOutput || path.join(outputsDir, "ai-hub-regeneration-gate.json"));
  const candidateManifestPath = path.resolve(options.candidateManifestOutput || path.join(outputsDir, "ai-hub-local-candidate-manifest.json"));
  writeJson(regenGatePath, regenGate);
  writeJson(candidateManifestPath, candidateManifest);

  console.info(`AI HUB regeneration gate wrote: ${regenGatePath}`);
  console.info(`Regen summary: ${JSON.stringify(regenGate.summary)} Gate status: ${regenGate.gate_status}`);
  console.info(`AI HUB local candidate manifest wrote: ${candidateManifestPath}`);
  console.info(`Candidate summary: ${JSON.stringify(candidateManifest.summary)} Manifest status: ${candidateManifest.manifest_status}`);
}

export function findLatestManifest(outputsDir, manifestType) {
  if (!fs.existsSync(outputsDir)) return "";
  const candidates = fs.readdirSync(outputsDir)
    .filter((name) => name.startsWith("ai-hub-") && name.endsWith(".json"))
    .map((name) => {
      const filePath = path.join(outputsDir, name);
      try {
        const content = readJson(filePath);
        if (content.manifest_type !== manifestType) return null;
        return {
          filePath,
          createdAt: new Date(content.created_at || 0).getTime() || 0,
          mtimeMs: fs.statSync(filePath).mtimeMs
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((left, right) => (right.createdAt || right.mtimeMs) - (left.createdAt || left.mtimeMs));
  return candidates[0]?.filePath || "";
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--action-plan") parsed.actionPlan = args[++index];
    else if (arg === "--review-bundle") parsed.reviewBundle = args[++index];
    else if (arg === "--mode") parsed.mode = args[++index];
    else if (arg === "--max-requests") parsed.maxRequests = args[++index];
    else if (arg === "--live") parsed.live = true;
    else if (arg === "--confirm-live-generation") parsed.confirmLiveGeneration = true;
    else if (arg === "--regen-gate-output") parsed.regenGateOutput = args[++index];
    else if (arg === "--candidate-manifest-output") parsed.candidateManifestOutput = args[++index];
    else if (arg === "--outputs-dir") parsed.outputsDir = args[++index];
    else if (arg === "--help" || arg === "-h") printHelpAndExit();
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (parsed.mode && !["all", "support-only", "hero-only"].includes(parsed.mode)) {
    throw new Error("--mode must be one of: all, support-only, hero-only.");
  }
  return parsed;
}

function printHelpAndExit() {
  console.info([
    "Usage: node scripts/automation/build-ai-hub-regen-candidate-phase.mjs [options]",
    "",
    "Options:",
    "  --action-plan <path>                 AI HUB review action plan JSON. Defaults to latest action plan in outputs.",
    "  --review-bundle <path>               AI HUB review bundle JSON. Defaults to latest review bundle in outputs.",
    "  --mode <all|support-only|hero-only>  Regen request selection mode. Default: all.",
    "  --max-requests <n>                   Max regen requests in this wave. Default: 12.",
    "  --live                               Request live regeneration gate arming.",
    "  --confirm-live-generation            Required with --live to arm execution.",
    "  --regen-gate-output <path>           Output path for regen gate.",
    "  --candidate-manifest-output <path>   Output path for local candidate manifest.",
    "  --outputs-dir <path>                 Outputs directory."
  ].join("\n"));
  process.exit(0);
}
