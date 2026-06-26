import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const appJsPath = path.resolve("app.js");
const appJs = fs.readFileSync(appJsPath, "utf8");

test("manual create Hero prompt uses Prompt Framework v3 Thai contract", () => {
  assert.match(appJs, /function buildManualHeroPromptV3\(\)/);
  assert.match(appJs, /อ้างอิงภาพต้นฉบับ สร้างภาพรีวิวที่ดูเรียล/);
  assert.match(appJs, /ไม่ต้องใส่ข้อความ ไม่ต้องแบ่งกริด/);
  assert.match(appJs, /currentPrompt = buildManualHeroPromptV3\(\);/);
});

test("manual create Support prompt uses approved Hero v3 contract", () => {
  assert.match(appJs, /อ้างอิงภาพต้นฉบับและภาพหลักที่อนุมัติแล้ว/);
  assert.match(appJs, /ภาพต้องดูเป็นเซ็ตเดียวกับภาพหลัก/);
  assert.match(appJs, /Reference Image 1 คือภาพหลักที่อนุมัติแล้ว/);
  assert.match(appJs, /ห้ามเปลี่ยนคนเป็นคนใหม่/);
  assert.match(appJs, /buildManualSupportTruthLine\(\)/);
});

test("manual create runtime no longer sends legacy background-locked prompt text", () => {
  assert.doesNotMatch(appJs, /Create a clean e-commerce catalog hero image on a warm white background/);
  assert.doesNotMatch(appJs, /same background, same lighting, and same catalog style/);
  assert.doesNotMatch(appJs, /Brand CI background:/);
  assert.doesNotMatch(appJs, /Global style rules:/);
  assert.doesNotMatch(appJs, /สินค้าเดี่ยวบนพื้นขาว/);
});
