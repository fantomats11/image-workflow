# Daily Report WordPress / AI HUB Image Workflow 15/06/26

## งานวันนี้

- ปรับ prompt framework สำหรับภาพสินค้าให้เป็น output ภาษาไทยสั้น กระชับ และลดบริบทที่ทำให้ AI ประมวลผลซับซ้อนเกินไป

- สรุปแนวทางภาพสินค้าใหม่เป็นระบบ Hero-first: ภาพ Hero เน้นไลฟ์สไตล์/ขายภาพหลัก ส่วนภาพ Support ต้องทำหน้าที่เพิ่มข้อมูล PDP จริง ไม่ซ้ำกับ Hero

- ปรับ logic support shot สำหรับสินค้าประเภทเสื้อ/outerwear ให้เน้น `side_fit_on_model`, `back_fit_on_model`, `lining_or_material_closeup`, `texture_extreme_closeup` และระวัง logo / patch / fill power / technology mark เช่น Omni-Heat, Gore-Tex, 600/700/800 fill

- ทดสอบ SKU `2DJ0493000` ผ่าน Fal และ AI HUB review flow โดยใช้ภาพ Hero และ support candidates ชุดใหม่เป็น case จริง

- พบปัญหา flow ผิด: ระบบนำ Hero + Support มาให้ review พร้อมกันก่อน Hero approval ซึ่งไม่ตรงกับ flow ที่ต้องการ

- แก้ flow กลับเป็น Hero Gate จริง: หน้า Review แสดงเฉพาะ Hero ก่อน, ซ่อน support candidates ก่อน approve, และให้ support เป็น pending plan หลัง Hero approval

- Persist review state ใหม่ใน Supabase สำหรับ batch `ai-hub-review-20260615-2DJ0493000`

- ปรับ LINE notification ให้ส่งเฉพาะข้อความ Hero Review + รูป Hero ไม่ส่งรูป support ปนก่อนเวลา

- แก้ Automation Inbox / Review API ให้ support count และ support assets ไม่โผล่ก่อนมี Hero approval

- แก้ batch id handling ให้ review URL ที่ใช้ `batch_key` สามารถ resolve เป็น UUID batch จริงก่อน enqueue automation task

- คุณกด `Approve hero` สำหรับ SKU `2DJ0493000` แล้ว ระบบบันทึกสถานะเป็น `hero_approved` และสร้าง task `support_after_hero_approval` แล้ว

- ตรวจพบ reference image แสดง 12 ภาพเพราะ duplicate จากชื่อไฟล์ 2 ชุด แต่ชี้ Drive file id เดียวกัน

- แก้ dedupe reference โดยใช้ `drive_file_id` หรือ URL เป็น source identity ก่อน filename ทำให้ Reference Set เหลือ 6 ภาพจริง

- Deploy production ขึ้น Render สำเร็จ:
  - `1f6ac31` Restore hero gate before support review
  - `b4c9a2b` Deduplicate hero review references

- รัน `npm run test:automation` ผ่านครบ 158 tests หลังแก้ flow และ dedupe

## ปัญหา/แนวทางแก้

- ปัญหา: Support candidates ถูกแสดงก่อน Hero approved ทำให้ทีมเข้าใจว่าเป็น Image Set Review ทั้งชุด

- แนวทางแก้: บังคับ Hero Review เป็น gate แรกเท่านั้น และให้ support generation/review เป็น phase ถัดไปหลัง approve

- ปัญหา: ข้อความ LINE รอบแรกส่งลิงก์/ภาพในลักษณะเหมือนให้ตรวจทั้งชุด

- แนวทางแก้: ปรับ LINE ให้เป็น notification surface สำหรับ Hero Review เท่านั้นใน phase นี้

- ปัญหา: Reference Set ซ้ำจากไฟล์เดียวกันแต่มีชื่อ 2 pattern เช่น `2DJ...` และ `01-2DJ...`

- แนวทางแก้: dedupe ด้วย identity ของไฟล์จริง เช่น Drive file id ก่อนใช้ filename

- ปัญหา: Approve Hero ตอนนี้สร้าง support execution plan/gate แล้ว แต่ยังไม่ยิง Fal live อัตโนมัติ

- แนวทางแก้: แยกเป็น next large build phase ชื่อ Live Support Generation Worker เพื่อให้กด Approve Hero แล้วเจน support จริง, persist asset จริง, และส่งต่อ Support Review

- ปัญหา: git index ในเครื่องมีอาการ dataless/compressed ทำให้ `git add/commit` ปกติ timeout

- แนวทางแก้: ใช้ temporary git index และ git plumbing เพื่อ commit/push เฉพาะไฟล์ที่เกี่ยวข้องโดยไม่แตะ unrelated files

## สถานะล่าสุด

- SKU test หลัก: `2DJ0493000`

- Hero Review URL พร้อมใช้งานบน production

- Hero status: `approved`

- Reference Set: 6 ภาพจริง หลัง dedupe

- Support phase: task ถูกสร้างแล้ว แต่ยังเป็น plan/gate ไม่ใช่ live Fal execution

- WordPress / WooCommerce / media attach / publish: ยังไม่ได้ทำ live writes

## แผนถัดไป

- สร้าง Live Support Generation Worker Phase ให้ `Approve hero` แล้วระบบยิง Fal support shots จริง

- เพิ่ม task type หรือ mode ใหม่สำหรับ support generation live โดยอ่าน approved hero anchor, reference images และ pending support shot plan

- Persist ผลลัพธ์ support ลง Supabase เป็น `generations` และ `assets` พร้อม provider request id, slot, prompt, cost, duration และ audit event

- เพิ่มหน้า `Support Review / SKU` สำหรับตรวจ support candidates หลังเจนเสร็จ พร้อม approve/regenerate รายภาพ

- ส่ง LINE ใหม่เฉพาะเมื่อ support generation เสร็จจริง เช่น `Support ready for review`

- เพิ่ม idempotency ป้องกันกด approve ซ้ำแล้วยิง Fal ซ้ำ

- รองรับ partial failure: ถ้า support shot บางภาพ fail ให้ระบบยัง review ภาพที่สำเร็จได้ และแสดง retry เฉพาะ shot ที่ fail

- หลัง Support approved แล้วค่อยต่อ media manifest / Google Drive export / WordPress media preflight ใน phase ถัดไป โดยยังคงเป็น proposal/dry-run ก่อน live publish
