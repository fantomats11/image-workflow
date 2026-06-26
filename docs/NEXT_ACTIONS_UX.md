# Next Actions UX

เอกสารนี้อธิบายหน้าเริ่มต้นของ operator สำหรับ production pilot ปัจจุบัน เป้าหมายคือให้ staff/admin เปิดระบบแล้วเห็นงานที่ต้องทำต่อทันที โดยไม่ต้องเดาว่าควรเริ่มจาก dashboard, form manual, หรือ Monitoring

## Default route

- ถ้า URL เป็น deep link เช่น `#batch?batch_id=<batchId>` ระบบต้องเปิด Batch Review ทันที
- ถ้า URL เป็น `#review?...` ระบบต้องเปิดหน้า Review ตามเดิม
- ถ้า login แล้วไม่มี deep link งานเฉพาะ ระบบจะเปิด `#next`
- Dashboard เดิมยังอยู่ที่ `#jobs`
- Manual generation เดิมยังอยู่ที่ `#create`
- หน้า admin เช่น `#settings`, `#monitoring`, `#costs` ยังมีอยู่ แต่ไม่ใช่ default ของ staff

## Data source

หน้า `#next` ใช้ `/api/jobs` เป็นแหล่งข้อมูลเดียวกับ Jobs โดยดึงช่วงล่าสุดเพื่อไม่ให้ซ่อนงานค้างจากวันก่อน หน้านี้ไม่สร้าง generation เอง และไม่เรียก WordPress live write

## State mapping

| Card | เงื่อนไขหลัก | ปุ่ม |
| --- | --- | --- |
| รอตรวจ Batch | `batchWorkflowState` เป็น `draft_created`, `waiting_batch_review`, `ready_to_confirm` หรือ `batchWorkflowNextAction` ชี้ไป Batch Review/confirm | เปิดงานที่ต้องทำ |
| รอตรวจ Hero | `workflowState` เป็น `hero_waiting_review` หรือ job มี Hero พร้อม review | เปิดงานที่ต้องทำ |
| Hero approved แล้ว พร้อมสร้าง Support | `workflowState` เป็น `hero_approved`, `support_ready`, `support_queued`, `support_generating` หรือ job อนุมัติ Hero แล้วแต่ยังไม่มี Support | เปิดงานที่ต้องทำ |
| รอตรวจ Support | `workflowState` เป็น `support_waiting_review` หรือ job มี Support แล้วแต่ยังไม่ approve | เปิดงานที่ต้องทำ |
| พร้อมเตรียมลง WordPress | มี Drive/export link, media preflight ready, หรือ preflight/proposal status พร้อม โดยยังไม่ใช่ live write | ไปทำงานนี้ |
| ส่งออกไฟล์ไม่สำเร็จ | `exportStatus` มี `failed/error/blocked` หรือ `canRetryExport=true` | ไปทำงานนี้ |
| งานไม่สำเร็จที่ต้องตรวจ | `workflowState` เป็น `hero_failed`, `support_failed`, `failed`, `partially_failed` หรือ status ฝั่ง generation เป็น failed | ไปทำงานนี้ |

แต่ละ card มี primary CTA เพียงปุ่มเดียวเพื่อไม่ให้ staff ต้องเลือก action เชิงเทคนิคเอง

## Staff behavior

- Staff เห็นเฉพาะ action cards ที่ต้องทำต่อ
- Staff ไม่เห็น recovery button เช่น retry export หรือ mark failed บนหน้า `#next`
- ถ้า staff เปิด direct hash ไปหน้า admin-only ระบบจะพากลับ `#next`
- ถ้าไม่มีงาน ระบบแสดง empty state พร้อมปุ่ม `เริ่มงานภาพใหม่` และ `ดูงานทั้งหมด`

## Admin behavior

- Admin เห็นหน้า `#next` เป็น default เหมือน staff
- Admin ยังเข้า `#settings`, `#monitoring`, `#costs` ได้จาก sidebar
- Admin เห็น `สรุปสำหรับผู้ดูแล` แบบสั้นเมื่อมีปัญหาส่งออก งานไม่สำเร็จ หรือ recovery action แต่ summary นี้ไม่แทนที่ Monitoring

## Manual smoke test

1. Login ด้วย staff โดยไม่มี hash เฉพาะ ควรเปิด `#next`
2. Login ด้วย admin โดยไม่มี hash เฉพาะ ควรเปิด `#next` และยังเห็นเมนู admin
3. เปิด deep link `/#batch?batch_id=<batchId>` ควรเปิด Batch Review ไม่ถูก redirect ไป `#next`
4. เปิด deep link `/#review?generation_id=<generationId>&sku=<sku>` ควรเปิดหน้า Review ไม่ถูก redirect ไป `#next`
5. Staff เปิด `/#monitoring` ควรถูก redirect กลับ `#next`
6. ถ้า `/api/jobs` ไม่มีงาน actionable ควรเห็น empty state
7. ถ้า `/api/jobs` ส่งงาน failed/export failed ควรเห็น card ที่เกี่ยวข้อง และปุ่มเดียวคือ `ไปทำงานนี้`
8. ถ้างานมี Drive/export link หรือ media preflight พร้อม ควรเห็น card `พร้อมเตรียมลง WordPress` โดยไม่มี live write action

## Known limitation

- หน้า `#next` ใช้ `/api/jobs` เป็น source หลัก หากมี Batch ที่เพิ่งสร้างแต่ยังไม่ปรากฏใน Jobs จะยังต้องเข้าผ่าน LINE deep link ไป `#batch?batch_id=...`
- หน้า `#next` ยังไม่แทน Monitoring หรือ admin recovery workflow ทั้งหมด เป็นเพียงหน้าเริ่มต้นสำหรับ operator
- WordPress readiness ในหน้านี้หมายถึง preflight/proposal readiness เท่านั้น ไม่ใช่ WooCommerce live publish
