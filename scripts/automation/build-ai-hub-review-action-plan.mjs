#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildAiHubImageReviewActionPlan,
  buildAiHubImageReviewDecisionTemplate
} from "../../lib/automation/ai-hub-review-action-plan.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultOutputsDir = path.resolve(repoRoot, "../../outputs");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`AI HUB review action plan failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outputsDir = path.resolve(options.outputsDir || defaultOutputsDir);
  const bundlePath = path.resolve(options.bundle || path.join(outputsDir, "ai-hub-image-review-bundle.json"));
  const outputPath = path.resolve(options.output || path.join(outputsDir, "ai-hub-review-action-plan.json"));
  if (!fs.existsSync(bundlePath)) throw new Error(`Review bundle not found: ${bundlePath}`);

  const reviewBundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
  const decisions = options.template
    ? buildAiHubImageReviewDecisionTemplate({ reviewBundle, reviewer: options.reviewer || "" })
    : loadDecisions(options);
  const output = options.template
    ? decisions
    : buildAiHubImageReviewActionPlan({
      reviewBundle,
      decisions,
      reviewer: options.reviewer || ""
    });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.info(`AI HUB ${options.template ? "decision template" : "review action plan"} wrote: ${outputPath}`);
  if (output.summary) console.info(`Summary: ${JSON.stringify(output.summary)}`);
}

function loadDecisions(options) {
  if (options.decisions) {
    const decisionsPath = path.resolve(options.decisions);
    if (!fs.existsSync(decisionsPath)) throw new Error(`Decisions JSON not found: ${decisionsPath}`);
    return JSON.parse(fs.readFileSync(decisionsPath, "utf8"));
  }

  return {
    reviewer: options.reviewer || "",
    decisions: [
      ...options.approve.map((requestId) => decision(requestId, "approve_asset", options.reviewer)),
      ...options.regenerate.map((requestId) => decision(requestId, "regenerate_slot", options.reviewer)),
      ...options.reject.map((requestId) => decision(requestId, "reject_asset", options.reviewer)),
      ...options.manualReview.map((requestId) => decision(requestId, "needs_manual_review", options.reviewer))
    ]
  };
}

function decision(requestId, action, reviewer) {
  return {
    review_asset_id: requestId,
    request_id: requestId,
    action,
    reviewer: reviewer || "",
    flags: [],
    passed_checks: [],
    notes: ""
  };
}

function parseArgs(args) {
  const parsed = {
    approve: [],
    regenerate: [],
    reject: [],
    manualReview: []
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--bundle") parsed.bundle = args[++index];
    else if (arg === "--decisions") parsed.decisions = args[++index];
    else if (arg === "--reviewer") parsed.reviewer = args[++index];
    else if (arg === "--approve") parsed.approve.push(...splitList(args[++index]));
    else if (arg === "--regenerate") parsed.regenerate.push(...splitList(args[++index]));
    else if (arg === "--reject") parsed.reject.push(...splitList(args[++index]));
    else if (arg === "--manual-review") parsed.manualReview.push(...splitList(args[++index]));
    else if (arg === "--decision-template") parsed.template = true;
    else if (arg === "--output") parsed.output = args[++index];
    else if (arg === "--outputs-dir") parsed.outputsDir = args[++index];
    else if (arg === "--help" || arg === "-h") printHelpAndExit();
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function splitList(value = "") {
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function printHelpAndExit() {
  console.info([
    "Usage: node scripts/automation/build-ai-hub-review-action-plan.mjs [options]",
    "",
    "Options:",
    "  --bundle <path>             AI HUB review bundle JSON.",
    "  --decisions <path>          Human decisions JSON.",
    "  --decision-template         Write a decision template instead of an action plan.",
    "  --reviewer <id>             Reviewer id/name stored in generated decisions.",
    "  --approve <id[,id]>         Inline approve decisions.",
    "  --regenerate <id[,id]>      Inline regenerate decisions.",
    "  --reject <id[,id]>          Inline reject decisions.",
    "  --manual-review <id[,id]>   Inline manual-review hold decisions.",
    "  --output <path>             Output JSON path.",
    "  --outputs-dir <path>        Outputs directory."
  ].join("\n"));
  process.exit(0);
}
