# Final Launch Review: image-workflow

เอกสารนี้เป็น launch review และ production readiness sign-off สำหรับระบบ image-workflow / prompt-system-prototype ก่อนส่งมอบให้ owner/admin และทีม staff ใช้งานจริง

Production URL: https://image-workflow.onrender.com

## Executive summary

image-workflow คือระบบ production workflow สำหรับสร้างภาพสินค้า ตั้งแต่รับ brief/reference, สร้างภาพ Hero ด้วย AI, ตรวจและ approve, สร้าง Support Set, ส่งออกไป Google Drive, ติดตามงาน, ดูคลังภาพ, ตรวจ KPI, ตรวจ system health และดู estimated cost

ระบบนี้ใช้เพื่อช่วยทีมลดงาน manual ในการสร้างภาพสินค้าและติดตามผลลัพธ์ โดยรวมขั้นตอนที่เคยกระจายกันอยู่ เช่น prompt setup, generation, approval, export, asset lookup, job tracking และ admin recovery ให้อยู่ในเครื่องมือเดียว

ผู้ใช้งานหลักมี 2 กลุ่ม:

| กลุ่ม | ใช้งานหลัก |
| --- | --- |
| Staff | สร้างภาพ, ตรวจภาพ, approve, ดูงานทั้งหมด, ดูคลังภาพ, ดู KPI Dashboard |
| Admin/Owner/Operator | ทำได้เหมือน staff และเพิ่ม user management, Google Drive OAuth, Monitoring/System Health, Costs, Retry/Recovery |

สถานะปัจจุบัน: พร้อมเข้าสู่ final production test และ real team rollout หลังจากผ่าน **Production Test Checklist** ในเอกสารนี้ครบถ้วน

สิ่งที่ระบบช่วยลดงาน manual:

- ลดการเขียน prompt ซ้ำด้วย flow สร้าง Hero/Support ที่ล็อก logic ไว้ในระบบ
- ลดการตามไฟล์ด้วย Google Drive export และ Asset Library
- ลดการถามสถานะงานด้วยหน้า **งานทั้งหมด**
- ลดการตามปัญหาแบบเดา ด้วย **Monitoring / System Health**
- ลดงาน admin ด้าน user ด้วย Staff Management, Create User, Reset Password
- ลดการ debug แบบกระจัดกระจายด้วย job id, generation id, audit/recovery และ troubleshooting SOP

## Completed feature checklist

### Workflow

| Feature | Status | หมายเหตุ |
| --- | --- | --- |
| Login / Logout | Completed | ใช้งานได้โดยไม่ต้อง hard refresh |
| Temporary password flow | Completed | user ที่ถูกบังคับต้องเปลี่ยน password ก่อน workflow actions |
| Generate Hero | Completed | core workflow stable บน Render |
| Approve Hero | Completed | บันทึก approval และ export ต่อได้ |
| Generate Support | Completed | ใช้ Hero ที่ approve แล้วเป็น anchor |
| Approve Support | Completed | บันทึก support outputs |
| Google Drive export | Completed | ใช้ shared Google Drive OAuth |
| Supabase Storage / fallback handling | Completed | storage warning แยกจาก Drive export success |

### Admin

| Feature | Status | หมายเหตุ |
| --- | --- | --- |
| Staff Management | Completed | อยู่ใน **ตั้งค่า** สำหรับ admin |
| Create User | Completed | สร้าง staff/admin พร้อม temporary password |
| Reset Password | Completed | reset temporary password และบังคับเปลี่ยนรหัส |
| Role control | Completed | role `admin` / `staff` |
| Active/inactive user | Completed | ปิด user ได้โดยไม่ลบข้อมูล |

### Visibility / tracking

| Feature | Status | หมายเหตุ |
| --- | --- | --- |
| Jobs page | Completed | หน้า **งานทั้งหมด** พร้อม search/filter/pagination |
| Asset Library output-first | Completed | ค่าเริ่มต้นเน้น Outputs และมี Open image/Open Drive |
| KPI Dashboard | Completed | admin/staff เข้าถึงได้ตาม role ปัจจุบัน |
| Monitoring / System Health | Completed | admin only พร้อม pagination |
| Costs / Usage Tracking | Completed | admin only และระบุว่าเป็น estimated cost |

### Recovery

| Feature | Status | หมายเหตุ |
| --- | --- | --- |
| Retry generation/job | Completed | admin only |
| Retry export | Completed | admin only เฉพาะงานที่มี approved/generated source |
| Mark stuck job failed | Completed | admin only ใช้ปิดงานที่ค้าง |
| Startup recovery sweep | Completed | ลด active generation/job ที่ค้างจาก runtime ก่อนหน้า |

### Security / hardening

| Feature | Status | หมายเหตุ |
| --- | --- | --- |
| Admin/staff role gates | Completed | staff ไม่เห็น **ตั้งค่า**, **Monitoring**, **Costs** |
| API JSON 401/403/404 | Completed | hardened routes ส่ง JSON error |
| Secrets not exposed | Completed | health/API/log ไม่ควรเปิดเผย token/key/password/prompt |
| Health endpoint | Completed | `/api/health` แสดง safe status |
| Production checklist | Completed | checklist แยก launch/deploy/daily/weekly |

### Docs

| Document | Status | ใช้โดย |
| --- | --- | --- |
| [Staff SOP](./STAFF_SOP.md) | Completed | staff |
| [Admin Operating Manual](./ADMIN_OPERATING_MANUAL.md) | Completed | admin/owner/operator |
| [Troubleshooting](./TROUBLESHOOTING.md) | Completed | staff/admin/dev |
| [Production Checklist](./PRODUCTION_CHECKLIST.md) | Completed | admin/dev ก่อนและหลัง rollout |

## Role matrix

| Feature | Admin | Staff |
| --- | --- | --- |
| Login / Logout | Yes | Yes |
| เปลี่ยน password ชั่วคราว | Yes | Yes |
| Generate image / Generate Hero | Yes | Yes |
| Approve Hero | Yes | Yes |
| Generate Support | Yes | Yes |
| Approve Support | Yes | Yes |
| Jobs / งานทั้งหมด | Yes | Yes |
| Asset Library / คลังภาพ | Yes | Yes |
| KPI Dashboard | Yes | Yes |
| Settings / ตั้งค่า | Yes | No |
| Google Drive OAuth | Yes | No |
| Staff Management | Yes | No |
| Create user | Yes | No |
| Reset password | Yes | No |
| Role control | Yes | No |
| Active/inactive user | Yes | No |
| Monitoring / System Health | Yes | No |
| Costs / Usage Tracking | Yes | No |
| Retry generation/job | Yes | No |
| Retry Export | Yes | No |
| Mark Failed | Yes | No |
| `/api/health` safe check | Yes | ใช้ได้ถ้า URL เปิด public แต่ admin เป็นผู้ตีความ |

## Production test checklist

ให้ทำ checklist นี้กับ production URL ก่อน rollout ทีมจริง ถ้าข้อใด fail ให้แก้ก่อนประกาศใช้งานจริง

### Admin test

| Test | สิ่งที่ต้องเห็น | Result |
| --- | --- | --- |
| Login admin | เข้า workflow ได้และเห็นเมนู admin | Pending |
| Create user | สร้าง user ใหม่ได้ใน **ตั้งค่า** > Staff Management | Pending |
| Reset password | reset temporary password ได้และ user ถูกบังคับเปลี่ยนรหัส | Pending |
| Generate Hero | ภาพ Hero ถูกสร้างสำเร็จ | Pending |
| Approve Hero | status approved/exported และมี Drive link ถ้า Drive connected | Pending |
| Generate Support | Support Set ถูกสร้างจาก Hero ที่ approve แล้ว | Pending |
| Approve Support | Support outputs ถูกบันทึก/export | Pending |
| Open Jobs | **งานทั้งหมด** โหลด search/filter/pagination ได้ | Pending |
| Open Asset Library | **คลังภาพ** default Outputs และเปิด Open image/Open Drive ได้ | Pending |
| Open KPI | **KPI Dashboard** โหลดข้อมูลตามช่วงเวลา | Pending |
| Open Monitoring | **Monitoring / System Health** โหลด health/stuck/failed/events ได้ | Pending |
| Open Costs | **Costs** โหลด estimated cost และ retry impact | Pending |
| Retry controls visibility | admin เห็น Retry/Retry Export/Mark Failed เฉพาะรายการที่ควรมี | Pending |
| Logout | กลับหน้า login โดยไม่ hard refresh | Pending |

### Staff test

| Test | สิ่งที่ต้องเห็น | Result |
| --- | --- | --- |
| Login staff | เข้า workflow ได้ | Pending |
| No Settings | ไม่เห็น/เข้า **ตั้งค่า** ไม่ได้ | Pending |
| No Monitoring | ไม่เห็น/เข้า **Monitoring / System Health** ไม่ได้ | Pending |
| No Costs | ไม่เห็น/เข้า **Costs** ไม่ได้ | Pending |
| Generate/approve works | Generate Hero, Approve Hero, Generate Support, Approve Support ใช้งานได้ | Pending |
| Jobs accessible | **งานทั้งหมด** เปิดได้และไม่มี recovery controls | Pending |
| Asset Library accessible | **คลังภาพ** เปิดได้และเห็น outputs | Pending |
| KPI accessible | **KPI Dashboard** เปิดได้ตาม role ปัจจุบัน | Pending |
| Logout | กลับหน้า login โดยไม่ hard refresh | Pending |

### Mobile test

ทดสอบ viewport ประมาณ 390-430px เช่น mobile Safari/Chrome หรือ responsive mode

| Test | สิ่งที่ต้องเห็น | Result |
| --- | --- | --- |
| Login | form ใช้งานได้ ไม่มี horizontal overflow | Pending |
| Generate | กรอกงานและกด Generate ได้ | Pending |
| Approve | preview/ปุ่ม approve ใช้งานได้ | Pending |
| Jobs | ตาราง/รายการอ่านและเลื่อนได้โดยไม่พัง layout | Pending |
| Asset Library | cards และปุ่ม Open image/Open Drive ใช้งานได้ | Pending |
| KPI Dashboard | ถ้า role เข้าถึงได้ ต้องอ่าน summary/cards ได้ | Pending |
| No horizontal overflow | ไม่มี layout ล้นแนวนอนแบบใช้งานยาก | Pending |

### API/security test

| Test | สิ่งที่ต้องเห็น | Result |
| --- | --- | --- |
| Unauthenticated admin API | ได้ 401 JSON | Pending |
| Staff calls admin API | ได้ 403 JSON | Pending |
| Unknown `/api` route | ได้ 404 JSON ไม่ใช่ HTML | Pending |
| `/api/health` | safe JSON ไม่เปิดเผย secret/token/password/prompt | Pending |
| Staff direct hash | staff เปิด `#settings`, `#monitoring`, `#costs` ไม่ได้ | Pending |
| Logs | ไม่มี FAL key, Supabase service role, OAuth token, password หรือ raw prompt | Pending |

## Known limitations

- ตัวเลขใน **Costs** เป็น estimated cost ไม่ใช่ provider invoice
- ยังไม่มี exact FAL invoice-level reconciliation
- Supabase Storage warning อาจเกิดได้ แต่ถ้า Google Drive export สำเร็จ ไฟล์ปลายทางยังใช้งานได้
- full automated backup policy อาจต้องตั้งค่าเพิ่มเติมภายนอก repo เช่น Supabase/Render/Drive policy
- ยังไม่มี email/SMS notification automation สำหรับแจ้ง failure หรือแจ้ง user
- ยังไม่มี full multi-tenant organization support ถ้าต้องแยกหลายบริษัท/หลาย owner
- Staff SOP ต้องรีวิวกับ staff จริงก่อน rollout เพื่อปรับคำที่ทีมใช้จริง
- Asset preview อาจไม่ใช่ source of truth เสมอไป ถ้ามี **Open Drive** ให้ใช้ Drive link เป็นไฟล์ปลายทางหลัก

## Daily admin routine

ทำทุกวันก่อนหรือระหว่างเปิดให้ทีมใช้งาน:

1. เปิด **Monitoring / System Health** ช่วง Today
2. ตรวจ Google Drive health ว่า connected
3. ตรวจ failed/stuck jobs
4. ตรวจ pending approvals หรืองานที่ค้างใน **งานทั้งหมด**
5. ตรวจ **คลังภาพ** ว่างานล่าสุดมี output และ Open Drive
6. ตรวจ **Costs** ถ้ามี generate/retry จำนวนมาก
7. Review recent activity และ staff performance เมื่อจำเป็น
8. Review staff issues เช่น login ไม่ได้, temporary password, เห็นเมนูผิด role

## Weekly maintenance routine

ทำทุกสัปดาห์หรือก่อนรอบใช้งานใหญ่:

1. เปิด **KPI Dashboard** ช่วง Last 7 days
2. Review approve/export funnel และงานที่ตกหล่น
3. เปิด **Costs** ดู retry/failed patterns และ highest cost jobs
4. Review failed/retry patterns ใน **Monitoring / System Health**
5. Cleanup test users/data ถ้าจำเป็นและไม่กระทบ production records
6. ตรวจ Google Drive folders, permission และ ownership
7. Verify backup/export process ตาม policy ของทีม
8. Review staff access: active/inactive, admin ที่เกินจำเป็น, password required
9. อัปเดต SOP/Troubleshooting ถ้าทีมเจอเคสซ้ำ

## Launch readiness decision

สถานะ decision ใช้ 3 ระดับ:

| Decision | ความหมาย | ใช้เมื่อ |
| --- | --- | --- |
| Ready | พร้อมเปิดให้ทีมจริงใช้งาน | Production Test Checklist ผ่านครบ ไม่มี critical warning |
| Ready with warnings | ใช้งานจริงได้โดยมีข้อควรเฝ้าดู | core workflow ผ่าน แต่มี warning ที่ไม่ block เช่น storage warning ที่ Drive export สำเร็จ |
| Not ready | ยังไม่ควร rollout | login, role gate, generate, approve, export, หรือ admin recovery fail |

คำแนะนำสำหรับสถานะปัจจุบัน:

พร้อมใช้งานจริงหลังจากผ่าน Production Test Checklist ด้านล่างครบถ้วน

เหตุผล: feature set หลักเสร็จครบตาม phase ปัจจุบัน แต่เอกสารนี้ไม่ได้แทน production smoke test จริงบนบัญชี admin/staff และงาน test ล่าสุด

## Rollback / emergency notes

ใช้ส่วนนี้เมื่อ production หลัง deploy มีปัญหาที่กระทบ workflow จริง

1. ตรวจ latest Git commit และ Render deploy ล่าสุด
2. เปิด Render logs เพื่อดู error หลัง deploy
3. ถ้า deploy ใหม่ทำ workflow หลักเสีย ให้ rollback ใน Render ไป deploy ล่าสุดที่ผ่าน smoke test
4. ถ้า user มีปัญหาหรือสิทธิ์ผิด ให้ disable user ผ่าน **ตั้งค่า** > Staff Management ก่อน
5. ถ้า Google Drive export fail ให้ reconnect Google Drive จาก **ตั้งค่า**
6. ใช้ **Monitoring / System Health** เพื่อหา failed jobs, stuck jobs และ failed exports
7. ใช้ **Retry**, **Retry Export**, หรือ **Mark Failed** เฉพาะเคสที่ตรงคู่มือ admin
8. หลีกเลี่ยงการลบ database rows ด้วยมือ เว้นแต่จำเป็นจริงและมี backup/approval
9. ก่อนประกาศกลับมาใช้งาน ให้ทดสอบ Login/Logout, Generate Hero, Approve Hero, Generate Support, Approve Support, Jobs, Asset Library และ role gate

## Next improvement roadmap

รายการนี้เป็น optional future phases ไม่ใช่ blocker สำหรับ launch ปัจจุบัน:

| Improvement | ประโยชน์ |
| --- | --- |
| Real invoice-level cost reconciliation | เทียบ estimated cost กับ invoice จริงจาก provider |
| Notification system | แจ้ง admin เมื่อ job fail/stuck หรือ Drive disconnected |
| Advanced asset search | ค้น asset ด้วย metadata เพิ่ม เช่น brand/category/date/status |
| Bulk operations | จัดการหลายงานพร้อมกัน เช่น bulk export/retry/cleanup |
| Automated backups | backup/export policy ที่ตรวจสอบได้เป็นรอบ |
| Custom domain | ใช้ domain ของธุรกิจแทน onrender URL |
| Staff training session | ลดคำถามซ้ำและตรวจ SOP กับทีมจริง |

## Sign-off references

ใช้เอกสารเหล่านี้ประกอบการ launch:

- [Production Checklist](./PRODUCTION_CHECKLIST.md)
- [Staff SOP](./STAFF_SOP.md)
- [Admin Operating Manual](./ADMIN_OPERATING_MANUAL.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
