# Admin Operating Manual: คู่มือปฏิบัติงานสำหรับ admin

เอกสารนี้สำหรับ owner/operator/admin ที่ดูแลระบบ image-workflow บน production ใช้สำหรับจัดการ user, Google Drive, Monitoring, Costs, Jobs, Asset Library และ recovery โดยไม่กระทบ workflow ที่ทีมใช้งานจริง

สถานะเอกสาร 2026-06-18: ใช้คู่มือนี้ร่วมกับ [Current Truth](./CURRENT_TRUTH.md) เสมอ เพราะ UI และ workflow ปัจจุบันเปลี่ยนเป็น LINE-first batch path แล้ว โดย WordPress/WooCommerce ยังเป็น preflight/dry-run เท่านั้น

เอกสารที่เกี่ยวข้อง: [Current Truth](./CURRENT_TRUTH.md), [Production Launch Gate](./PRODUCTION_LAUNCH_GATE.md), [Rollback And Incident Playbook](./ROLLBACK_AND_INCIDENT_PLAYBOOK.md), [Production Checklist](./PRODUCTION_CHECKLIST.md), [Troubleshooting](./TROUBLESHOOTING.md), [Final Launch Review](./FINAL_LAUNCH_REVIEW.md)

## สิทธิ์ของ admin

Admin ทำได้ทุกอย่างที่ staff ทำได้ และเพิ่มสิทธิ์เหล่านี้:

| พื้นที่ | สิทธิ์ admin |
| --- | --- |
| **ตั้งค่า** | เชื่อม Google Drive OAuth, ดู Staff Management |
| Staff Management | สร้าง user, reset temporary password, เปิด/ปิด user, เปลี่ยน role, บังคับ `must_change_password` |
| **Monitoring / System Health** | ดู health, stuck jobs, failed items, audit events, recovery actions |
| **Costs** | ดู estimated cost, retry cost, failed/retry impact |
| **งานทั้งหมด** | เห็น recovery controls ในงานที่แก้ได้ |
| Recovery | ใช้ **Retry**, **Retry Export**, **Mark Failed** |
| API | ตรวจ `/api/health` แบบ safe status และ `/api/ops` สำหรับ queue/storage status เฉพาะ admin |

ข้อควรระวัง: admin action หลายอย่างกระทบ production ทันที โดยเฉพาะ role, inactive, reset password และ recovery

## Security boundary ที่ต้องรู้

- Staff ห้ามเห็น **ตั้งค่า**, **Monitoring**, **Costs** และเรียก admin-only API โดยตรงไม่ได้
- LINE webhook ต้องผ่าน signature verification ก่อนระบบอ่าน payload
- ระบบมี basic duplicate event guard สำหรับ LINE webhook redelivery ใน process เดียวกัน
- Upload สำหรับ generation รับเฉพาะ `JPG`, `PNG`, `WebP` และไม่เกิน 20MB ต่อไฟล์
- Remote image URL ที่ใช้ approve/export ต้องเป็น `http` หรือ `https` public URL เท่านั้น ไม่อนุญาต localhost/private network
- `/api/health` แสดงเฉพาะ boolean/config status ที่ปลอดภัย ห้ามใส่ secret/token/key ใน response หรือ screenshot ที่แชร์นอกทีม

## วิธีสร้าง user ใหม่

1. Login ด้วยบัญชี admin
2. เข้าเมนู **ตั้งค่า**
3. ไปที่ **Staff Management**
4. กด **เพิ่มผู้ใช้**
5. กรอก **ชื่อพนักงาน**
6. กรอก **Email**
7. เลือก **Role** เป็น `staff` หรือ `admin`
8. ตั้ง **Temporary password** อย่างน้อย 8 ตัวอักษร
9. กรอก **Confirm temporary password**
10. เลือก checkbox **เปิดใช้งานทันที** ถ้าต้องการให้ login ได้ทันที
11. เลือก checkbox **บังคับเปลี่ยนรหัสหลัง login** โดยปกติควรเปิดไว้
12. กด **สร้างผู้ใช้งาน**

สิ่งที่ต้องเห็น: รายชื่อ user ใหม่แสดงใน Staff Management พร้อม role, active/inactive และ password required/normal

ถ้าไม่เป็นแบบนี้ให้ทำอะไร:

| อาการ | ให้ทำอะไร |
| --- | --- |
| email มีอยู่แล้ว | ใช้ user เดิมใน Staff Management หรือ reset password แทน |
| temporary password ไม่ตรง confirm | กรอกใหม่ |
| สร้าง admin | ระบบจะถามยืนยัน ให้ตรวจ email ให้ถูกก่อนยืนยัน |
| สร้างไม่สำเร็จ | capture error, email, role, เวลา แล้วแจ้ง dev |

หลังสร้าง user: ส่ง email และ temporary password ให้ผู้ใช้ผ่านช่องทางปลอดภัย และบอกให้เปลี่ยน password ตอน login ครั้งแรก

## วิธี reset temporary password

1. เข้า **ตั้งค่า** > **Staff Management**
2. ค้นหา user ด้วยชื่อหรือ email
3. กด **Reset Password**
4. ตรวจ field **ผู้ใช้งาน** และ **สถานะบัญชี**
5. กรอก **New temporary password**
6. กรอก **Confirm temporary password**
7. กด **รีเซ็ตรหัสผ่าน**

สิ่งที่ต้องเห็น: ข้อความรีเซ็ตรหัสผ่านชั่วคราวสำเร็จ และ user กลับเป็น password required

ถ้าไม่เป็นแบบนี้ให้ทำอะไร:

| อาการ | ให้ทำอะไร |
| --- | --- |
| บัญชี inactive | เปิดใช้งานก่อน หรือแจ้ง user ว่ายัง login ไม่ได้ |
| reset สำเร็จแต่ user login ไม่ได้ | ตรวจ active/inactive และให้ user ใช้ temporary password ล่าสุด |
| error จากระบบ | capture screenshot, user id/email, เวลา แล้วแจ้ง dev |

หมายเหตุ: หลัง reset ระบบบังคับ `must_change_password` ให้ user เปลี่ยนรหัสหลัง login

## วิธีเปิด/ปิด user

1. เข้า **ตั้งค่า** > **Staff Management**
2. ค้นหา user
3. ใช้ toggle **Active** ใน card ของ user
4. รอข้อความบันทึกสำเร็จหรือรายการ refresh

สิ่งที่ต้องเห็น:

| สถานะ | ผล |
| --- | --- |
| active | user login และใช้งานตาม role ได้ |
| inactive | user login ไม่ได้หรือถูก block จากระบบ |

ถ้าไม่เป็นแบบนี้ให้ทำอะไร: กด **รีเฟรช** และตรวจอีกครั้ง ถ้ายังไม่ตรงให้แจ้ง dev พร้อม user id/email

## วิธีเปลี่ยน role

1. เข้า **ตั้งค่า** > **Staff Management**
2. ค้นหา user
3. เปลี่ยน dropdown **Role** เป็น `staff` หรือ `admin`
4. ถ้าระบบถามยืนยัน ให้ตรวจ email และผลกระทบก่อนกดยืนยัน

สิ่งที่ต้องเห็น: badge role ใน user card เปลี่ยนเป็นค่าที่เลือก

ถ้าไม่เป็นแบบนี้ให้ทำอะไร: refresh รายชื่อ ถ้ายังไม่เปลี่ยนให้ capture error และแจ้ง dev

ข้อควรระวัง:

- เปลี่ยน staff เป็น admin จะทำให้ user เห็น **ตั้งค่า**, **Monitoring**, และ **Costs**
- เปลี่ยน admin เป็น staff จะตัดสิทธิ์ admin ทันที
- อย่าลด role ของ admin คนสุดท้ายถ้ายังไม่มี admin สำรอง

## วิธีบังคับ must_change_password

1. เข้า **ตั้งค่า** > **Staff Management**
2. ค้นหา user
3. เปิด checkbox/toggle **Must change password** หรือสถานะ password required
4. ให้ user logout/login ใหม่ แล้วตั้ง password ใหม่

สิ่งที่ต้องเห็น: user card แสดง `password required`

ถ้าไม่เป็นแบบนี้ให้ทำอะไร: refresh Staff Management แล้วตรวจอีกครั้ง

## วิธีเชื่อม Google Drive OAuth

1. Login เป็น admin
2. เข้า **ตั้งค่า**
3. ไปที่ **Google Drive Integration**
4. กด **เชื่อมต่อ Google Drive**
5. เลือกบัญชี Google ที่เป็นเจ้าของหรือมีสิทธิ์ใน shared folder/Shared Drive
6. อนุญาต OAuth
7. เมื่อเห็นหน้าว่าเชื่อมต่อสำเร็จ ให้กลับมาที่ระบบ
8. กด refresh หรือเปิด **Monitoring / System Health** เพื่อตรวจ health

สิ่งที่ต้องเห็น: Google Drive status เป็น connected และ approve/export งานใหม่แล้วมี **Open Drive**

ถ้าไม่เป็นแบบนี้ให้ทำอะไร:

| อาการ | ให้ทำอะไร |
| --- | --- |
| ปุ่ม connect ไม่ขึ้น | ตรวจว่า login เป็น admin |
| OAuth fail | ตรวจ Google OAuth config บน Render และ redirect URL |
| connected แต่ export fail | ตรวจ folder id/permission และ Monitoring |
| Drive disconnected | เชื่อมต่อใหม่จาก **ตั้งค่า** |

ข้อจำกัด: OAuth token ถูกเก็บใน `public.integration_tokens`; อย่าดึง token หรือ client secret ออกมาแสดงใน log หรือเอกสาร

## วิธีตรวจ KPI Dashboard

1. เข้า **KPI Dashboard**
2. เลือกช่วงเวลา **Today**, **Last 7 days**, **Last 30 days**, หรือ **All time**
3. กด **รีเฟรช** ถ้าข้อมูลยังไม่ล่าสุด
4. อ่าน executive summary, trend, workflow funnel, status breakdown, staff performance และ recent activity

สิ่งที่ต้องเห็น: จำนวน jobs/generated/approved/exported และ activity สอดคล้องกับงานจริงใน **งานทั้งหมด**

ถ้าไม่เป็นแบบนี้ให้ทำอะไร: เทียบช่วงเวลาเดียวกันกับ **งานทั้งหมด** และแจ้ง dev ถ้าตัวเลขต่างกันผิดปกติ

## วิธีอ่าน Monitoring / System Health

1. เข้า **Monitoring / System Health**
2. เลือกช่วงเวลา
3. ตรวจ **Operational status**
4. ตรวจ warning list
5. ตรวจ summary cards เช่น Failed jobs, Failed exports, Storage warnings, Stuck jobs, Google Drive
6. ตรวจ **Google Drive health**
7. ตรวจ **Likely stuck jobs**
8. ตรวจ **Failed items and recommended action**
9. ตรวจ **Recent system events**

สิ่งที่ต้องเห็น:

| พื้นที่ | ใช้ตัดสินใจอะไร |
| --- | --- |
| Operational status | ภาพรวมว่า production ปกติหรือมีปัญหา |
| Google Drive health | export พร้อมหรือ disconnected |
| Worker mode ใน `/api/health` | production pilot ควรเป็น `dedicated_worker`, `embedded_worker_enabled=false`, `dedicated_worker_expected=true` |
| Stuck jobs | งาน queued/running/generating เกินประมาณ 30 นาที |
| Failed items | งานหรือ export ที่ล้มเหลวและควร recovery |
| Recent system events | ลำดับเหตุการณ์ล่าสุด |

ถ้าไม่เป็นแบบนี้ให้ทำอะไร: ถ้า Monitoring โหลดไม่สำเร็จ ให้ดู `/api/health` และแจ้ง dev พร้อม screenshot ของหน้า Monitoring

## วิธีแยก warning vs critical failure

| ประเภท | ตัวอย่าง | ระดับความเร่ง |
| --- | --- | --- |
| Warning | Google Drive disconnected แต่ยังไม่มีงาน approve ใหม่ | เฝ้าดู/แก้ก่อนใช้งานหนัก |
| Warning | Supabase Storage warning แต่ Google Drive export สำเร็จ | ไม่กระทบไฟล์ปลายทาง ให้บันทึกไว้และตรวจซ้ำ |
| Warning | Stuck job เดี่ยวหลัง queue นาน | ตรวจใน Monitoring แล้วพิจารณา Retry |
| Critical | Generate fail หลายงานติดกัน | หยุดให้ทีมกดซ้ำและแจ้ง dev |
| Critical | Approve/export fail และไม่มี Drive link | ตรวจ Google Drive/OAuth และใช้ Retry Export เมื่อเหมาะสม |
| Critical | Staff เห็นหน้า admin | ปิด user หรือแก้ role ทันที แล้วแจ้ง dev |

## Supabase Storage warning ที่ resolved by Google Drive

ระบบมี fallback: ถ้า Supabase Storage upload fail แต่ Google Drive export สำเร็จ Monitoring อาจแสดงข้อความแนว `Supabase Storage failed แต่ Google Drive export สำเร็จแล้ว`

สิ่งที่ต้องเข้าใจ:

- ถ้ามี **Open Drive** ใช้งานได้ ผลงานปลายทางยังส่งออกสำเร็จ
- Asset preview อาจไม่ขึ้นหรือใช้ generated remote preview แทน
- ไม่ควรกด Retry Export เพียงเพราะมี storage warning ถ้า Drive link ดีอยู่แล้ว
- ให้บันทึก warning เพื่อดู pattern รายสัปดาห์

ถ้าไม่เป็นแบบนี้ให้ทำอะไร: ถ้าไม่มีทั้ง preview และ Drive link ให้ถือเป็น critical export/storage issue

## วิธีดู Costs / Usage Tracking

1. เข้า **Costs**
2. เลือกช่วงเวลา
3. ตรวจ executive cost summary
4. ดู **Usage cost by day**
5. ดู **Failed / retry impact**
6. ดู **Cost by staff**
7. ดู **Highest cost jobs**
8. ดู **Recent cost events**

สิ่งที่ต้องเห็น: ตัวเลขเป็น estimated cost ไม่ใช่ invoice จริง และ retry/failed cost แยกให้เห็น

ถ้าไม่เป็นแบบนี้ให้ทำอะไร:

| อาการ | ให้ทำอะไร |
| --- | --- |
| Costs ไม่ขึ้นหลัง generate | กด refresh และตรวจช่วงเวลา |
| ตัวเลขต่างจาก invoice | เป็นเรื่องปกติ เพราะเป็น estimate |
| retry cost สูงผิดปกติ | ตรวจงานที่ retry บ่อยและคุยกับทีมเรื่อง QC/input |

## วิธีดู Jobs / Asset Library แบบ admin

ใน **งานทั้งหมด** admin เห็นทุกงานและ recovery actions ในบางงาน

1. ใช้ช่วงเวลาและ search เพื่อหา SKU/job id/email
2. ดูคอลัมน์ Workflow เพื่อเห็น Job, Gen, Hero, Support, Approve
3. ดูคอลัมน์ Export เพื่อหา **Open export** หรือ **Retry Export**
4. ดู Activity เพื่อดูจำนวน generation/assets และ action ที่ระบบอนุญาต

ใน **คลังภาพ**:

1. เริ่มจาก tab **Outputs**
2. ใช้ **Approved / Exported** เมื่อต้องตรวจไฟล์ปลายทาง
3. ใช้ **References** เมื่อต้องตรวจ input ที่ทีมใช้
4. ใช้ job id/generation id เพื่อ debug เฉพาะงาน

## วิธีใช้ Retry / Retry Export / Mark Failed

| ปุ่ม | ใช้เมื่อไหร่ | ผลที่คาดหวัง |
| --- | --- | --- |
| **Retry** | generation fail หรือ stuck และยังมี reference/prompt เดิมพอ retry | สร้าง generation ใหม่จากงานเดิม |
| **Retry Export** | งาน approve/generated แล้ว แต่ไม่มี export/Drive link ที่ valid | ส่งออกซ้ำไป Google Drive |
| **Mark Failed** | งานค้างหรือสถานะไม่จบ และต้องปิดเคสเป็น failed | งานถูก mark failed เพื่อไม่ค้างใน queue |

หลังใช้ recovery: รอระบบทำงานเสร็จ แล้ว refresh **Monitoring / System Health** หรือ **งานทั้งหมด**

## เมื่อไหร่ควรกด Retry

ควรกด Retry เมื่อ:

- Generation status เป็น failed
- งานค้าง `queued`, `running`, หรือ `generating` นานผิดปกติ
- Monitoring แสดง likely stuck job และมีปุ่ม Retry
- ตรวจแล้ว reference เดิมยังถูกต้อง
- ทีมไม่ได้กดสร้างงานซ้ำไปแล้ว

ไม่ควรกด Retry เมื่อ:

- งานกำลังสร้างอยู่ไม่นาน
- staff เพิ่งกด Generate แล้วระบบยัง loading
- input/reference ผิดตั้งแต่ต้น ควรสร้างงานใหม่แทน
- มี retry หลายครั้งติดกันโดยยังไม่รู้สาเหตุ

## เมื่อไหร่ไม่ควรกด Retry Export

ไม่ควรกด Retry Export เมื่อ:

- มี **Open Drive** หรือ **Open export** ที่เปิดได้แล้ว
- ปัญหาเป็นแค่ Supabase Storage warning แต่ Google Drive export สำเร็จ
- งานยังไม่ได้ approve/generated source ที่ใช้ export
- Google Drive disconnected อยู่ ให้เชื่อม Drive ก่อน
- ยังไม่แน่ใจว่างานปลายทางถูกต้องหรือไม่

ควรกด Retry Export เมื่อ:

- งาน approve/generated แล้ว
- ไม่มี Drive/export link หรือ link เสีย
- Google Drive connected
- Monitoring หรือ Jobs แสดงปุ่ม Retry Export

## วิธีดู `/api/health` แบบปลอดภัย

1. เปิด production URL แล้วเติม `/api/health`
2. ตรวจเฉพาะค่า status/boolean ที่ปลอดภัย
3. อย่า capture หรือส่งต่อ secret ใด ๆ ถ้าบังเอิญเห็นค่า sensitive

สิ่งที่ต้องเห็น: JSON health status ที่ไม่เปิดเผย token, key, password, prompt หรือ payload

ถ้าไม่เป็นแบบนี้ให้ทำอะไร:

| อาการ | ให้ทำอะไร |
| --- | --- |
| ได้ HTML แทน JSON | endpoint อาจผิด route/deploy ยังไม่อัปเดต ให้แจ้ง dev |
| ได้ 401/403 | ตรวจว่า endpoint นั้นต้องใช้ session/admin หรือไม่ |
| health แสดง missing config | ตรวจ Render environment variables |

## วิธีเช็ก Render deploy หลัง push

1. เปิด Render dashboard ของ service production
2. ตรวจ deploy ล่าสุดว่าตรง branch/commit ที่ push
3. รอสถานะ deploy success
4. เปิด production URL
5. hard refresh 1 ครั้ง
6. Smoke test login/logout และ flow หลัก
7. ตรวจ `/api/health`

สิ่งที่ต้องเห็น: production behavior ตรงกับ commit ล่าสุด และไม่มี error ใหม่ใน logs

ถ้าไม่เป็นแบบนี้ให้ทำอะไร:

- ถ้า deploy fail: เปิด log, capture error, แจ้ง dev
- ถ้า deploy success แต่หน้าไม่เปลี่ยน: hard refresh, ตรวจ service/branch, ตรวจว่า browser cache หรือ CDN/cache
- ถ้า API ได้ HTML แทน JSON: ตรวจ unknown route fallback และ deploy version

## วิธีเช็กว่า staff ไม่มีสิทธิ์เข้า Settings / Monitoring / Costs

1. Login ด้วยบัญชี staff test
2. ดูเมนูด้านซ้าย
3. ตรวจว่าไม่มี **ตั้งค่า**, **Monitoring**, **Costs**
4. ลองเปิด hash โดยตรง เช่น `#settings`, `#monitoring`, `#costs`

สิ่งที่ต้องเห็น: staff ถูก redirect หรือไม่เห็นหน้า admin

ถ้าไม่เป็นแบบนี้ให้ทำอะไร: แก้ role/status ของ user ทันที ถ้ายังเห็นอยู่ให้ถือเป็น critical และแจ้ง dev

## Daily admin routine

ทำทุกวันทำงาน:

1. เปิด **Monitoring / System Health** ช่วง Today
2. ตรวจ Google Drive health
3. ตรวจ stuck jobs และ failed items
4. เปิด **งานทั้งหมด** ช่วง Today ดูงานที่ failed/generating นาน
5. เปิด **คลังภาพ** tab Outputs/Approved เพื่อตรวจว่างานล่าสุดมี Open Drive
6. เปิด **Costs** ช่วง Today ดู retry/failed impact
7. ตรวจ user request เช่น reset password หรือ inactive account

## Weekly admin routine

ทำอย่างน้อยสัปดาห์ละครั้ง:

1. เปิด **KPI Dashboard** ช่วง Last 7 days และ All time ตามต้องการ
2. ดู staff performance และงานที่ approve/export ต่ำผิดปกติ
3. เปิด **Costs** ดู highest cost jobs และ retry cost
4. ตรวจ repeated storage warning หรือ Drive export warning
5. ตรวจ Staff Management ว่าไม่มี admin เกินจำเป็น
6. ตรวจว่าบัญชีที่ไม่ใช้แล้วเป็น inactive
7. ตรวจ backup/Supabase policy และ Google Drive folder permission
8. บันทึก known issue ที่เกิดซ้ำให้ dev ปรับระบบ
