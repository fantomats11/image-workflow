export const AI_HUB_IMAGE_REVIEW_BUNDLE_MANIFEST = "ai_hub_product_image_review_bundle";

const BASE_QC_CHECKS = [
  "product_color_shape_material_matches_reference",
  "product_is_main_focus",
  "same_set_as_approved_hero_when_available",
  "no_text_overlay",
  "no_grid_collage_or_split_panels",
  "clean_realistic_product_page_image"
];

const MARKING_QC_CHECKS = [
  "visible_real_logo_patch_markings_if_present",
  "technical_marking_or_fill_power_accuracy_if_visible",
  "no_new_text_numbers_logo_or_patch"
];

const HUMAN_BLOCKING_FLAG_OPTIONS = [
  "product_truth_mismatch",
  "missing_required_logo_patch_or_marking",
  "invented_text_number_logo_or_patch",
  "wrong_slot_role_or_camera_angle",
  "not_same_set_as_approved_hero",
  "product_blocked_or_occluded",
  "grid_collage_or_text_overlay"
];

export function buildAiHubImageReviewBundle({
  generationPlan = {},
  executionArtifacts = [],
  now = new Date()
} = {}) {
  const planItems = Array.isArray(generationPlan.items) ? generationPlan.items : [];
  const executionIndex = buildExecutionResultIndex(executionArtifacts);
  const reviewItems = planItems.map((item) => buildReviewItem({ item, executionIndex }));
  const reviewAssets = reviewItems.flatMap((item) => item.review_assets);

  return {
    manifest_type: AI_HUB_IMAGE_REVIEW_BUNDLE_MANIFEST,
    version: "ai-hub-image-review-bundle-v1.0",
    created_at: now.toISOString(),
    source_plan: {
      task_type: generationPlan.task_type || null,
      batch_id: generationPlan.batch_id || null,
      created_at: generationPlan.created_at || null,
      prompt_framework_versions: collectPromptFrameworkVersions(planItems)
    },
    dry_run: true,
    live_write_allowed: false,
    guardrails: [
      "local_review_only_no_wordpress_or_db_write",
      "generated_images_cannot_override_reference_truth",
      "approve_before_publish_or_media_attach",
      "technical_markings_require_human_qc",
      "review_bundle_is_append_only_audit_input"
    ],
    summary: summarizeReviewAssets(reviewItems, reviewAssets),
    review_items: reviewItems
  };
}

function buildReviewItem({ item, executionIndex }) {
  const requests = Array.isArray(item.generation_requests) ? item.generation_requests : [];
  const reviewAssets = requests.map((request) => buildReviewAsset({
    request,
    item,
    executionResult: executionIndex.get(request.request_id) || null
  }));

  return {
    sku: item.sku || "",
    brand_id: item.brand_id || "",
    brand_label: item.brand_label || "",
    target_site: item.target_site || "",
    product_name: item.product_name || "",
    product_type: item.product_type || "",
    category: item.category || "",
    subcategory: item.subcategory || "",
    reference_source_type: item.reference_source_type || "",
    approved_hero_anchor: item.approved_hero_anchor || null,
    support_shots: Array.isArray(item.support_shots) ? item.support_shots : [],
    review_status: resolveItemReviewStatus(reviewAssets),
    review_assets: reviewAssets
  };
}

function buildReviewAsset({ request, item, executionResult }) {
  const generatedAsset = pickGeneratedAsset(executionResult);
  const generatedImage = pickGeneratedImage(executionResult);
  const generated = buildGeneratedBlock({ executionResult, generatedAsset, generatedImage });
  const requiredChecks = buildRequiredChecks(request);
  const reviewStatus = resolveAssetReviewStatus({ request, executionResult, generatedAsset, generatedImage });

  return {
    review_asset_id: request.request_id || `${item.sku || "unknown"}:${request.slot || "unknown"}`,
    request_id: request.request_id || null,
    sku: request.sku || item.sku || "",
    kind: request.kind || "",
    slot: request.slot || "",
    sequence: request.sequence || null,
    priority_required: Boolean(request.priority_required),
    prompt_framework_version: request.prompt_framework_version || null,
    prompt: request.prompt || "",
    model: request.model || null,
    model_policy: request.model_policy || null,
    visual_variation: request.visual_variation || null,
    request_status: request.request_status || "",
    request_blockers: Array.isArray(request.blockers) ? request.blockers : [],
    model_input_files: Array.isArray(request.model_input_files) ? request.model_input_files : [],
    approved_hero_anchor: request.approved_hero_anchor || item.approved_hero_anchor || null,
    reference_assets: Array.isArray(request.reference_assets) ? request.reference_assets : [],
    generated,
    qc: {
      review_status: reviewStatus,
      required_checks: requiredChecks,
      human_blocking_flag_options: buildBlockingFlagOptions(requiredChecks),
      suggested_regeneration_reasons: buildSuggestedRegenerationReasons(request),
      reviewer_notes: ""
    },
    review_actions: [
      "approve_asset",
      "regenerate_slot",
      "reject_asset",
      "needs_manual_review"
    ]
  };
}

function buildGeneratedBlock({ executionResult, generatedAsset, generatedImage }) {
  if (!executionResult) {
    return {
      status: "not_executed",
      provider_request_id: null,
      source_url: "",
      local_path: "",
      file_name: "",
      mime_type: "",
      file_size: 0,
      image_index: null
    };
  }

  return {
    status: executionResult.execution_status || "unknown",
    provider_request_id: executionResult.provider_request_id || null,
    source_url: generatedAsset?.source_url || generatedImage?.url || "",
    local_path: generatedAsset?.local_path || generatedImage?.local_path || "",
    file_name: generatedAsset?.file_name || generatedImage?.file_name || "",
    mime_type: generatedAsset?.mime_type || generatedImage?.contentType || generatedImage?.content_type || "",
    file_size: generatedAsset?.file_size || generatedImage?.file_size || 0,
    image_index: generatedAsset?.image_index || (Number.isFinite(Number(generatedImage?.index)) ? Number(generatedImage.index) + 1 : null)
  };
}

function buildExecutionResultIndex(executionArtifacts) {
  const index = new Map();
  executionArtifacts.flatMap(collectExecutionResults).forEach((result) => {
    if (result?.request_id) index.set(result.request_id, result);
  });
  return index;
}

function collectExecutionResults(artifact) {
  if (!artifact || typeof artifact !== "object") return [];
  if (Array.isArray(artifact.execution?.results)) return artifact.execution.results;
  if (Array.isArray(artifact.results)) return artifact.results;
  return [];
}

function pickGeneratedAsset(executionResult) {
  return Array.isArray(executionResult?.generated_assets) ? executionResult.generated_assets[0] || null : null;
}

function pickGeneratedImage(executionResult) {
  return Array.isArray(executionResult?.generated_images) ? executionResult.generated_images[0] || null : null;
}

function resolveAssetReviewStatus({ request, executionResult, generatedAsset, generatedImage }) {
  if (Array.isArray(request.blockers) && request.blockers.length) return "blocked_before_generation";
  if (!executionResult) return "missing_execution_result";
  if (executionResult.execution_status === "failed") return "generation_failed";
  if (executionResult.execution_status === "skipped") return "generation_skipped";
  if (!generatedAsset && !generatedImage) return "missing_generated_asset";
  return "pending_human_qc";
}

function resolveItemReviewStatus(reviewAssets) {
  if (!reviewAssets.length) return "no_review_assets";
  if (reviewAssets.every((asset) => asset.qc.review_status === "pending_human_qc")) return "pending_human_qc";
  if (reviewAssets.some((asset) => asset.qc.review_status === "pending_human_qc")) return "partially_pending_human_qc";
  return "needs_generation_or_review";
}

function buildRequiredChecks(request) {
  const checks = new Set(BASE_QC_CHECKS);
  const slot = String(request.slot || "");
  const prompt = String(request.prompt || "");
  const kind = String(request.kind || "");

  if (kind === "support") checks.add("support_slot_adds_new_product_information");
  if (request.approved_hero_anchor) checks.add("approved_hero_anchor_used_as_visual_anchor");
  if (isModelFitSlot(slot)) {
    checks.add("on_model_fit_and_scale_are_clear");
    checks.add("no_bag_scarf_prop_or_pose_occludes_product");
  }
  if (isSideSlot(slot)) {
    checks.add("side_or_45_degree_angle_is_clear");
    checks.add("length_thickness_and_side_shape_are_visible");
  }
  if (isBackSlot(slot)) {
    checks.add("back_view_is_clear");
    checks.add("rear_design_hood_closure_length_and_seams_visible");
  }
  if (isDetailSlot(slot)) {
    checks.add("extreme_closeup_not_full_body_or_new_scene");
    checks.add("material_lining_texture_or_construction_detail_visible");
    checks.add("detail_image_still_feels_from_same_product_set");
  }
  if (needsMarkingChecks(slot, prompt)) {
    MARKING_QC_CHECKS.forEach((check) => checks.add(check));
  }

  return Array.from(checks);
}

function buildBlockingFlagOptions(requiredChecks) {
  const flags = new Set(HUMAN_BLOCKING_FLAG_OPTIONS);
  if (requiredChecks.includes("extreme_closeup_not_full_body_or_new_scene")) flags.add("detail_shot_not_extreme_closeup");
  if (requiredChecks.includes("side_or_45_degree_angle_is_clear")) flags.add("side_angle_missing_or_too_front_facing");
  if (requiredChecks.includes("back_view_is_clear")) flags.add("back_view_missing_or_logo_patch_wrong");
  return Array.from(flags);
}

function buildSuggestedRegenerationReasons(request) {
  const slot = String(request.slot || "");
  const reasons = [
    "product_truth_mismatch",
    "not_same_set_as_approved_hero",
    "product_not_main_focus"
  ];
  if (isModelFitSlot(slot)) reasons.push("model_pose_or_prop_blocks_product");
  if (isSideSlot(slot)) reasons.push("side_angle_does_not_show_thickness_length_or_sleeve_marking");
  if (isBackSlot(slot)) reasons.push("back_view_missing_rear_logo_patch_hood_or_length");
  if (isDetailSlot(slot)) reasons.push("needs_tighter_extreme_closeup_or_material_detail");
  if (needsMarkingChecks(slot, request.prompt)) reasons.push("logo_patch_number_or_technical_text_wrong");
  return Array.from(new Set(reasons));
}

function summarizeReviewAssets(reviewItems, reviewAssets) {
  const generatedAssetCount = reviewAssets.filter((asset) => asset.generated.source_url || asset.generated.local_path).length;
  const pendingHumanQc = reviewAssets.filter((asset) => asset.qc.review_status === "pending_human_qc").length;
  const missingGeneratedAsset = reviewAssets.filter((asset) => (
    asset.qc.review_status === "missing_execution_result" ||
    asset.qc.review_status === "missing_generated_asset"
  )).length;

  return {
    sku_count: reviewItems.length,
    review_asset_count: reviewAssets.length,
    generated_asset_count: generatedAssetCount,
    missing_generated_asset_count: missingGeneratedAsset,
    pending_human_qc: pendingHumanQc,
    blocked_or_skipped_count: reviewAssets.filter((asset) => (
      asset.qc.review_status === "blocked_before_generation" ||
      asset.qc.review_status === "generation_skipped" ||
      asset.qc.review_status === "generation_failed"
    )).length,
    priority_review_asset_count: reviewAssets.filter((asset) => asset.priority_required).length,
    technical_marking_qc_required: reviewAssets.filter((asset) => (
      asset.qc.required_checks.includes("technical_marking_or_fill_power_accuracy_if_visible")
    )).length
  };
}

function collectPromptFrameworkVersions(items) {
  const versions = new Set();
  items.forEach((item) => {
    (item.generation_requests || []).forEach((request) => {
      if (request.prompt_framework_version) versions.add(request.prompt_framework_version);
    });
  });
  return Array.from(versions);
}

function isModelFitSlot(slot) {
  return /fit|wear|on_model|side|back|front/i.test(slot);
}

function isSideSlot(slot) {
  return /side|45|profile|thickness|length/i.test(slot);
}

function isBackSlot(slot) {
  return /back|rear|hood|closure/i.test(slot);
}

function isDetailSlot(slot) {
  return /material|lining|texture|closeup|detail|inside|construction|technology|tech/i.test(slot);
}

function needsMarkingChecks(slot, prompt) {
  return /logo|patch|marking|technical|fill|power|omni|gore|โลโก้|แพตช์|ตัวเลข|ข้อความเทคนิค|เทคโนโลยี/i.test(`${slot} ${prompt}`);
}
