export const catalogAuditRows = [
  {
    sku: "RAC-COAT-001",
    product_type: "rental",
    target_site: "rentacoat",
    wp_product_name: "เสื้อโค้ทกันหนาวขนเฟอร์",
    wp_category: "เสื้อ",
    wp_subcategory: "โค้ท",
    automation_action: "generate_then_publish_or_attach_after_review",
    woo_status: "not_found",
    woo_product_ids: ""
  },
  {
    sku: "RAC-GLOVE-001",
    product_type: "rental",
    target_site: "rentacoat",
    wp_product_name: "ถุงมือกันหนาวบุขน",
    wp_category: "ถุงมือกันหนาว",
    wp_subcategory: "ถุงมือ",
    automation_action: "generate_then_publish_or_attach_after_review",
    woo_status: "not_found",
    woo_product_ids: ""
  },
  {
    sku: "GM-SWEATER-001",
    product_type: "sale",
    target_site: "gomall",
    wp_product_name: "สเวตเตอร์ไหมพรมกันหนาว",
    wp_category: "เสื้อ",
    wp_subcategory: "สเวตเตอร์",
    automation_action: "generate_then_publish_or_attach_after_review",
    woo_status: "not_found",
    woo_product_ids: ""
  },
  {
    sku: "GM-HAT-001",
    product_type: "sale",
    target_site: "gomall",
    wp_product_name: "หมวกไหมพรมกันหนาว",
    wp_category: "หมวกกันหนาว",
    wp_subcategory: "หมวก",
    automation_action: "generate_then_publish_or_attach_after_review",
    woo_status: "not_found",
    woo_product_ids: ""
  },
  {
    sku: "GM-EXIST-001",
    product_type: "sale",
    target_site: "gomall",
    wp_product_name: "สินค้าที่มีอยู่แล้ว",
    wp_category: "เสื้อ",
    wp_subcategory: "แจ็กเก็ต",
    automation_action: "generate_then_publish_or_attach_after_review",
    woo_status: "found",
    woo_product_ids: "123"
  }
];

export const generationRows = [
  {
    sku: "RAC-COAT-001",
    product_name: "เสื้อโค้ทกันหนาวขนเฟอร์",
    category: "เสื้อ",
    subcategory: "โค้ท",
    generation_status: "ready_via_drive_folder_lookup",
    reference_lookup_strategy: "drive_folder",
    reference_parent_folder_id: "folder-rac",
    reference_lookup_key: "RAC-COAT-001"
  },
  {
    sku: "RAC-GLOVE-001",
    product_name: "ถุงมือกันหนาวบุขน",
    category: "ถุงมือกันหนาว",
    subcategory: "ถุงมือ",
    generation_status: "ready_via_drive_folder_lookup",
    reference_lookup_strategy: "drive_folder",
    reference_parent_folder_id: "folder-rac",
    reference_lookup_key: "RAC-GLOVE-001"
  },
  {
    sku: "GM-SWEATER-001",
    product_name: "สเวตเตอร์ไหมพรมกันหนาว",
    category: "เสื้อ",
    subcategory: "สเวตเตอร์",
    generation_status: "ready_via_drive_folder_lookup",
    reference_lookup_strategy: "drive_folder",
    reference_parent_folder_id: "folder-gomall",
    reference_lookup_key: "GM-SWEATER-001"
  },
  {
    sku: "GM-HAT-001",
    product_name: "หมวกไหมพรมกันหนาว",
    category: "หมวกกันหนาว",
    subcategory: "หมวก",
    generation_status: "ready_via_drive_folder_lookup",
    reference_lookup_strategy: "drive_folder",
    reference_parent_folder_id: "folder-gomall",
    reference_lookup_key: "GM-HAT-001"
  }
];
