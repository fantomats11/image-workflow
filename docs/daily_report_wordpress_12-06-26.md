# Daily Report WordPress 12/06/26

## งานวันนี้

- ปรับ flow ตรวจ Hero จาก LINE Flex card เป็นรูปเต็มพร้อม Quick Reply เพื่อลดปัญหาภาพตกขอบและตรวจ reference ได้ละเอียดขึ้น

- เพิ่ม Quick Reply สำหรับ `Approve hero`, `Regenerate`, และ `Open review page`

- ตัด `Needs review` ออกจาก hero quick flow เพราะยังไม่ใช่ signal ที่พา automation ไป state ถัดไปได้ชัดเจน

- เพิ่มหน้า `Hero Review` บนเว็บสำหรับเปิดจาก LINE เพื่อเทียบ reference image กับ hero candidate แบบไม่ crop

- เชื่อมปุ่ม `Approve hero` บนหน้า review ให้บันทึก approval กลับเข้าระบบ

- เชื่อมปุ่ม `Regenerate` บนหน้า review ให้บันทึกคำขอ regenerate กลับเข้าระบบ

- ปรับ backend ให้รองรับ `/api/review/hero` และ `/api/review/hero/regenerate`

- ปรับ LINE postback handling ให้รองรับ `approve_hero` และ `regenerate_hero`

- ปรับ LINE payload generator ให้สร้างข้อความแบบ full image + quick reply แทนการใช้ Flex card เป็นหลัก

- เพิ่มการเลือก URL รูป reference โดยให้เลือก original/public URL ก่อน แล้วค่อย fallback เป็น thumbnail

- สร้าง dry-run LINE hero review payload ล่าสุดสำหรับ 4 SKU

- รัน `npm run test:automation` ผ่าน 129/129 tests

## ปัญหา/แนวทางแก้

- ปัญหา: Flex card สวยแต่ไม่เหมาะกับการ QC ละเอียด เพราะภาพ hero/ref อาจถูก crop หรือดูรายละเอียดโลโก้และ texture ได้ไม่ครบ

- แนวทางแก้: เปลี่ยนเป็น LINE image message แบบเต็มภาพ และให้หน้า review ใช้ `object-fit: contain`

- ปัญหา: Quick Reply จะหายหลังผู้ใช้กดหรือหลังมีข้อความใหม่ ทำให้ไม่ควรใช้เป็นพื้นที่ review ระยะยาว

- แนวทางแก้: ใช้ Quick Reply เป็น action signal เท่านั้น และใช้ `Open review page` เป็นหน้ากลางสำหรับกลับมากด approve/regenerate ได้อีก

- ปัญหา: `Needs review` ยังไม่ชัดว่าต้องทำอะไรต่อใน automation

- แนวทางแก้: ตัดออกจาก hero flow ชั่วคราว เหลือเฉพาะ action ที่นำไปสู่ state ถัดไปได้จริง

- ปัญหา: payload dry-run บางรายการยังใช้ local `asset_id` แทน `generation_id`

- แนวทางแก้: ตอนใช้งานจริงควรใช้ asset/generation ที่ persist ใน Supabase เพื่อให้ปุ่ม approve/regenerate resolve ได้ครบ

- ปัญหา: logo/brand mark บนสินค้าต้องตรวจละเอียด เพราะเป็นสินค้าแบรนด์เนมเช่าและจำหน่าย

- แนวทางแก้: ให้ review page แสดง reference + hero แบบเต็มภาพ และ prompt framework ต้อง preserve only visible real product marks ไม่ redraw logo จาก memory

- ปัญหา: local server verification ผ่าน curl ยังไม่ได้ยืนยัน end-to-end ในรอบนี้

- แนวทางแก้: ใช้ syntax/static/test verification ก่อน และให้ phase ถัดไปทดสอบบน Render/live LINE แบบ 1 SKU

## แผนถัดไป

- Deploy backend/frontend changes ไป Render ก่อนทดสอบ LINE postback จริง

- ส่ง LINE hero review จริงแบบจำกัด 1 SKU เพื่อทดสอบ end-to-end

- ทดสอบ `Open review page` จาก LINE ว่าเปิดหน้า review ได้ถูก SKU และโหลด hero/ref ถูกต้อง

- ทดสอบกด `Approve hero` จากหน้า review แล้วตรวจว่า approval ถูกบันทึกใน Supabase

- ทดสอบกด `Regenerate` จากหน้า review แล้วตรวจว่า automation task ถูก enqueue เป็น dry-run/review state

- ตรวจว่าเมื่อ hero approved แล้ว support generation plan ปลดล็อก และแนบ approved hero anchor เป็น input แรกก่อน reference images

- ตรวจ media manifest จาก Supabase จริง เพื่อลดปัญหา local `asset_id` ที่ไม่มี `generation_id`

- ทำ live pilot รอบเล็กสำหรับ support image หลัง hero approval

- สรุปผลคุณภาพภาพหลัง pilot โดยดูเรื่อง logo fidelity, model realism, fit/scale, และความไม่ซ้ำของ pattern

- ยังไม่ทำ WordPress/WooCommerce live write จนกว่าจะผ่าน preflight และมี final confirmation แยกต่างหาก
