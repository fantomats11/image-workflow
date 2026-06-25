import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const appJs = fs.readFileSync(path.resolve("app.js"), "utf8");
const serverJs = fs.readFileSync(path.resolve("server.mjs"), "utf8");
const indexHtml = fs.readFileSync(path.resolve("index.html"), "utf8");
const stylesCss = fs.readFileSync(path.resolve("styles.css"), "utf8");
const supportDecisionStateJs = fs.readFileSync(path.resolve("lib/automation/support-review-decision-state.mjs"), "utf8");

test("Hero review renders a side-by-side comparison surface with nearby checklist and product summary", () => {
  assert.match(indexHtml, /id="heroReviewProductSummary"/);
  assert.match(indexHtml, /id="heroReviewReferenceSummary"/);
  assert.match(indexHtml, /class="[^"]*hero-review-comparison[^"]*"/);
  assert.match(indexHtml, /class="[^"]*hero-review-qc-panel[^"]*"/);
  assert.match(appJs, /function renderHeroReviewProductSummary\(/);
  assert.match(appJs, /function renderHeroReviewReferenceSummary\(/);
  assert.match(stylesCss, /\.hero-review-comparison/);
  assert.match(stylesCss, /\.hero-review-qc-panel/);
});

test("Hero review payload exposes reference summary and support stays hidden until Hero is approved", () => {
  assert.match(serverJs, /reference_summary: buildHeroReviewReferenceSummary\(referenceAssets\)/);
  assert.match(serverJs, /const heroApproved = Boolean\(approvalsResult\.data\?\.length\);/);
  assert.match(serverJs, /const supportReviewReady = heroApproved &&/);
  assert.match(appJs, /review\.reference_summary/);
  assert.match(appJs, /review\.hero_approved === true/);
});

test("Review decisions include structured reason fields for Hero regenerate and per-support decisions", () => {
  assert.match(indexHtml, /id="heroReviewRegenerateReason"/);
  assert.match(appJs, /data-support-reason/);
  assert.match(appJs, /heroReviewRegenerateReason/);
  assert.match(appJs, /reason: els\.heroReviewRegenerateReason\.value\.trim\(\)/);
  assert.match(appJs, /reason: reasonInput\?\.value\.trim\(\) \|\| ""/);
  assert.match(serverJs, /const reason = cleanOptionalString\(req\.body\.reason\)/);
});

test("Support review requires an approved Hero anchor before approving support candidates", () => {
  assert.match(serverJs, /const approvedHeroAnchor = await readApprovedHeroAnchorForSupportReview/);
  assert.match(supportDecisionStateJs, /support_review_requires_approved_hero_anchor/);
  assert.match(appJs, /approvedHeroAnchor/);
  assert.match(appJs, /ภาพเสริมจะเปิดหลังภาพหลักผ่านแล้ว/);
});
