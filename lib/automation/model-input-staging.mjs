export const MODEL_INPUT_STAGING_TASK = "model_input_staging";

export function buildModelInputStagingManifest({
  referenceResolution = {},
  stagedFilesByDriveId = {},
  now = new Date()
} = {}) {
  const items = (referenceResolution.items || []).map((item) => buildStagingItem({ item, stagedFilesByDriveId }));
  return {
    manifest_type: MODEL_INPUT_STAGING_TASK,
    batch_id: referenceResolution.batch_id || null,
    dry_run: true,
    created_at: now.toISOString(),
    live_write_allowed: false,
    live_writes_enabled: false,
    staged_locally: true,
    proposed_execution_scope: "local_model_input_files",
    guardrails: [
      "local_files_only_no_model_generation",
      "only_stage_selected_product_reference_assets",
      "do_not_stage_label_or_tag_as_visual_truth",
      "record_file_hash_and_size_for_retry_safety"
    ],
    summary: summarizeItems(items),
    items
  };
}

function buildStagingItem({ item = {}, stagedFilesByDriveId = {} } = {}) {
  const selected = Array.isArray(item.selected_reference_assets) ? item.selected_reference_assets : [];
  const staged = selected.map((asset) => {
    const driveFileId = asset.drive_file_id || asset.id || "";
    const stagedFile = stagedFilesByDriveId[driveFileId] || null;
    return {
      drive_file_id: driveFileId,
      source_name: asset.name || "",
      source_mime_type: asset.mimeType || "",
      source_width: asset.width || 0,
      source_height: asset.height || 0,
      local_path: stagedFile?.local_path || "",
      file_name: stagedFile?.file_name || "",
      file_size: stagedFile?.file_size || 0,
      sha256: stagedFile?.sha256 || "",
      staged_at: stagedFile?.staged_at || null,
      staging_status: stagedFile?.local_path ? "staged_local_file" : "missing_staged_file"
    };
  });
  const missing = staged.filter((asset) => asset.staging_status !== "staged_local_file");

  return {
    sku: item.sku || "",
    brand_id: item.brand_id || "",
    target_site: item.target_site || "",
    product_name: item.product_name || "",
    reference_folder_id: item.reference_folder_id || "",
    staging_status: missing.length ? "needs_model_input_staging" : "model_inputs_staged",
    blockers: missing.length ? ["missing_staged_reference_file"] : [],
    selected_reference_count: selected.length,
    staged_reference_count: staged.length - missing.length,
    staged_reference_assets: staged
  };
}

function summarizeItems(items) {
  return {
    sku_count: items.length,
    model_inputs_staged: items.filter((item) => item.staging_status === "model_inputs_staged").length,
    needs_model_input_staging: items.filter((item) => item.staging_status !== "model_inputs_staged").length,
    selected_reference_assets: items.reduce((total, item) => total + item.selected_reference_count, 0),
    staged_reference_assets: items.reduce((total, item) => total + item.staged_reference_count, 0),
    missing_staged_reference_files: items.reduce(
      (total, item) => total + item.staged_reference_assets.filter((asset) => asset.staging_status !== "staged_local_file").length,
      0
    )
  };
}
