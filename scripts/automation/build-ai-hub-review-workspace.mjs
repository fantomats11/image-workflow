#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildAiHubReviewWorkspace } from "../../lib/automation/ai-hub-review-workspace.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const defaultOutputsDir = path.resolve(repoRoot, "../../outputs");

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`AI HUB review workspace failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outputsDir = path.resolve(options.outputsDir || defaultOutputsDir);
  const outputPath = path.resolve(options.output || path.join(outputsDir, "ai-hub-review-workspace.json"));
  const artifacts = readAiHubReviewArtifacts(outputsDir);
  const workspace = buildAiHubReviewWorkspace({ artifacts });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(workspace, null, 2)}\n`, "utf8");
  console.info(`AI HUB review workspace wrote: ${outputPath}`);
  console.info(`Summary: ${JSON.stringify(workspace.summary)}`);
}

export function readAiHubReviewArtifacts(outputsDir) {
  if (!fs.existsSync(outputsDir)) return [];
  return fs.readdirSync(outputsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^ai-hub-(image-review-bundle|review-decisions|review-action-plan|regeneration-gate|local-candidate-manifest).*\.json$/i.test(entry.name))
    .map((entry) => {
      const filePath = path.join(outputsDir, entry.name);
      const stat = fs.statSync(filePath);
      try {
        return {
          file_name: entry.name,
          file_path: filePath,
          mtime_ms: stat.mtimeMs,
          content: JSON.parse(fs.readFileSync(filePath, "utf8"))
        };
      } catch (error) {
        return {
          file_name: entry.name,
          file_path: filePath,
          mtime_ms: stat.mtimeMs,
          content: {
            manifest_type: "unreadable_ai_hub_artifact",
            error: error?.message || String(error)
          }
        };
      }
    })
    .filter((artifact) => artifact.content.manifest_type !== "unreadable_ai_hub_artifact");
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--outputs-dir") parsed.outputsDir = args[++index];
    else if (arg === "--output") parsed.output = args[++index];
    else if (arg === "--help" || arg === "-h") printHelpAndExit();
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelpAndExit() {
  console.info([
    "Usage: node scripts/automation/build-ai-hub-review-workspace.mjs [options]",
    "",
    "Options:",
    "  --outputs-dir <path>   Outputs directory to scan.",
    "  --output <path>        Output workspace JSON path."
  ].join("\n"));
  process.exit(0);
}
