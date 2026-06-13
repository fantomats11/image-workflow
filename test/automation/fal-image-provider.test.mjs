import assert from "node:assert/strict";
import test from "node:test";

import { buildFalImageInput } from "../../lib/automation/fal-image-provider.mjs";

test("fal image input uses budget quality default before high-quality override", () => {
  const input = buildFalImageInput(
    { prompt: "test prompt" },
    ["https://example.com/ref.jpg"],
    {
      AI_GENERATION_DEFAULT_QUALITY: "low",
      FAL_NUM_IMAGES: "1"
    }
  );

  assert.equal(input.image_size, "auto");
  assert.equal(input.quality, "low");
  assert.equal(input.num_images, 1);
});

test("fal image input allows explicit final-quality override", () => {
  const input = buildFalImageInput(
    { prompt: "test prompt" },
    ["https://example.com/ref.jpg"],
    {
      AI_GENERATION_DEFAULT_QUALITY: "low",
      FAL_IMAGE_QUALITY: "high",
      FAL_IMAGE_SIZE: "portrait_4_3",
      FAL_OUTPUT_FORMAT: "webp",
      FAL_NUM_IMAGES: "2"
    }
  );

  assert.equal(input.image_size, "portrait_4_3");
  assert.equal(input.quality, "high");
  assert.equal(input.output_format, "webp");
  assert.equal(input.num_images, 2);
});
