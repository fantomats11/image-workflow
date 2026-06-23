# Batch Review Smoke Test

Last updated: 2026-06-23

เอกสารนี้ใช้ตรวจหน้า Batch Review ชั่วคราว/production หลังเพิ่ม route `#batch?batch_id=<batchId>` โดยยังไม่เปิด WordPress/WooCommerce live write

## Preconditions

- Login ด้วยบัญชี `staff` หรือ `admin` ที่ active แล้ว
- มี LINE keyword batch ในระบบ เช่น batch จากคำสั่ง `BATCH รองเท้า=1 เสื้อ=1`
- ใช้ batch id หรือ batch key ที่ได้จาก LINE/Admin/API

## Manual Smoke

1. เปิด URL:

```text
https://image-workflow.onrender.com/#batch?batch_id=<batchId>
```

2. ระหว่างโหลด ต้องเห็นข้อความ:

```text
กำลังโหลด Batch...
```

3. เมื่อโหลดสำเร็จ ต้องเห็น:

- Batch ID แบบสั้น
- Source เป็น `LINE`
- Request เดิม เช่น `BATCH รองเท้า=1 เสื้อ=1`
- สถานะภาษาไทย
- ขั้นตอนถัดไปภาษาไทย
- Primary CTA 1 ปุ่มเท่านั้น
- Progress summary
- SKU cards ไม่ใช่ตาราง

4. ตรวจ SKU card แต่ละใบ:

- แสดง `SKU`
- แสดงชื่อสินค้า
- แสดง branch หรือ brand label
- แสดง category/subcategory เท่าที่ API มี
- แสดง reference status
- แสดง Hero status
- แสดง Support status
- แสดง blocker ถ้ามี
- แสดง `skip_item` หรือ `retry_item` เฉพาะเมื่อ API อนุญาต

5. ถ้า state เป็น `ready_to_confirm`:

- Primary CTA ต้องเป็น `ตรวจรายการแล้วเริ่ม Hero`
- กดแล้วต้องเรียก `POST /api/automation/batches/:batchId/confirm`
- หลังสำเร็จ page ต้อง refresh payload และเปลี่ยนสถานะตาม API

6. ถ้า state เป็น `hero_waiting_review` หรือ `support_waiting_review`:

- Primary CTA ต้องพาไปหน้า `#review?...`

7. ถ้า batch ถูกยกเลิก:

- ต้องเห็นสถานะยกเลิก
- ต้องไม่มี CTA ที่เริ่ม generation ต่อ

8. ใช้บัญชี `staff` ตรวจว่าไม่เห็น:

- raw queue task id
- provider payload
- prompt internals
- debug drawer

9. ใช้บัญชี `admin` ตรวจว่า:

- debug drawer แสดงได้
- drawer ต้อง collapsed by default

## Error Smoke

1. เปิด batch ที่ไม่มีจริง:

```text
/#batch?batch_id=missing-batch
```

ต้องเห็นข้อความแนว:

```text
ไม่พบ Batch นี้ กรุณาตรวจลิงก์จาก LINE อีกครั้ง
```

2. เปิดโดยยังไม่ login:

- ต้องผ่าน auth gate เดิมก่อน
- หลัง login แล้ว deep link ต้องยังเปิดหน้า Batch Review ได้

## Commands

หลังแก้ frontend ให้รัน:

```bash
npm run test:automation
npm test
```

## Out of Scope

- ไม่ทดสอบ WordPress/WooCommerce live write
- ไม่เปลี่ยน Prompt Framework rules
- ไม่ redesign หน้า Jobs/Assets/KPI/Monitoring
