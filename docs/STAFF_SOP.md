# Staff SOP: คู่มือใช้งานระบบสร้างภาพ

เอกสารนี้สำหรับทีมงานทั่วไปที่ใช้ระบบ image-workflow ทุกวัน เช่น สร้างภาพสินค้า ตรวจภาพ Approve และเปิดภาพจากคลังภาพหรือ Google Drive

เอกสารที่เกี่ยวข้อง: [Troubleshooting](./TROUBLESHOOTING.md), [Final Launch Review](./FINAL_LAUNCH_REVIEW.md)

## ระบบนี้ใช้ทำอะไร

ระบบนี้ใช้สร้างภาพสินค้าแบบ workflow จริงบน production:

1. กรอกข้อมูลงานและ reference ในหน้า **สร้างภาพ**
2. กด **Generate Hero** เพื่อสร้างภาพหลัก
3. ตรวจคุณภาพภาพ Hero
4. กด **Approve + Save** เพื่อบันทึกและ export
5. กด **Generate Support Set** เพื่อสร้างภาพมุมเสริม
6. ตรวจภาพ Support
7. กด **Approve Support Set**
8. ตามงานที่หน้า **งานทั้งหมด** และเปิดภาพที่หน้า **คลังภาพ**

## สิทธิ์ของ staff

| ทำได้ | ทำไม่ได้ |
| --- | --- |
| Login / Logout | เข้าหน้า **ตั้งค่า** |
| เปลี่ยนรหัสผ่านชั่วคราวเมื่อระบบบังคับ | เข้าหน้า **Monitoring / System Health** |
| ใช้หน้า **สร้างภาพ** | เข้าหน้า **Costs** |
| Generate Hero / Support | สร้าง user หรือ reset password ให้คนอื่น |
| Approve Hero / Support | กด Retry / Retry Export / Mark Failed |
| ดู **งานทั้งหมด** และ **คลังภาพ** | เชื่อม Google Drive OAuth |
| ดู **KPI Dashboard** | เปลี่ยน role หรือสถานะบัญชี |

สิ่งที่ต้องเห็น: staff จะเห็นเมนู **สร้างภาพ**, **งานทั้งหมด**, **คลังภาพ**, **KPI Dashboard**

ถ้าไม่เป็นแบบนี้ให้ทำอะไร: ถ้า staff เห็น **ตั้งค่า**, **Monitoring**, หรือ **Costs** ให้หยุดใช้งานและแจ้ง admin ทันที พร้อม screenshot และ email user

## วิธี Login

1. เปิด URL production ของระบบ
2. ใส่ email
3. ใส่ password
4. กด **Login**

สิ่งที่ต้องเห็น: ระบบเปิดหน้า **สร้างภาพ** และแสดงเมนูด้านซ้าย

ถ้าไม่เป็นแบบนี้ให้ทำอะไร:

| อาการ | ให้ทำอะไร |
| --- | --- |
| login ไม่ผ่าน | ตรวจ email/password อีกครั้ง แล้วแจ้ง admin ถ้ายังไม่ได้ |
| ขึ้นว่าบัญชีไม่ได้รับสิทธิ์ | แจ้ง admin ให้ตรวจ `active/inactive` |
| วนกลับหน้า login | hard refresh 1 ครั้ง แล้วลองใหม่ |

## วิธี Logout

1. กด **Logout**
2. รอระบบกลับไปหน้า login

สิ่งที่ต้องเห็น: หน้า login กลับมาโดยไม่ต้อง hard refresh

ถ้าไม่เป็นแบบนี้ให้ทำอะไร: refresh หน้า browser แล้วแจ้ง admin ถ้า session ยังไม่ออก

## วิธีเปลี่ยนรหัสผ่านชั่วคราว

กรณี admin สร้าง user ใหม่หรือ reset password ระบบจะบังคับเปลี่ยนรหัสหลัง login

1. Login ด้วย temporary password ที่ admin ให้
2. เมื่อเห็นหน้าตั้งรหัสใหม่ ให้กรอก password ใหม่
3. กรอกยืนยัน password ใหม่ให้ตรงกัน
4. กด **บันทึกรหัสผ่าน**
5. Login หรือใช้งานต่อเมื่อระบบเปิดหน้า workflow

สิ่งที่ต้องเห็น: หลังบันทึกแล้วเข้าหน้า **สร้างภาพ** ได้

ถ้าไม่เป็นแบบนี้ให้ทำอะไร:

| อาการ | ให้ทำอะไร |
| --- | --- |
| temporary password ใช้ไม่ได้ | ขอ admin reset password ใหม่ |
| password ใหม่สั้นเกินไป | ใช้อย่างน้อย 8 ตัวอักษร |
| confirm password ไม่ตรง | กรอกใหม่ทั้ง 2 ช่อง |
| เปลี่ยนแล้ว login ไม่ได้ | แจ้ง admin พร้อม email และเวลาที่ทำรายการ |

ข้อควรระวัง: ห้ามแชร์ password หรือ temporary password ใน group chat ที่ไม่ปลอดภัย

## วิธี Generate Hero

1. เข้าเมนู **สร้างภาพ**
2. ในส่วน **ตั้งค่างานและอัปโหลด Reference** กรอกข้อมูลที่จำเป็น เช่น ผู้ทำงาน, SKU, brand, category, subtype, image type, color, key feature, model profile, shot type, image size, quality
3. ใส่ reference ด้วยวิธีใดวิธีหนึ่ง:
   - วาง Google Drive URL หรือชื่อไฟล์ในช่อง reference
   - อัปโหลดภาพสินค้าในช่อง Product reference
   - อัปโหลดภาพ model reference ถ้างานนั้นต้องใช้
4. ตรวจ notes ให้ชัด เช่น จุดที่ห้ามเปลี่ยน สี โลโก้ หรือ feature สำคัญ
5. กด **Generate Hero**
6. รอจนระบบสร้างภาพเสร็จ ห้ามกดซ้ำระหว่าง loading

สิ่งที่ต้องเห็น:

| ช่วงเวลา | สิ่งที่ควรเห็น |
| --- | --- |
| หลังกด Generate | ข้อความกำลังสร้างภาพ Hero หรือ loading state |
| ระหว่างรอ | ปุ่มอาจถูก disable หรือสถานะยังทำงานอยู่ |
| สำเร็จ | ภาพ Hero แสดงใน preview และปุ่ม **Approve + Save** ใช้งานได้ |

ถ้าไม่เป็นแบบนี้ให้ทำอะไร: ถ้าค้างนานผิดปกติ ให้จดเวลาที่กด, job id ถ้ามี, screenshot และแจ้ง admin

## วิธีตรวจ Hero

ก่อนกด approve ให้ตรวจ:

| จุดตรวจ | ต้องผ่านอย่างไร |
| --- | --- |
| สินค้า | รูปทรง สี วัสดุ และ feature สำคัญไม่เพี้ยน |
| โลโก้/ป้าย | ไม่มั่ว ไม่หาย ถ้ามี reference ชัด |
| หมวดสินค้า | เป็นสินค้าประเภทเดียวกับที่เลือก |
| Styling | เหมาะกับสินค้า winter/travel ตาม brief |
| ภาพรวม | ใช้ขายได้ ไม่เบลอ ไม่ผิดสัดส่วนรุนแรง |
| ข้อห้ามใน notes | ระบบทำตามข้อห้ามหลัก |

สิ่งที่ต้องเห็น: ภาพ Hero ที่ผ่าน QC และพร้อมใช้เป็น anchor สำหรับ Support

ถ้าไม่เป็นแบบนี้ให้ทำอะไร: ถ้าภาพผิดชัดเจน อย่ากด Approve ให้สร้างงานใหม่หรือแจ้ง admin ตาม policy ทีม

## วิธี Approve Hero

1. ตรวจภาพ Hero ให้ผ่าน QC
2. กด **Approve + Save**
3. รอจนระบบบันทึกและ export เสร็จ

สิ่งที่ต้องเห็น:

| หลัง approve | ความหมาย |
| --- | --- |
| สถานะ approved/exported หรือมี export link | ระบบบันทึกผลและส่งออกแล้ว |
| ปุ่ม Generate Support Set ใช้งานได้ | Hero พร้อมใช้สร้าง Support |

ถ้าไม่เป็นแบบนี้ให้ทำอะไร: ถ้า approve ค้างหรือไม่มี export link หลังรอแล้ว ให้แจ้ง admin พร้อม job id/generation id และ screenshot

## วิธี Generate Support

ทำได้หลังจาก Hero ผ่าน approve แล้ว

1. อยู่หน้า **สร้างภาพ**
2. ตรวจว่ามี Hero ที่ approve แล้ว
3. เลือกหรือเพิ่ม support shot ถ้าจำเป็น
4. กด **Generate Support Set**
5. รอให้ระบบสร้างครบ ห้ามกดซ้ำระหว่าง loading

สิ่งที่ต้องเห็น: Support gallery แสดงภาพมุมเสริม เช่น มุมหน้า มุมข้าง มุมหลัง หรือรายละเอียดตามสินค้านั้น

ถ้าไม่เป็นแบบนี้ให้ทำอะไร: ถ้า support ไม่เริ่มหรือค้าง ให้จด job id/generation id ของ Hero และแจ้ง admin

## วิธีตรวจ Support

ตรวจว่า support shot ช่วยขายสินค้าและไม่ขัดกับ Hero:

| จุดตรวจ | ต้องเห็น |
| --- | --- |
| มุมภาพ | แต่ละภาพเป็นมุมเสริมจริง ไม่ซ้ำ Hero ทั้งหมด |
| ความต่อเนื่อง | สินค้า สี styling และ model logic ไม่ขัดกับ Hero |
| รายละเอียด | เห็น feature สำคัญ เช่น texture, side view, back view, top view ตาม shot |
| คุณภาพ | ไม่เบลอ ไม่ผิด anatomy/product shape ชัดเจน |

ถ้าไม่เป็นแบบนี้ให้ทำอะไร: อย่า approve support ที่ผิดมาก ให้แจ้ง admin หรือสร้างใหม่ตามขั้นตอนของทีม

## วิธี Approve Support

1. ตรวจ Support gallery
2. กด **Approve Support Set**
3. รอให้ระบบบันทึกและ export

สิ่งที่ต้องเห็น: สถานะ support approved/exported หรือภาพไปอยู่ใน **คลังภาพ**

ถ้าไม่เป็นแบบนี้ให้ทำอะไร: แจ้ง admin พร้อม job id, generation id, screenshot, เวลา และบอกว่าเกิดตอน Approve Support

## วิธีดู Jobs / งานทั้งหมด

1. เข้าเมนู **งานทั้งหมด**
2. เลือกช่วงเวลา **Today**, **Last 7 days**, **Last 30 days**, หรือ **All time**
3. ค้นหาด้วย SKU / job id / email / ชื่องาน
4. กรองสถานะได้ เช่น `queued`, `generating`, `hero_ready`, `failed`, `draft`
5. ใช้ **Previous / Next** เมื่อต้องดูหลายหน้า

สิ่งที่ต้องเห็น: ตารางมีคอลัมน์ งาน, ผู้สร้าง, Workflow, Export, Activity

ถ้าไม่เป็นแบบนี้ให้ทำอะไร:

| อาการ | ให้ทำอะไร |
| --- | --- |
| ไม่เจองานวันนี้ | เปลี่ยนช่วงเวลาเป็น Last 7 days หรือ All time |
| status ดูไม่ตรง | กด **รีเฟรช** แล้วตรวจอีกครั้ง |
| โหลดไม่สำเร็จ | แจ้ง admin พร้อม screenshot และ page URL |

## วิธีดู Asset Library / คลังภาพ

1. เข้าเมนู **คลังภาพ**
2. ค่าเริ่มต้นคือ **Outputs** สำหรับดูผลงานที่ออกจาก workflow
3. เลือก filter ได้: **Hero**, **Support**, **Approved / Exported**, **References**, **All**
4. ค้นหาด้วย SKU / job id / generation id
5. กด **Open image** เพื่อเปิดภาพ
6. กด **Open Drive** เพื่อเปิดไฟล์หรือ folder ใน Google Drive ถ้ามี link

สิ่งที่ต้องเห็น: card ภาพพร้อมชื่อไฟล์, สถานะ, job id/generation id แบบย่อ และปุ่มเปิดภาพหรือ Drive

ถ้าไม่เป็นแบบนี้ให้ทำอะไร:

| อาการ | ให้ทำอะไร |
| --- | --- |
| preview ไม่ขึ้นแต่มี Open Drive | กด Open Drive ก่อน ภาพอาจ export สำเร็จแต่ preview จาก storage ไม่พร้อม |
| ไม่มี Open Drive | แจ้ง admin ถ้างานควร export แล้ว |
| ค้นหาไม่เจอ | ลองใช้ job id/generation id หรือเปลี่ยนช่วงเวลาเป็น All time |

## การเข้าใจ status หลัก

| Status | ความหมายที่ใช้หน้างาน |
| --- | --- |
| `pending` | รอดำเนินการ หรือยังไม่ได้ approve/export |
| `queued` | ระบบรับงานแล้ว กำลังรอคิว |
| `generating` | AI กำลังสร้างภาพ |
| `ready` | พร้อมใช้งานหรือพร้อมขั้นตอนถัดไป |
| `generated` | สร้างภาพสำเร็จแล้ว |
| `hero_ready` | Hero พร้อมตรวจหรือ approve |
| `approved` | มีการ approve แล้ว |
| `exported` | ส่งออกไปปลายทางแล้ว เช่น Google Drive |
| `failed` | งานล้มเหลว ต้องให้ admin ตรวจ |
| `draft` | งานยังไม่เข้าสู่ขั้นตอนผลิตจริงหรือยังไม่สมบูรณ์ |

## วิธีแจ้งปัญหาให้ admin

ส่งข้อมูลนี้ให้ครบที่สุด:

| ข้อมูล | วิธีหา |
| --- | --- |
| screenshot | จับภาพหน้าจอที่เห็น error/status |
| job id | จากหน้า **งานทั้งหมด** หรือ **คลังภาพ** ปุ่ม copy ใน card |
| generation id | จากหน้า **คลังภาพ** หรือรายละเอียดในงาน |
| email user | email ที่ login ใช้งาน |
| เวลาเกิดปัญหา | ระบุวันที่และเวลาโดยประมาณ |
| page URL | URL หรือ hash เช่น `#create`, `#jobs`, `#assets` |
| ทำอะไรก่อนเกิดปัญหา | เช่น กด Generate Hero, Approve Hero, Generate Support |

ตัวอย่างข้อความแจ้ง admin:

> งาน SKU ABC123 กด Approve Hero เวลา 14:20 แล้วค้าง ไม่มี Open Drive ในคลังภาพ แนบ screenshot แล้ว job id: ..., generation id: ..., user: staff@example.com

## ข้อควรระวัง

- ห้ามกด **Generate Hero**, **Generate Support Set**, **Approve + Save**, หรือ **Approve Support Set** ซ้ำถ้าระบบกำลัง loading
- รอให้สถานะจบก่อนเปลี่ยนหน้า ถ้างานกำลังสร้างภาพ
- ห้ามแชร์ password หรือ temporary password
- อย่ากด approve ถ้าภาพผิดสินค้า สี โลโก้ หรือ feature สำคัญ
- ถ้าเห็นหน้า admin ที่ไม่ควรเห็น ให้หยุดใช้งานและแจ้ง admin
- ถ้า browser แสดงข้อมูลเก่า ให้ hard refresh 1 ครั้งก่อนแจ้งปัญหา
