# Troubleshooting: คู่มือแก้ปัญหา image-workflow

ใช้เอกสารนี้เมื่อระบบทำงานไม่ตรง expected behavior ใน production ให้เริ่มจากอาการที่ใกล้เคียงที่สุด แล้ว capture ข้อมูลก่อนแจ้ง admin/dev

## ข้อมูลที่ควร capture ก่อนแจ้ง dev/admin

| ข้อมูล | จำเป็นเมื่อไหร่ | ตัวอย่าง |
| --- | --- | --- |
| screenshot | ทุกเคส | หน้าที่ error หรือ status ค้าง |
| job id | งาน generate/approve/export/library | จาก **งานทั้งหมด** หรือ **คลังภาพ** |
| generation id | งาน generation/support/export | จาก **คลังภาพ** หรือปุ่ม copy |
| email user | ทุกเคส auth/role/workflow | `staff@example.com` |
| เวลาเกิดปัญหา | ทุกเคส | 2026-05-08 14:20 Asia/Bangkok |
| page URL | ทุกเคส | production URL + `#create` |
| Network request | API/error cases | endpoint, status code, response JSON/HTML |

## Login ไม่ได้

สิ่งที่ต้องเห็น: ใส่ email/password แล้วเข้าหน้า **สร้างภาพ**

ถ้าไม่เป็นแบบนี้ให้ทำอะไร:

1. ตรวจ email ว่าสะกดถูก
2. ตรวจ password ว่าเป็นตัวล่าสุด
3. hard refresh แล้วลองใหม่
4. ให้ admin ตรวจว่า user เป็น active
5. ถ้ายังไม่ได้ ให้ admin reset temporary password

ข้อมูลที่ต้องส่ง: email user, screenshot, เวลา, ข้อความ error

## Temporary password ใช้ไม่ได้

สิ่งที่ต้องเห็น: login ด้วย temporary password แล้วเจอหน้าตั้ง password ใหม่

ถ้าไม่เป็นแบบนี้ให้ทำอะไร:

| สาเหตุที่พบบ่อย | วิธีแก้ |
| --- | --- |
| ใช้ temporary password เก่า | ให้ admin reset ใหม่ |
| user inactive | admin ต้องเปิด active ก่อน |
| copy password มีช่องว่าง | พิมพ์ใหม่หรือ copy แบบไม่มี space |
| password ใหม่สั้นเกิน 8 ตัว | ตั้งใหม่ให้ยาวพอ |

ข้อมูลที่ต้องส่ง: email user, เวลาที่ reset, screenshot หน้า error

## Staff ไม่เห็น Settings เป็นเรื่องปกติ

สิ่งที่ต้องเห็น: staff เห็นเฉพาะ **สร้างภาพ**, **งานทั้งหมด**, **คลังภาพ**, **KPI Dashboard**

ถ้าไม่เป็นแบบนี้ให้ทำอะไร: ไม่ต้องแก้ ถ้า staff ต้องการ reset password/Drive/Monitoring ให้ติดต่อ admin

## Staff เห็นหน้า admin เป็นปัญหา

อาการ: staff เห็นเมนู **ตั้งค่า**, **Monitoring**, หรือ **Costs** หรือเปิดหน้าเหล่านี้ได้

ให้ทำทันที:

1. ให้ user หยุดใช้งาน
2. Admin ตรวจ role ใน **ตั้งค่า** > **Staff Management**
3. เปลี่ยน role กลับเป็น `staff` ถ้าผิด
4. ถ้ายังเห็นหลังแก้ role ให้ปิด active ชั่วคราว
5. แจ้ง dev เป็น critical issue

ข้อมูลที่ต้องส่ง: screenshot เมนู/หน้า admin, email user, role ปัจจุบัน, เวลา

## Generate ค้าง

อาการ: กด **Generate Hero** หรือ **Generate Support Set** แล้ว loading นานผิดปกติ

สิ่งที่ต้องเห็น: หลังสร้างเสร็จควรมีภาพ generated/hero_ready หรือ support gallery

ถ้าไม่เป็นแบบนี้ให้ทำอะไร:

1. อย่ากด Generate ซ้ำระหว่างยัง loading
2. รออีกเล็กน้อยถ้าเพิ่งกด
3. เปิด **งานทั้งหมด** แล้วค้นหา SKU/job id
4. Admin เปิด **Monitoring / System Health** ดู Likely stuck jobs
5. ถ้างาน stuck นานและมีปุ่ม **Retry** ให้ admin พิจารณา Retry
6. ถ้าเกิดหลายงานติดกัน ให้หยุดให้ทีม generate เพิ่มและแจ้ง dev

ข้อมูลที่ต้องส่ง: job id, generation id, SKU, screenshot, เวลา, user email

## Approve ค้าง

อาการ: กด **Approve + Save** หรือ **Approve Support Set** แล้วไม่จบ ไม่มี export link หรือสถานะไม่เปลี่ยน

สิ่งที่ต้องเห็น: งานเป็น approved/exported และมี **Open Drive** หรือ **Open export** เมื่องาน export สำเร็จ

ถ้าไม่เป็นแบบนี้ให้ทำอะไร:

1. อย่ากด approve ซ้ำทันที
2. กด refresh ใน **งานทั้งหมด**
3. เปิด **คลังภาพ** tab **Approved / Exported**
4. ถ้าไม่มี Drive/export link ให้ admin ตรวจ Google Drive health
5. ถ้างาน approve/generated แล้วแต่ export หาย ให้ admin พิจารณา **Retry Export**

ข้อมูลที่ต้องส่ง: job id, generation id, screenshot ก่อน/หลัง approve, เวลา

## รูปไม่เข้า Google Drive

สิ่งที่ต้องเห็น: หลัง approve ควรมี **Open Drive** ใน **คลังภาพ** หรือ **Open export** ใน **งานทั้งหมด**

ถ้าไม่เป็นแบบนี้ให้ทำอะไร:

1. Admin ตรวจ **ตั้งค่า** > **Google Drive Integration**
2. Admin ตรวจ **Monitoring / System Health** > Google Drive health
3. ตรวจว่า Drive connected
4. ถ้า Drive disconnected ให้เชื่อม OAuth ใหม่
5. ถ้า connected แต่งานไม่มี link ให้ใช้ **Retry Export** เมื่อมี approved/generated source

ข้อมูลที่ต้องส่ง: job id, generation id, export status, screenshot Monitoring

## Google Drive disconnected

สิ่งที่ต้องเห็น: Google Drive health เป็น connected

ถ้า disconnected:

1. Admin เข้า **ตั้งค่า**
2. กด **เชื่อมต่อ Google Drive**
3. เลือกบัญชี Google ที่มีสิทธิ์ folder ปลายทาง
4. กลับมาตรวจ **Monitoring / System Health**
5. Retry Export เฉพาะงานที่ approve แล้วแต่ยังไม่มี Drive link

ถ้าไม่สำเร็จ: ตรวจ Render env สำหรับ Google OAuth config และ Drive root folder id

## Supabase Storage warning แต่ Drive export สำเร็จ

อาการ: Monitoring แสดง warning ประมาณ Supabase Storage failed แต่ Google Drive export สำเร็จ

สิ่งที่ต้องเข้าใจ:

- ถ้ามี **Open Drive** และเปิดได้ งานปลายทางถือว่าส่งออกสำเร็จ
- preview ใน **คลังภาพ** อาจไม่ขึ้นหรือใช้ fallback preview
- ไม่ต้องกด Retry Export ถ้า Drive link ดีอยู่แล้ว

ถ้าไม่เป็นแบบนี้ให้ทำอะไร: ถ้าไม่มีทั้ง preview และ Open Drive ให้ admin treat เป็น critical export/storage issue

## Asset Library preview ไม่ขึ้น

สิ่งที่ต้องเห็น: card ใน **คลังภาพ** แสดงภาพ preview หรืออย่างน้อยมีปุ่ม **Open image** / **Open Drive**

ถ้าไม่เป็นแบบนี้ให้ทำอะไร:

| อาการ | วิธีแก้ |
| --- | --- |
| preview ไม่ขึ้นแต่ Open Drive มี | เปิด Drive แทน และบันทึก storage warning ถ้ามี |
| ไม่มี preview และไม่มี Open Drive | ตรวจ export status ใน **งานทั้งหมด** |
| ค้นหาไม่เจอ | เปลี่ยนช่วงเวลาเป็น All time และค้นด้วย job id/generation id |
| references ไม่แสดง | เลือก tab **References** |

## Jobs status ไม่ตรง

อาการ: งานดูเหมือน approve แล้ว แต่หน้า **งานทั้งหมด** ยัง pending หรือ export ไม่ขึ้น

ถ้าไม่เป็นแบบนี้ให้ทำอะไร:

1. กด **รีเฟรช** ที่หน้า **งานทั้งหมด**
2. ตรวจช่วงเวลาให้ถูก
3. เปิด **คลังภาพ** เทียบ job id/generation id
4. Admin ตรวจ **Monitoring / System Health**
5. ถ้าสถานะยังไม่ตรง ให้แจ้ง dev พร้อมข้อมูลครบ

## Costs ไม่ขึ้นหลัง generate

สิ่งที่ต้องเห็น: **Costs** แสดง estimated usage ตามช่วงเวลาที่เลือก

ถ้าไม่เป็นแบบนี้ให้ทำอะไร:

1. ตรวจว่า login เป็น admin
2. เปลี่ยนช่วงเวลาเป็น Last 7 days หรือ All time
3. กด **รีเฟรช**
4. ตรวจว่า generate สำเร็จจริงใน **งานทั้งหมด**
5. ถ้ายังไม่มี ให้แจ้ง dev

หมายเหตุ: Costs เป็น estimated cost ไม่ใช่ invoice จริง

## Monitoring แสดง warning

ให้แยกประเภทก่อน:

| Warning | ตอบสนองอย่างไร |
| --- | --- |
| Google Drive disconnected | เชื่อม OAuth ใหม่ก่อน approve งานสำคัญ |
| Storage warnings | ถ้ามี Drive export สำเร็จ ให้บันทึกและ monitor |
| Stuck jobs | ตรวจว่านานจริงก่อน Retry |
| Failed exports | ตรวจ Drive แล้ว Retry Export ถ้า source พร้อม |

ถ้า warning เพิ่มขึ้นหลายรายการในเวลาใกล้กัน ให้แจ้ง dev พร้อม screenshot และช่วงเวลา

## Retry Export ขึ้นผิดที่

สิ่งที่ควรเป็น:

- **Retry Export** ควรขึ้นเมื่อไม่มี valid export/Drive link และมี approved/generated source สำหรับ export
- ในหน้า **งานทั้งหมด** admin อาจเห็นปุ่มในคอลัมน์ Export ของงานที่ retry export ได้
- ใน **Monitoring / System Health** admin อาจเห็นปุ่มใน failed items ที่เหมาะสม

ถ้าไม่เป็นแบบนี้ให้ทำอะไร:

| อาการ | ให้ทำอะไร |
| --- | --- |
| Staff เห็น Retry Export | แจ้ง dev เป็น role-gate issue |
| มี Open Drive แล้วแต่ยังขึ้น Retry Export | capture job id และ screenshot แจ้ง dev |
| ไม่มี source แต่ขึ้น Retry Export | capture job id/generation id แจ้ง dev |

## API ได้ 401 / 403 / 404 JSON

| Status | ความหมาย | วิธีแก้ |
| --- | --- | --- |
| 401 | ยังไม่มี session หรือ session หมดอายุ | login ใหม่ |
| 403 | role ไม่มีสิทธิ์ เช่น staff เรียก admin API | ใช้ admin account หรือหยุดถ้าเป็น staff |
| 404 JSON | route ไม่มีอยู่จริงหรือ endpoint ผิด | ตรวจ URL/route และแจ้ง dev ถ้า UI เรียกผิด |

สิ่งที่ต้องเห็น: response เป็น JSON รูปแบบ error ไม่ใช่ HTML page

## API ได้ HTML แทน JSON

อาการ: Network response หรือ error บอกว่า API ไม่ได้ส่ง JSON เช่น Monitoring/Costs API

ถ้าไม่เป็นแบบนี้ให้ทำอะไร:

1. ตรวจ endpoint ว่าขึ้นต้น `/api/`
2. ตรวจ deploy version บน Render
3. hard refresh แล้วลองใหม่
4. ถ้าเกิดหลัง deploy ให้ตรวจว่า production ใช้ commit ล่าสุด
5. แจ้ง dev พร้อม endpoint, status, response preview

## Render deploy แล้ว production ยังไม่เปลี่ยน

สิ่งที่ต้องเห็น: หลัง deploy success หน้า production และ API behavior ตรงกับ commit ล่าสุด

ถ้าไม่เป็นแบบนี้ให้ทำอะไร:

1. ตรวจ Render dashboard ว่า deploy ล่าสุด success
2. ตรวจ branch/commit ที่ Render deploy
3. hard refresh browser
4. ลองเปิด incognito หรือ clear site data เฉพาะ production
5. ตรวจ `/api/health`
6. ถ้า API ยังเก่า ให้ดู Render logs และแจ้ง dev

## Browser cache / hard refresh

ใช้เมื่อหน้าเว็บดูเก่า login/logout แปลก หรือหลัง deploy UI ยังไม่เปลี่ยน

วิธีทำ:

| Browser | วิธี |
| --- | --- |
| Chrome/Edge Mac | `Cmd + Shift + R` |
| Chrome/Edge Windows | `Ctrl + Shift + R` |
| Safari Mac | เปิด Develop menu แล้ว Empty Caches หรือ refresh ใหม่ |

ถ้า hard refresh แล้วไม่หาย: capture page URL และแจ้ง admin/dev

## Checklist ก่อนส่งต่อเคส

ก่อนแจ้ง dev/admin ให้ตอบให้ได้:

1. เกิดที่หน้าไหน: **สร้างภาพ**, **งานทั้งหมด**, **คลังภาพ**, **KPI Dashboard**, **Costs**, **Monitoring / System Health**, หรือ **ตั้งค่า**
2. user email อะไร
3. role คือ staff หรือ admin
4. กดปุ่มอะไรล่าสุด
5. job id และ generation id คืออะไร
6. เวลาเกิดปัญหา
7. มี screenshot หรือ Network request หรือไม่
8. ลอง hard refresh แล้วหรือยัง
