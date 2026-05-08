# Production Checklist: image-workflow

ใช้ checklist นี้ก่อน launch, หลัง deploy, และระหว่าง daily/weekly operation ของ production image-workflow

## Pre-launch checklist

| ตรวจ | สิ่งที่ต้องเห็น | ถ้าไม่เป็นแบบนี้ให้ทำอะไร |
| --- | --- | --- |
| Production URL เปิดได้ | หน้า login แสดงปกติ | ตรวจ Render service/logs |
| Admin login ได้ | เข้า workflow และเห็นเมนู admin | ตรวจ Supabase Auth/profile |
| Staff login ได้ | เห็นเฉพาะเมนู staff | ตรวจ role/is_active |
| Temporary password flow | user ถูกบังคับเปลี่ยน password ก่อนใช้งาน | ตรวจ `must_change_password` |
| Google Drive OAuth | admin connect ได้และ status connected | ตรวจ OAuth config/folder permission |
| Generate Hero | สร้างภาพสำเร็จบน Render | หยุด deploy ถ้า fail |
| Approve Hero | approved/exported และมี Drive link เมื่อ Drive connected | ตรวจ export logs/Monitoring |
| Generate Support | สร้าง support จาก Hero ที่ approve แล้ว | ตรวจ generation status |
| Approve Support | support ถูกบันทึก/export | ตรวจ Asset Library |
| Jobs | หน้า **งานทั้งหมด** โหลดและ filter ได้ | ตรวจ `/api/jobs` |
| Asset Library | default Outputs แสดงงานจริง | ตรวจ `/api/assets` |
| KPI Dashboard | โหลดข้อมูลช่วง Today/7d ได้ | ตรวจ KPI API/logs |
| Monitoring | admin โหลด **Monitoring / System Health** ได้ | ตรวจ admin API/session |
| Costs | admin โหลด estimated cost ได้ | ตรวจ cost events/config |

## After-deploy checklist

1. ตรวจ Render deploy ล่าสุดว่า success และ commit ถูกต้อง
2. เปิด production URL แล้ว hard refresh
3. Run smoke test: Login, Logout โดยไม่ต้อง hard refresh
4. Login admin แล้วเปิด **ตั้งค่า**, **Monitoring / System Health**, **Costs**
5. Login staff แล้วตรวจว่าไม่มี **ตั้งค่า**, **Monitoring**, **Costs**
6. เปิด `/api/health` แล้วตรวจว่าเป็น safe JSON ไม่เปิดเผย secret
7. Generate Hero งาน test 1 งาน
8. Approve Hero แล้วตรวจ **Open Drive** ถ้า Drive connected
9. Generate Support แล้ว Approve Support
10. เปิด **งานทั้งหมด** ตรวจ status ล่าสุด
11. เปิด **คลังภาพ** ตรวจ Outputs/Approved และ preview/link
12. เปิด **KPI Dashboard** และ **Costs** ตรวจว่าข้อมูลใหม่เข้าช่วงเวลาที่เลือก
13. เปิด **Monitoring / System Health** ตรวจ warning/failure ใหม่
14. Run local verification ก่อน commit/push เมื่อแก้โค้ด: `node --check app.js`, `node --check server.mjs`, `git diff --check`

## Daily operation checklist

| เวลา/เหตุการณ์ | ตรวจ | สิ่งที่ต้องเห็น |
| --- | --- | --- |
| เริ่มวัน | **Monitoring / System Health** Today | ไม่มี critical failure |
| เริ่มวัน | Google Drive health | connected |
| ระหว่างวัน | **งานทั้งหมด** Today | งานไม่ค้าง generating นานผิดปกติ |
| หลังทีม approve | **คลังภาพ** Outputs/Approved | มีภาพและ Open Drive |
| ก่อนจบวัน | **Costs** Today | retry/failed impact ไม่สูงผิดปกติ |
| ก่อนจบวัน | Staff request | reset password/เปิดปิด user เสร็จแล้ว |

ถ้าไม่เป็นแบบนี้ให้ทำอะไร: ใช้ [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) และ capture job id/generation id/screenshot ก่อนแจ้ง dev

## Weekly maintenance checklist

1. เปิด **KPI Dashboard** ช่วง Last 7 days
2. ตรวจ generated/approved/exported funnel ว่าตกตรงไหนผิดปกติ
3. เปิด **Costs** ช่วง Last 7 days ดู highest cost jobs และ retry cost
4. เปิด **Monitoring / System Health** ช่วง Last 7 days ดู repeated warning
5. ตรวจ Google Drive folder permission และพื้นที่เก็บไฟล์
6. ตรวจ Staff Management ว่าบัญชีที่ไม่ใช้แล้ว inactive
7. ตรวจว่าไม่มี admin เกินจำเป็น
8. ตรวจ backup policy ของ Supabase ก่อนงานใหญ่
9. บันทึก known limitations/issues ที่เกิดซ้ำ

## Auth/role checklist

| ตรวจ | สิ่งที่ต้องเห็น | ถ้าไม่เป็นแบบนี้ให้ทำอะไร |
| --- | --- | --- |
| Admin access | admin เห็น **ตั้งค่า**, **Monitoring**, **Costs** | ตรวจ role เป็น `admin` |
| Staff access | staff ไม่เห็น **ตั้งค่า**, **Monitoring**, **Costs** | แก้ role และแจ้ง dev ถ้ายังเห็น |
| Direct hash | staff เปิด `#settings/#monitoring/#costs` ไม่ได้ | ถือเป็น critical ถ้าเปิดได้ |
| Inactive user | login ไม่ได้หรือถูก block | เปิด active เฉพาะเมื่ออนุมัติแล้ว |
| Temporary password | ต้องเปลี่ยนรหัสก่อน workflow actions | set `must_change_password` |
| Logout | กลับหน้า login โดยไม่ hard refresh | ตรวจ auth state ถ้าค้าง |

## Google Drive checklist

| ตรวจ | สิ่งที่ต้องเห็น | ถ้าไม่เป็นแบบนี้ให้ทำอะไร |
| --- | --- | --- |
| OAuth status | connected ใน **ตั้งค่า** และ Monitoring | เชื่อม Google Drive ใหม่ |
| Token storage | token persisted ใน `public.integration_tokens` | ตรวจ server logs ถ้า status ไม่จำ |
| Export after approve | มี **Open Drive** / **Open export** | ตรวจ Drive health แล้ว Retry Export ถ้าเหมาะสม |
| Folder permission | บัญชี OAuth เขียนไฟล์ได้ | ตรวจ shared folder/Shared Drive |
| Secret safety | ไม่มี token/client secret ใน API/log | แก้ log ทันทีก่อน deploy |

## Supabase Storage checklist

| ตรวจ | สิ่งที่ต้องเห็น | ถ้าไม่เป็นแบบนี้ให้ทำอะไร |
| --- | --- | --- |
| Buckets | `product-references`, `model-references`, `generated-images`, `approved-images` | สร้าง/แก้ config นอก repo |
| Upload path | ใช้ path แบบ `jobs/{jobId}/...` | แจ้ง dev ถ้า path ผิด |
| Preview | Asset Library มี preview หรือ fallback | ถ้าไม่มีแต่ Drive มี ให้บันทึก warning |
| Storage warning | ถ้า Drive export สำเร็จ ให้เป็น warning ไม่ใช่ critical | ตรวจ Open Drive ก่อน recovery |
| Critical storage/export | ไม่มีทั้ง storage preview และ Drive link | ตรวจ Monitoring และ Google Drive ทันที |

## Generate/Approve checklist

| Flow | สิ่งที่ต้องเห็น | ถ้าไม่เป็นแบบนี้ให้ทำอะไร |
| --- | --- | --- |
| Generate Hero | ภาพ Hero แสดงและ status generated/hero_ready | ตรวจ job status, Monitoring |
| Approve Hero | approved/exported และเปิด Support ได้ | ถ้า export หาย ให้ตรวจ Drive |
| Generate Support | support gallery แสดงภาพมุมเสริม | อย่ากดซ้ำระหว่าง loading |
| Approve Support | support approved/exported และเข้าคลังภาพ | ตรวจ Asset Library |
| Loading state | ปุ่มไม่ควรถูกกดซ้ำ | สอนทีมให้รอจบสถานะ |
| Failed/stuck | admin เห็น action ที่เหมาะสม | ใช้ Retry/Mark Failed ตามคู่มือ |

## Monitoring/System Health checklist

| พื้นที่ | สิ่งที่ต้องเห็น | ถ้าไม่เป็นแบบนี้ให้ทำอะไร |
| --- | --- | --- |
| Operational status | OK หรือ warning ที่อธิบายได้ | แยก warning vs critical |
| Failed jobs | 0 หรือมีรายการพร้อม action | Retry เฉพาะที่ควร retry |
| Failed exports | 0 หรือมีรายการที่ตรวจ Drive แล้ว | Retry Export เฉพาะ approved/generated source |
| Storage warnings | แยกจาก critical ถ้า Drive export สำเร็จ | ไม่ต้อง Retry Export ถ้า Open Drive ใช้ได้ |
| Stuck jobs | ไม่มี หรือมีงานค้างเกิน 30 นาที | ตรวจก่อน Retry/Mark Failed |
| Recent events | มี audit events ล่าสุด | แจ้ง dev ถ้า events หาย |
| Pagination | Previous/Next และ page size ใช้ได้ | ตรวจ query/page API ถ้าเสีย |

## Costs checklist

| ตรวจ | สิ่งที่ต้องเห็น | ถ้าไม่เป็นแบบนี้ให้ทำอะไร |
| --- | --- | --- |
| Access | admin เห็น **Costs**, staff ไม่เห็น | ตรวจ role gate |
| Estimate note | ระบุว่าเป็น estimated cost ไม่ใช่ invoice | อย่าใช้แทน invoice |
| Today/7d/30d/all | เปลี่ยนช่วงเวลาได้ | refresh/ตรวจ API |
| Retry cost | failed/retry impact แสดง | ตรวจ cost events |
| Staff usage | เห็น cost by staff เมื่อมีข้อมูล | ตรวจช่วงเวลา |
| Highest cost jobs | ใช้หา job ที่ใช้ต้นทุนสูง | ตรวจ retry ซ้ำ |

## Retry/Recovery checklist

| Action | ใช้เมื่อ | ห้ามใช้เมื่อ |
| --- | --- | --- |
| **Retry** | generation failed/stuck และ input เดิมถูกต้อง | งานเพิ่งเริ่มหรือ input ผิดตั้งแต่แรก |
| **Retry Export** | approve/generated แล้วแต่ไม่มี Drive/export link | มี Open Drive ที่เปิดได้แล้ว |
| **Mark Failed** | งานค้างและต้องปิดเคสเป็น failed | งานยังมีโอกาสจบหรือยังไม่ตรวจ Monitoring |

หลัง recovery: refresh **Monitoring / System Health** และ **งานทั้งหมด** เพื่อตรวจผล

## Backup recommendation

- เปิด Supabase automatic backups ก่อนเปลี่ยน workflow สำคัญ
- ก่อน production deploy ใหญ่ ให้ export/backup ตารางสำคัญตาม policy ทีม
- เก็บ Render env vars ใน Render dashboard ไม่เก็บใน repo
- บันทึก Google Drive root folder/shared drive ownership
- เก็บคู่มือ admin/staff รุ่นล่าสุดไว้ใน repo และส่ง link ให้ทีม

## Known limitations

- Cost values เป็น estimate จาก generation/config ไม่ใช่ provider invoice
- Google OAuth callback ต้อง public เพื่อให้ Google redirect กลับ แต่ป้องกันด้วย server state
- Supabase Storage อาจ warning ได้ ถ้า Google Drive export สำเร็จถือว่าไฟล์ปลายทางยังใช้ได้
- Historical events บางรายการอาจไม่มี cost metadata ครบ ระบบจึง estimate จาก generation records เท่าที่มี
- Staff ไม่สามารถแก้ recovery หรือ admin settings เอง ต้องแจ้ง admin
- Asset preview อาจไม่ขึ้นแม้ Drive export สำเร็จ ให้ใช้ **Open Drive** เป็น source of truth สำหรับไฟล์ปลายทาง

## Emergency rollback note

ใช้ rollback เมื่อ deploy ใหม่ทำให้ production workflow หลักเสีย เช่น login ไม่ได้, generate/approve ใช้งานไม่ได้, staff role gate หลุด, หรือ API สำคัญตอบ HTML/500 ต่อเนื่อง

แนวทาง:

1. หยุดให้ทีมกด Generate/Approve เพิ่มถ้าข้อมูลเสี่ยงซ้ำ
2. Capture Render logs, `/api/health`, screenshot, commit hash
3. Rollback ไป deploy ล่าสุดที่ workflow ผ่าน smoke test
4. ตรวจ Login/Logout, Generate Hero, Approve Hero, Generate Support, Approve Support
5. ตรวจ role gate staff/admin
6. แจ้งทีมว่าสามารถกลับมาใช้งานได้เมื่อ smoke test ผ่าน
