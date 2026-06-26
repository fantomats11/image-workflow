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

test("manual create Support prompt uses approved Hero and Studio Master v3 contract", () => {
  assert.match(appJs, /อ้างอิงภาพหลักที่อนุมัติแล้ว Studio Master ที่อนุมัติแล้ว และภาพสินค้าจริงจากแคตตาล็อก\/Drive/);
  assert.match(appJs, /\[SPECIFIC_ANGLE\] = \$\{brief\.angle\}/);
  assert.match(appJs, /\[PRODUCT_CATEGORY\] = \$\{brief\.productCategory\}/);
  assert.match(appJs, /\[KEY_DETAIL\] = \$\{brief\.keyDetail\}/);
  assert.match(appJs, /สร้างภาพสนับสนุนหน้า PDP/);
  assert.match(appJs, /พื้นผิวสตูดิโอสีเทาอ่อนที่เรียบมินิมอล/);
  assert.match(appJs, /รูปจริงจากแคตตาล็อก\/Drive ใช้เป็น source of truth ของสินค้าเท่านั้น ไม่ใช้เป็น output โดยตรง/);
  assert.match(appJs, /ภาพต้องดูเป็นเซ็ตเดียวกับ Studio Master และ Hero/);
  assert.match(appJs, /Reference Image 1 คือภาพหลักที่อนุมัติแล้ว/);
  assert.match(appJs, /Reference Image 2 คือ Studio Master/);
  assert.match(appJs, /approvedStudioMasterImageUrl/);
  assert.match(appJs, /Strictly a single unified photograph/);
  assert.match(appJs, /buildManualSupportTruthLine\(shot\)/);
});

test("manual create Studio Master prompt uses the approved Hero and product truth contract", () => {
  assert.match(appJs, /function buildStudioMasterPrompt\(\)/);
  assert.match(appJs, /อ้างอิงภาพหลักที่อนุมัติแล้วและภาพสินค้าจริง/);
  assert.match(appJs, /สร้างภาพ Studio Master สำหรับหน้าสินค้า/);
  assert.match(appJs, /สวยพอใช้ใน gallery เว็บไซต์/);
  assert.match(appJs, /Reference Image 2 เป็นต้นไปคือภาพสินค้าจริง/);
  assert.match(appJs, /ไม่ต้องทำ collage/);
});

test("manual create runtime no longer sends legacy background-locked prompt text", () => {
  assert.doesNotMatch(appJs, /Create a clean e-commerce catalog hero image on a warm white background/);
  assert.doesNotMatch(appJs, /same background, same lighting, and same catalog style/);
  assert.doesNotMatch(appJs, /Brand CI background:/);
  assert.doesNotMatch(appJs, /Global style rules:/);
  assert.doesNotMatch(appJs, /สินค้าเดี่ยวบนพื้นขาว/);
});
