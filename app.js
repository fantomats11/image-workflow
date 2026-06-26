const categories = {
  "เสื้อโค้ทยาว / พาร์กา": {
    off: "Show one long coat or parka as the main focus. Use a straight-on full product view. Preserve full garment length, hood, zipper, pockets, quilting, fur trim, logo patches, and original color.",
    on: "Show the same exact long coat or parka worn naturally by the model. Use a near full-body or full-body catalog crop that shows coat length clearly. Preserve garment length, fit, hood, zipper, pockets, fur trim, logos, and original color."
  },
  "เสื้อแจ็คเก็ต / เสื้อท่อนบน": {
    off: "Show one upper-body apparel item clearly as the main focus. Use a clean front-facing product view. Preserve collar, sleeves, zipper, pockets, lining, stitching, logos, and original color.",
    on: "Show the same exact upper-body apparel item worn naturally by the model. Use a clean upper-body or three-quarter catalog crop unless full body is explicitly needed. Preserve fit, construction details, logos, and original color."
  },
  "กางเกง": {
    off: "Show one pair of pants clearly as the main focus. Use a straight-on full-length view. Preserve waistband, pockets, seams, hems, lining details, and original color.",
    on: "Show the same exact pants worn naturally by the model. Use a clean waist-to-feet catalog crop. Preserve fit, silhouette, waistband, pockets, seams, hems, and original color. Style with an appropriate winter upper layer that frames the waistband without hiding it. No crop tops, exposed stomach, bikini-like tops, summer styling, or random fashion layering."
  },
  "รองเท้า / บูท": {
    off: "Show one pair of footwear as the main focus. Present left and right shoes neatly as a matched pair. Preserve sole shape, upper material, laces, straps, logos, lining, and original color.",
    on: "Show the same exact footwear worn naturally on a model, but crop only from just below the knee to the feet. Do not show the full body or face. Style with one clear winter lower-body layer such as fleece-lined leggings, skinny winter pants, fleece-lined jeans, quilted winter pants, ski pants, or winter skirt with opaque tights. Do not use bare legs as the main styling. Socks are optional and must stay secondary: only a neat thin cuff may peek 1-2 cm above the boot opening, never thick slouch socks or leg warmers. The shoes or boots remain the hero. Preserve shoe shape, shaft opening, sole, upper, logo, material texture, and original color."
  },
  "ถุงเท้า": {
    off: "Show one pair of socks clearly as the main focus. Present both socks neatly as a matched pair. Preserve knit texture, thickness, cuff, pattern, labels, and original color.",
    on: "Show the same exact socks worn naturally on a model, but crop only from lower calf to feet. Do not show the full body or face. Pair with cropped winter pants, leggings, or boots/slippers only when they do not hide the socks. The socks must be clearly visible and remain the hero."
  },
  "ถุงมือ": {
    off: "Show one pair of gloves clearly as the main focus. Present both gloves neatly as a matched pair. Preserve knit texture, cuffs, fingers, labels, lining, and original color.",
    on: "Show the same exact gloves worn naturally on a model, but crop only hands and forearms. Pair with a suitable winter sleeve or coat cuff so the arms do not look empty. Do not show the full body or face unless absolutely needed. The gloves must be clearly visible and remain the hero."
  },
  "หมวก": {
    off: "Show one winter hat clearly as the main focus. Preserve knit texture, pom-pom, folded cuff, label, shape, and original color.",
    on: "Show the same exact winter hat worn naturally by the model. Use a head-and-shoulders crop with a coordinated winter collar, scarf, knit, or jacket shoulder detail. The hat must be clearly visible and remain the hero."
  },
  "ผ้าพันคอ / อุปกรณ์ชิ้นเล็ก": {
    off: "Show the scarf or small accessory in a premium e-commerce arrangement. Preserve material texture, edges, folds, pattern, labels, and original color.",
    on: "Show the same exact scarf or accessory worn naturally by the model. Pair with an appropriate coat, knit, or jacket collar that explains how the accessory is worn. Preserve drape, material texture, pattern, label, and original color."
  },
  "ชุดกันหนาวเป็นเซ็ต": {
    off: "Show the full winter outfit set as a clean grouped catalog image. Preserve each item, color, proportion, material, and real branding.",
    on: "Show the same exact winter outfit set worn naturally by the model. Use a full-body catalog crop. Preserve every visible item, fit, color, and brand detail."
  }
};

const productSubtypes = {
  "เสื้อโค้ทยาว / พาร์กา": [
    { label: "ระบบเลือกจากภาพอ้างอิง", value: "auto", rule: "Infer the exact long outerwear subtype from the reference image and apply the most suitable long-coat/parka styling logic." },
    { label: "โอเวอร์โค้ท / Wool overcoat", value: "wool-overcoat", rule: "Long tailored coat logic: refined winter styling with knit sweater, thermal top, scarf, slim pants, or winter boots. Keep coat length and clean silhouette premium." },
    { label: "พาร์กาฮู้ดเฟอร์ / Fur-trim parka", value: "fur-parka", rule: "Parka logic: practical travel styling with thermal base layer, fleece midlayer, slim pants or ski pants, winter boots. Show hood, fur trim, zipper, pockets, and weather protection." },
    { label: "ลองดาวน์ / Long down coat", value: "long-down", rule: "Long down coat logic: warm padded styling with clean inner knit/thermal layer, fitted winter pants, and boots. Show quilting, hood, volume, and full length." },
    { label: "ลองแพดดิ้ง / Long padded coat", value: "long-padded-coat", rule: "Long padded coat logic: synthetic padded long winter coat styling. Show padded thickness, quilting or panel construction, hood/collar, zipper, pockets, hem, and full length. Style with practical knit/thermal inner layer, winter pants, and boots. Do not describe it as real down unless brand/reference confirms down filling." },
    { label: "พาร์กาสกี / Ski parka", value: "ski-parka", rule: "Ski parka logic: technical winter outfit with thermal base, fleece/softshell layer, ski pants, gloves optional, and winter boots. Avoid city-fashion styling." },
    { label: "โค้ทเด็ก / Kids long coat", value: "kids-long-coat", rule: "Kids long coat logic: age-appropriate warm layering, cheerful but practical, with leggings/pants and boots. Avoid adult fashion poses." }
  ],
  "เสื้อแจ็คเก็ต / เสื้อท่อนบน": [
    { label: "ระบบเลือกจากภาพอ้างอิง", value: "auto", rule: "Infer the exact upper-body subtype from the reference image and apply the most suitable jacket/top styling logic." },
    { label: "แจ็คเก็ตพัฟเฟอร์ / Puffer jacket", value: "puffer-jacket", rule: "Puffer jacket logic: clean technical or casual winter layering with thermal top, fine knit, hoodie, fleece pullover, slim pants, or winter boots. Show quilting, volume, zipper, hem, and cuffs." },
    { label: "ครอปพัฟเฟอร์ / Cropped puffer jacket", value: "cropped-puffer-jacket", rule: "Cropped puffer jacket logic: short waist-length puffer styling. Show cropped hem, waistband relationship, quilting, volume, zipper, cuffs, and brand patch/logo clearly. Pair with high-waist winter pants, fleece-lined jeans, ski pants, or leggings so the waist area looks warm and intentional. No exposed stomach, crop tops, or summer styling." },
    { label: "ไลท์ดาวน์ / Light down jacket", value: "light-down", rule: "Light down logic: lightweight travel layering with fine-gauge knit, thermal top, merino base layer, or packable style. Keep jacket slim and product details readable." },
    { label: "เสื้อฟลีซ / Fleece jacket", value: "fleece-jacket", rule: "Fleece jacket logic: cozy midlayer styling with thermal base, cargo winter pants, leggings, or outdoor pants. Show fleece texture, collar, zipper, cuffs, and pocket details." },
    { label: "ซอฟต์เชลล์ / Softshell jacket", value: "softshell-jacket", rule: "Softshell logic: technical outdoor styling with base layer, ski pants, waterproof pants, or trekking pants. Keep it functional, clean, and weather-ready." },
    { label: "แจ็คเก็ตยีนส์บุขน / Denim sherpa jacket", value: "denim-sherpa", rule: "Denim sherpa logic: winter denim styling with knit, hoodie, fleece-lined jeans, corduroy/winter pants, or boots. Show sherpa collar/lining clearly. Avoid plain denim-only fashion." },
    { label: "ฮู้ดดี้ / Hoodie winter jacket", value: "hoodie-jacket", rule: "Hoodie jacket logic: casual winter layering with jogger winter pants, cargo pants, leggings, or puffer vest/jacket context. Show hood, cuffs, drawcord, and kangaroo/zip details." },
    { label: "คาร์ดิแกน/นิต / Knit cardigan", value: "knit-cardigan", rule: "Knit cardigan logic: warm knit styling with thermal inner, turtleneck/mock neck, winter skirt with tights, or fleece-lined pants. Show knit texture, buttons, hem, and sleeve shape." },
    { label: "เสื้อไหมพรม / Knit sweater", value: "knit-sweater", rule: "Knit sweater logic: hero is the sweater itself. Style with clean winter pants, skirt with tights, or layered under/open coat only if it does not hide knit texture, neckline, sleeves, hem, and fit." },
    { label: "เสื้อคอเต่า / Turtleneck sweater", value: "turtleneck-sweater", rule: "Turtleneck sweater logic: show neck height, rib texture, sleeve, hem, and fit clearly. Pair with winter pants, skirt with tights, coat opened, or puffer vest. Avoid generic plain-white styling unless product is white." },
    { label: "เสื้อเบสเลเยอร์ / Thermal base layer top", value: "thermal-base-layer-top", rule: "Thermal base layer top logic: fitted functional innerwear top. Show close fit, neckline, sleeve length, stretch fabric, and layering role. Style under opened jacket/coat or with winter pants without making it look like casual cropwear." },
    { label: "เสื้อลองจอนท่อนบน / Long john top", value: "long-john-top", rule: "Long john top logic: functional thermal underwear top. Keep styling practical and modest, with full torso coverage, fitted sleeves, and optional opened midlayer/outerwear to explain layering." },
    { label: "เสื้อกั๊กดาวน์ / Down vest", value: "down-vest", rule: "Down vest logic: layer over knit, hoodie, fleece, or thermal top with winter pants. Show armhole, zipper, quilting, and vest volume clearly." }
  ],
  "กางเกง": [
    { label: "ระบบเลือกจากภาพอ้างอิง", value: "auto", rule: "Infer the exact pants subtype from the reference image and apply the most suitable winter pants styling logic." },
    { label: "กางเกงสกี / Ski pants", value: "ski-pants", rule: "Ski pants logic: technical winter styling with fitted thermal top tucked in, fleece midlayer, softshell/ski jacket/puffer, gloves optional, and winter boots. No exposed midriff or fashion crop top." },
    { label: "กางเกงกันหนาวกันน้ำ / Waterproof winter pants", value: "waterproof-pants", rule: "Waterproof pants logic: outdoor/travel styling with base layer, softshell jacket, fleece, or technical top. Show waterproof fabric, seams, waistband, pockets, and hem." },
    { label: "กางเกงยีนส์บุขน / Fleece-lined jeans", value: "fleece-lined-jeans", rule: "Fleece-lined jeans logic: casual winter styling with knit sweater, hoodie under jacket, cropped puffer over tucked knit, or coat opened to show waistband. Show denim texture, lining if requested, fit, and hem." },
    { label: "เลกกิ้งกันหนาว / Thermal leggings", value: "thermal-leggings", rule: "Thermal leggings logic: fitted lower-body styling with oversized knit, long fleece, puffer, parka, or winter skirt layering. Keep leggings as the hero and avoid bare-skin/summer styling." },
    { label: "กางเกงสกินนี่กันหนาว / Skinny winter pants", value: "skinny-winter-pants", rule: "Skinny winter pants logic: clean waist-to-feet styling with knit, fleece, short puffer, long coat, or boots. Show slim fit, waistband, pocket, and hem interaction." },
    { label: "กางเกงขากว้างกันหนาว / Wide-leg winter pants", value: "wide-leg-winter-pants", rule: "Wide-leg winter pants logic: warm but polished styling with tucked knit, cropped puffer, wool coat opened, or fitted thermal top. Show drape, volume, waistband, and hem." },
    { label: "กางเกงคาร์โก้กันหนาว / Winter cargo pants", value: "winter-cargo-pants", rule: "Winter cargo pants logic: outdoor casual styling with hoodie, fleece, softshell, puffer, or winter boots. Show pockets, seams, fit, and hem clearly." },
    { label: "กางเกงเบสเลเยอร์ / Thermal base layer bottoms", value: "thermal-base-layer-bottoms", rule: "Thermal base layer bottoms logic: fitted innerwear bottoms/leggings used as warmth layer. Show stretch fabric, waistband, full length, and practical layering role with long top, opened coat, or winter boots. Avoid fashion leggings-only styling." },
    { label: "กางเกงลองจอน / Long john bottoms", value: "long-john-bottoms", rule: "Long john bottoms logic: functional thermal underwear bottoms. Keep modest full-coverage styling, show waistband/ankle cuffs/fabric, and optionally pair with long thermal top or opened outer layer to explain base-layer use." },
    { label: "กางเกงไหมพรม / Knit pants", value: "knit-pants", rule: "Knit pants logic: warm knit lower-body styling with matching sweater, long coat, cardigan, or indoor winter look. Show knit texture, waistband, drape, and hem clearly." },
    { label: "กางเกงสแล็คกันหนาว / Winter slacks", value: "winter-slacks", rule: "Winter slacks logic: polished cold-weather styling with tucked knit, wool coat, blazer-style coat, or boots/loafers as appropriate. Show crease, waistband, fit, and hem." },
    { label: "กางเกงเด็กกันหนาว / Kids winter pants", value: "kids-winter-pants", rule: "Kids winter pants logic: practical age-appropriate warm styling with sweater, fleece, puffer, or boots. Avoid adult fashion styling." }
  ],
  "รองเท้า / บูท": [
    { label: "ระบบเลือกจากภาพอ้างอิง", value: "auto", rule: "Infer the exact footwear subtype from the reference image and apply the most suitable winter footwear styling logic." },
    { label: "สโนว์บูท / Snow boots", value: "snow-boots", rule: "Snow boots logic: clean lower-leg styling with leggings, ski pants, fleece-lined jeans, or opaque tights. Boots dominate. Keep shaft, opening, sole, laces, and logo readable." },
    { label: "บูทข้อสั้น / Ankle boots", value: "ankle-boots", rule: "Ankle boot logic: boot shaft ends around ankle. Pair with fleece-lined jeans, skinny pants, leggings, or tights. Show ankle opening, side profile, sole, heel, and material texture." },
    { label: "บูทข้อกลาง / Mid-calf boots", value: "mid-calf-boots", rule: "Mid-calf boot logic: boot shaft reaches lower/mid calf. Pair with leggings, skinny winter pants tucked in, ski pants, or skirt with opaque tights. Show shaft height, opening, and side silhouette clearly." },
    { label: "บูทข้อยาว / Knee-high boots", value: "knee-high-boots", rule: "Knee-high boot logic: tall shaft styling with skinny winter pants, leggings, winter skirt with opaque tights, or long coat. Show full shaft height, fit around calf, and toe/sole clearly." },
    { label: "บูทส้นสูง / High heel boots", value: "high-heel-boots", rule: "High heel boot logic: polished winter fashion boot styling with opaque tights, slim winter pants, skirt/coat, or tailored coat. Show heel shape, toe, shaft height, and side profile. Keep styling winter-appropriate, not party/summer." },
    { label: "บูทแพลตฟอร์ม / Platform boots", value: "platform-boots", rule: "Platform boot logic: show platform sole height, side profile, toe shape, and shaft. Pair with leggings, fleece-lined jeans, winter skirt with tights, or long coat styling." },
    { label: "บูทบุขน / Fur-lined boots", value: "fur-lined-boots", rule: "Fur-lined boot logic: show fur lining/collar as a product detail while keeping styling clean. Pair with leggings, skinny pants, or winter skirt with tights." },
    { label: "บูทกันน้ำ / Waterproof boots", value: "waterproof-boots", rule: "Waterproof boot logic: technical travel styling with waterproof pants, ski pants, leggings, or outdoor pants. Show sole grip, waterproof upper, and shaft cleanly." },
    { label: "บูทเดินหิมะ/เดินป่า / Hiking winter boots", value: "hiking-winter-boots", rule: "Hiking winter boot logic: outdoor styling with trekking pants, thermal leggings, thick but neat socks only if needed, and functional stance. Show outsole, laces, toe protection, and grip." },
    { label: "รองเท้าผ้าใบกันหนาว / Winter sneakers", value: "winter-sneakers", rule: "Winter sneaker logic: low-cut winter footwear styling with fleece-lined jeans, winter joggers, leggings, or socks as secondary. Show outsole, upper texture, toe, and laces cleanly." },
    { label: "รองเท้าเด็กกันหนาว / Kids winter boots", value: "kids-winter-boots", rule: "Kids winter boots logic: practical kids lower-leg crop with warm pants or leggings. Keep safe, playful, and product-focused." }
  ],
  "ถุงเท้า": [
    { label: "ระบบเลือกจากภาพอ้างอิง", value: "auto", rule: "Infer the exact sock subtype from the reference image and keep socks as the main product." },
    { label: "ถุงเท้าวูล / Wool socks", value: "wool-socks", rule: "Wool socks logic: show knit thickness, cuff, warmth, and texture. Pair with cropped pants, indoor slippers, or boots only if socks stay visible." },
    { label: "ถุงเท้าบุขน / Fleece-lined socks", value: "fleece-lined-socks", rule: "Fleece-lined socks logic: show plush lining, thickness, cuff, and cozy texture. Avoid footwear hiding the product." },
    { label: "ถุงเท้ายาว / Long winter socks", value: "long-winter-socks", rule: "Long winter socks logic: calf/knee crop with winter skirt, leggings, or indoor styling. Keep sock length and pattern readable." },
    { label: "ถุงเท้าเด็ก / Kids winter socks", value: "kids-socks", rule: "Kids socks logic: cheerful but clean, age-appropriate, with socks as the clear hero." }
  ],
  "ถุงมือ": [
    { label: "ระบบเลือกจากภาพอ้างอิง", value: "auto", rule: "Infer the exact glove subtype from the reference image and keep gloves as the main product." },
    { label: "ถุงมือไหมพรม / Knit gloves", value: "knit-gloves", rule: "Knit glove logic: show knit texture, cuff, fingers, and warmth with sweater/coat sleeve framing the glove." },
    { label: "ถุงมือสกี / Ski gloves", value: "ski-gloves", rule: "Ski glove logic: technical styling with ski jacket sleeve, cuff closure, grip, insulation, and waterproof details." },
    { label: "ถุงมือหนัง/กันลม / Leather or windproof gloves", value: "leather-windproof-gloves", rule: "Leather/windproof glove logic: polished winter styling with coat sleeve, wrist fit, palm detail, and material sheen." },
    { label: "ถุงมือเด็ก / Kids gloves", value: "kids-gloves", rule: "Kids glove logic: age-appropriate warm sleeve pairing, playful but product-focused." }
  ],
  "หมวก": [
    { label: "ระบบเลือกจากภาพอ้างอิง", value: "auto", rule: "Infer the exact hat subtype from the reference image and keep the hat as the main product." },
    { label: "หมวกไหมพรม / Knit beanie", value: "knit-beanie", rule: "Beanie logic: show cuff, knit texture, label, and head fit with scarf/coat/knit shoulder styling." },
    { label: "หมวกปอมปอม / Pom-pom beanie", value: "pom-beanie", rule: "Pom-pom hat logic: show pom-pom volume, cuff, knit pattern, and cheerful head-and-shoulders styling." },
    { label: "หมวกบักเก็ต/ขนเฟอร์ / Fur bucket hat", value: "fur-bucket-hat", rule: "Fur hat logic: show plush texture, brim/shape, and winter collar/scarf context. Keep hat dominant." },
    { label: "หมวกเด็ก / Kids winter hat", value: "kids-hat", rule: "Kids hat logic: cheerful age-appropriate crop with warm collar/scarf and clear hat details." }
  ],
  "ผ้าพันคอ / อุปกรณ์ชิ้นเล็ก": [
    { label: "ระบบเลือกจากภาพอ้างอิง", value: "auto", rule: "Infer the exact accessory subtype from the reference image and keep the accessory as the main product." },
    { label: "ผ้าพันคอไหมพรม / Knit scarf", value: "knit-scarf", rule: "Knit scarf logic: show knit texture, fold, drape, tassel/edge, and how it layers with coat or sweater." },
    { label: "ผ้าพันคอขนเฟอร์ / Faux-fur scarf", value: "faux-fur-scarf", rule: "Faux-fur scarf logic: show plush volume, softness, and collar relationship. Keep styling premium and not bulky." },
    { label: "ที่ปิดหู / Earmuffs", value: "earmuffs", rule: "Earmuffs logic: head crop with clear ear placement, plush texture, and warm collar/scarf context." },
    { label: "อุปกรณ์กันหนาวชิ้นเล็ก / Small winter accessory", value: "small-accessory", rule: "Small accessory logic: crop close enough to show use and texture. Keep props minimal and product dominant." }
  ],
  "ชุดกันหนาวเป็นเซ็ต": [
    { label: "ระบบเลือกจากภาพอ้างอิง", value: "auto", rule: "Infer the exact outfit set type and coordinate all pieces into one complete travel-ready winter look." },
    { label: "เซ็ตเที่ยวเมืองหนาว / Travel winter set", value: "travel-set", rule: "Travel set logic: complete outfit with outerwear, innerwear, pants, shoes, and accessories coordinated for cold-weather trips." },
    { label: "เซ็ตสกี / Ski set", value: "ski-set", rule: "Ski set logic: technical snow outfit with ski jacket, ski pants, thermal layer, gloves, and snow boots. Functional and sport-ready." },
    { label: "เซ็ตเด็ก / Kids winter set", value: "kids-set", rule: "Kids set logic: age-appropriate complete winter outfit, practical and cheerful, with safe proportions and warm layering." },
    { label: "เซ็ตครอบครัว / Family set", value: "family-set", rule: "Family set logic: coordinated winter outfits across family members while keeping each item readable and practical." }
  ]
};

const DEFAULT_IMAGE_TYPE = "ภาพสินค้าเด่น / ไม่มีโมเดล";

const imageTypes = {
  [DEFAULT_IMAGE_TYPE]: {
    mode: "Off-model",
    prompt: "สร้างภาพสินค้าเดี่ยวแบบ product-first สำหรับตรวจขาย/เช่าออนไลน์ ไม่มีโมเดล ไม่มีข้อความ ให้สินค้าเป็นจุดเด่นหลัก อ้างอิงภาพสินค้าจริงเป็นหลัก"
  },
  "ใส่กับโมเดล": {
    mode: "On-model",
    prompt: "สร้างภาพรีวิวสินค้าขณะสวมใส่ ให้ดูเรียล เข้าถึงง่าย และเหมาะกับลูกค้าไทยที่เตรียมเดินทางเมืองหนาว สินค้ายังเป็นจุดเด่นหลักและต้องตรงกับภาพอ้างอิง"
  },
  "Close-up จุดเด่น": {
    mode: "Support",
    prompt: "Create a close-up detail image focused only on the product feature. Keep the same exact product identity and show the feature clearly for customer decision-making."
  },
  "มุมด้านหลัง": {
    mode: "Support",
    prompt: "Create a back view support image. Change only the shot type. Keep the same product identity, lighting direction, and approved hero set feel."
  },
  "มุมด้านข้าง": {
    mode: "Support",
    prompt: "Create a side view support image. Change only the shot type. Keep the same product identity, lighting direction, and approved hero set feel."
  },
  "เปิดให้เห็นด้านใน": {
    mode: "Support",
    prompt: "Create an interior or open-view support image. Show the inside lining or hidden construction clearly while preserving the exact product identity."
  }
};

const brandProfiles = {
  "go-mall": {
    label: "GO Mall - ภาพสินค้า + โมเดลได้",
    shortName: "GO Mall",
    forceOffModel: false,
    backgroundRule: "Scene rule: keep the image clean, uncluttered, product-first, and easy to inspect. Let the model choose a natural product-review setting from the references and prompt.",
    modelRule: "Model casting: friendly social-commerce energy.",
    styleRule: "Visual style: clear retail readability, modern Thai shopping feel, product-forward, realistic, and easy to compare."
  },
  "winterra": {
    label: "Winterra - ภาพพรีเมียม + โมเดลได้",
    shortName: "Winterra",
    forceOffModel: false,
    backgroundRule: "Scene rule: keep the image refined, clean, uncluttered, product-first, and consistent with the approved hero set.",
    modelRule: "Model casting: slightly more premium, calm, refined, and aspirational.",
    styleRule: "Visual style: premium winter travel retail, realistic, product-forward, polished, and easy to inspect."
  },
  "rent-a-coat": {
    label: "Rent A Coat - สินค้าเด่น / ไม่มีโมเดล",
    shortName: "Rent A Coat",
    forceOffModel: true,
    backgroundRule: "Scene rule: product-only, clean, practical, uncluttered, and easy to inspect. Do not add a model, face, body parts, mannequin, or lifestyle scene.",
    modelRule: "Model casting: no human model for this brand profile. Product-only images only, including hero and support shots.",
    styleRule: "Visual style: product-only rental catalog, practical, clear, realistic, comparison-friendly, no model, no face, no lifestyle scene."
  },
  custom: {
    label: "Custom / ไม่ล็อกฉาก",
    shortName: "Custom",
    forceOffModel: false,
    backgroundRule: "Scene rule: do not lock a specific background. Keep the image clean, product-first, realistic, and aligned with the approved hero set.",
    modelRule: "Model casting: use a modern Thai influencer feel where visible, cheerful and radiant expression when the face is shown.",
    styleRule: "Custom style: clean premium winter retail look, realistic material texture, and clear product readability."
  }
};

const modelProfiles = [
  "ระบบเลือกโมเดลให้เหมาะกับสินค้า",
  "ผู้หญิงไทยวัยทำงาน ลุค influencer สดใส",
  "ผู้ชายไทยวัยทำงาน ลุค influencer ดูดี",
  "Unisex ชายหญิงไทยวัยทำงาน ใส่สินค้ารุ่นเดียวกันร่วมเฟรม",
  "Unisex วัยรุ่นชายหญิง ลุคสดใส ใส่สินค้ารุ่นเดียวกันร่วมเฟรม",
  "วัยรุ่นหญิง ลุคสดใส",
  "วัยรุ่นชาย ลุคสดใส",
  "เด็กผู้หญิง ลุคครอบครัว",
  "เด็กผู้ชาย ลุคครอบครัว",
  "ผู้หญิง plus-size มั่นใจและสดใส",
  "ผู้ชาย plus-size อบอุ่น มั่นใจ เป็นธรรมชาติ",
  "เฉพาะขา/เท้า ไม่เห็นหน้า",
  "เฉพาะมือ/แขน ไม่เห็นหน้า"
];

const shotTypes = [
  "ระบบเลือกให้อัตโนมัติ",
  "ภาพหลัก - เห็นสินค้าชัดที่สุด",
  "ด้านหน้า",
  "ด้านหลัง",
  "ด้านข้าง",
  "โคลสอัพจุดเด่น",
  "เปิดให้เห็นด้านใน / ซับใน",
  "กางฮู้ด / ใส่ฮู้ด",
  "พื้นรองเท้า",
  "มุมบน",
  "ภาพใช้งานจริงแบบ lifestyle"
];

const supportShotPresets = {
  "เสื้อโค้ทยาว / พาร์กา": ["ด้านหน้า", "ด้านหลัง", "ด้านข้าง", "เปิดให้เห็นด้านใน / ซับใน", "โคลสอัพจุดเด่น"],
  "เสื้อแจ็คเก็ต / เสื้อท่อนบน": ["ด้านหน้า", "ด้านหลัง", "ด้านข้าง", "เปิดให้เห็นด้านใน / ซับใน", "โคลสอัพจุดเด่น"],
  "กางเกง": ["ด้านหน้า", "ด้านหลัง", "ด้านข้าง", "เปิดให้เห็นด้านใน / ซับใน", "โคลสอัพจุดเด่น"],
  "รองเท้า / บูท": ["ด้านข้าง", "มุมบน", "พื้นรองเท้า", "โคลสอัพจุดเด่น", "ภาพใช้งานจริงแบบ lifestyle"],
  "ถุงเท้า": ["ด้านหน้า", "ด้านข้าง", "โคลสอัพจุดเด่น", "ภาพใช้งานจริงแบบ lifestyle"],
  "ถุงมือ": ["ด้านหน้า", "ด้านในฝ่ามือ", "โคลสอัพจุดเด่น", "ภาพใช้งานจริงแบบ lifestyle"],
  "หมวก": ["ด้านหน้า", "ด้านข้าง", "โคลสอัพจุดเด่น", "ภาพใช้งานจริงแบบ lifestyle"],
  "ผ้าพันคอ / อุปกรณ์ชิ้นเล็ก": ["ด้านหน้า", "โคลสอัพจุดเด่น", "ภาพใช้งานจริงแบบ lifestyle"],
  "ชุดกันหนาวเป็นเซ็ต": ["ด้านหน้า", "ด้านหลัง", "โคลสอัพจุดเด่น", "ภาพใช้งานจริงแบบ lifestyle"]
};

const imageSizeOptions = [
  { label: "3:4 Medium 2K (1536x2048)", value: "custom_1536x2048" },
  { label: "1:1 Square HD", value: "square_hd" },
  { label: "4:3 Landscape 2K (2048x1536)", value: "custom_2048x1536" },
  { label: "9:16 Portrait 2K (1152x2048)", value: "custom_1152x2048" },
  { label: "16:9 Landscape 2K (2048x1152)", value: "custom_2048x1152" }
];

const qualityOptions = [
  { label: "Medium (เร็ว/ประหยัด เหมาะงาน bulk)", value: "medium" },
  { label: "High (ละเอียดขึ้น ใช้กับภาพ final)", value: "high" },
  { label: "Low (draft)", value: "low" }
];

const qcItems = [
  ["สินค้าเหมือนภาพอ้างอิง", "โครง สี สัดส่วน และวัสดุต้องไม่เปลี่ยน"],
  ["โลโก้/แบรนด์ถูกต้อง", "ห้ามสร้างโลโก้ปลอม หรือทำโลโก้จริงเพี้ยน"],
  ["หมวดสินค้าถูกต้อง", "ช็อตต้องเหมาะกับหมวด เช่น รองเท้าเห็นพื้น/คู่ครบ"],
  ["ภาพสะอาดและสินค้าเด่น", "ฉากหรือบริบทต้องไม่แย่งความเด่นจากสินค้า"],
  ["ไม่มีสิ่งแปลกปลอม", "ห้ามเพิ่มสินค้า คน หรือพร็อพที่ไม่ได้ขอ"],
  ["รายละเอียดจุดเด่นเห็นชัด", "เช่น บุขน ซิป ฮู้ด พื้นรองเท้า ป้ายแบรนด์"],
  ["พร้อมลงเว็บ", "คม ชัด ไม่เบี้ยว ไม่ crop ผิด และอ่านง่าย"]
];

const els = {
  authLoadingView: document.getElementById("authLoadingView"),
  authLoginView: document.getElementById("authLoginView"),
  gateLoginForm: document.getElementById("gateLoginForm"),
  gateLoginEmail: document.getElementById("gateLoginEmail"),
  gateLoginPassword: document.getElementById("gateLoginPassword"),
  gateLoginButton: document.getElementById("gateLoginButton"),
  gateLoginMessage: document.getElementById("gateLoginMessage"),
  authBlockedView: document.getElementById("authBlockedView"),
  authBlockedMessage: document.getElementById("authBlockedMessage"),
  authBlockedLogoutButton: document.getElementById("authBlockedLogoutButton"),
  authPasswordView: document.getElementById("authPasswordView"),
  pageNav: document.getElementById("pageNav"),
  pageViews: Array.from(document.querySelectorAll("[data-page]")),
  topbarEyebrow: document.querySelector(".topbar .eyebrow"),
  topbarTitle: document.querySelector(".topbar h2"),
  authCard: document.getElementById("authCard"),
  authState: document.getElementById("authState"),
  loginForm: document.getElementById("loginForm"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  loginButton: document.getElementById("loginButton"),
  logoutButton: document.getElementById("logoutButton"),
  passwordSetupForm: document.getElementById("passwordSetupForm"),
  passwordSetupNew: document.getElementById("passwordSetupNew"),
  passwordSetupConfirm: document.getElementById("passwordSetupConfirm"),
  passwordSetupMessage: document.getElementById("passwordSetupMessage"),
  passwordSetupButton: document.getElementById("passwordSetupButton"),
  systemStatus: document.getElementById("systemStatus"),
  form: document.getElementById("requestForm"),
  operatorName: document.getElementById("operatorName"),
  productSku: document.getElementById("productSku"),
  skuPickerSearch: document.getElementById("skuPickerSearch"),
  skuPickerClearButton: document.getElementById("skuPickerClearButton"),
  skuPickerResults: document.getElementById("skuPickerResults"),
  skuPickerStatus: document.getElementById("skuPickerStatus"),
  selectedProductSummary: document.getElementById("selectedProductSummary"),
  skuWorkClaimCard: document.getElementById("skuWorkClaimCard"),
  referenceReadinessCard: document.getElementById("referenceReadinessCard"),
  createDiagnosticsPanel: document.getElementById("createDiagnosticsPanel"),
  catalogReferencePanel: document.getElementById("catalogReferencePanel"),
  catalogReferenceStatus: document.getElementById("catalogReferenceStatus"),
  catalogReferenceCards: document.getElementById("catalogReferenceCards"),
  useCatalogReferencesButton: document.getElementById("useCatalogReferencesButton"),
  brandProfile: document.getElementById("brandProfile"),
  brandName: document.getElementById("brandName"),
  category: document.getElementById("category"),
  productSubtype: document.getElementById("productSubtype"),
  imageType: document.getElementById("imageType"),
  color: document.getElementById("color"),
  keyFeature: document.getElementById("keyFeature"),
  modelProfile: document.getElementById("modelProfile"),
  shotType: document.getElementById("shotType"),
  imageSize: document.getElementById("imageSize"),
  quality: document.getElementById("quality"),
  imageReference: document.getElementById("imageReference"),
  fallbackReferenceSection: document.getElementById("fallbackReferenceSection"),
  productImages: document.getElementById("productImages"),
  modelImages: document.getElementById("modelImages"),
  productPreview: document.getElementById("productPreview"),
  modelPreview: document.getElementById("modelPreview"),
  notes: document.getElementById("notes"),
  promptOutput: document.getElementById("promptOutput"),
  promptMode: document.getElementById("promptMode"),
  promptCategory: document.getElementById("promptCategory"),
  promptRisk: document.getElementById("promptRisk"),
  copyButton: document.getElementById("copyButton"),
  generateButton: document.getElementById("generateButton"),
  generateButtonReason: document.getElementById("generateButtonReason"),
  approveButton: document.getElementById("approveButton"),
  resultCard: document.getElementById("resultCard"),
  generationState: document.getElementById("generationState"),
  generationTitle: document.getElementById("generationTitle"),
  generationHint: document.getElementById("generationHint"),
  resultImage: document.getElementById("resultImage"),
  resultStatus: document.getElementById("resultStatus"),
  emptyHero: document.getElementById("emptyHero"),
  heroStatus: document.getElementById("heroStatus"),
  studioMaster: document.getElementById("studioMaster"),
  studioMasterStatus: document.getElementById("studioMasterStatus"),
  studioMasterCard: document.getElementById("studioMasterCard"),
  studioMasterImage: document.getElementById("studioMasterImage"),
  studioMasterMessage: document.getElementById("studioMasterMessage"),
  studioMasterEmpty: document.getElementById("studioMasterEmpty"),
  generateStudioMasterButton: document.getElementById("generateStudioMasterButton"),
  rerunStudioMasterButton: document.getElementById("rerunStudioMasterButton"),
  approveStudioMasterButton: document.getElementById("approveStudioMasterButton"),
  supportStatus: document.getElementById("supportStatus"),
  resetSupportButton: document.getElementById("resetSupportButton"),
  supportShotList: document.getElementById("supportShotList"),
  customSupportShot: document.getElementById("customSupportShot"),
  addCustomShotButton: document.getElementById("addCustomShotButton"),
  generateSupportButton: document.getElementById("generateSupportButton"),
  approveSupportButton: document.getElementById("approveSupportButton"),
  supportGallery: document.getElementById("supportGallery"),
  addQueueButton: document.getElementById("addQueueButton"),
  resetButton: document.getElementById("resetButton"),
  clearHistoryButton: document.getElementById("clearHistoryButton"),
  refreshNextActionsButton: document.getElementById("refreshNextActionsButton"),
  nextActionsLoadingState: document.getElementById("nextActionsLoadingState"),
  nextActionsErrorState: document.getElementById("nextActionsErrorState"),
  nextActionsEmptyState: document.getElementById("nextActionsEmptyState"),
  nextActionsGrid: document.getElementById("nextActionsGrid"),
  nextActionsAdminSummary: document.getElementById("nextActionsAdminSummary"),
  refreshJobsButton: document.getElementById("refreshJobsButton"),
  jobsRangeControls: document.getElementById("jobsRangeControls"),
  jobsPageSize: document.getElementById("jobsPageSize"),
  jobsPrevPage: document.getElementById("jobsPrevPage"),
  jobsNextPage: document.getElementById("jobsNextPage"),
  jobsPageInfo: document.getElementById("jobsPageInfo"),
  jobsLoadingState: document.getElementById("jobsLoadingState"),
  jobsErrorState: document.getElementById("jobsErrorState"),
  historySearch: document.getElementById("historySearch"),
  historyStatusFilter: document.getElementById("historyStatusFilter"),
  historyCategoryFilter: document.getElementById("historyCategoryFilter"),
  jobSummary: document.getElementById("jobSummary"),
  assetsRangeControls: document.getElementById("assetsRangeControls"),
  assetLibraryHelper: document.getElementById("assetLibraryHelper"),
  assetTypeTabs: document.getElementById("assetTypeTabs"),
  assetSearch: document.getElementById("assetSearch"),
  assetJobIdFilter: document.getElementById("assetJobIdFilter"),
  assetsPageSize: document.getElementById("assetsPageSize"),
  assetsPrevPage: document.getElementById("assetsPrevPage"),
  assetsNextPage: document.getElementById("assetsNextPage"),
  assetsPageInfo: document.getElementById("assetsPageInfo"),
  assetsLoadingState: document.getElementById("assetsLoadingState"),
  assetsErrorState: document.getElementById("assetsErrorState"),
  assetGallery: document.getElementById("assetGallery"),
  assetStatus: document.getElementById("assetStatus"),
  refreshMetricsButton: document.getElementById("refreshMetricsButton"),
  kpiRangeControls: document.getElementById("kpiRangeControls"),
  kpiLoadingState: document.getElementById("kpiLoadingState"),
  kpiErrorState: document.getElementById("kpiErrorState"),
  kpiEmptyState: document.getElementById("kpiEmptyState"),
  kpiExecutiveSummary: document.getElementById("kpiExecutiveSummary"),
  kpiUpdatedAt: document.getElementById("kpiUpdatedAt"),
  kpiWarnings: document.getElementById("kpiWarnings"),
  kpiCards: document.getElementById("kpiCards"),
  kpiTrendChart: document.getElementById("kpiTrendChart"),
  kpiFunnel: document.getElementById("kpiFunnel"),
  kpiStatusBreakdown: document.getElementById("kpiStatusBreakdown"),
  kpiStaffPerformance: document.getElementById("kpiStaffPerformance"),
  kpiRecentActivity: document.getElementById("kpiRecentActivity"),
  refreshMonitoringButton: document.getElementById("refreshMonitoringButton"),
  monitoringRangeControls: document.getElementById("monitoringRangeControls"),
  monitoringPageSize: document.getElementById("monitoringPageSize"),
  monitoringPrevPage: document.getElementById("monitoringPrevPage"),
  monitoringNextPage: document.getElementById("monitoringNextPage"),
  monitoringPageInfo: document.getElementById("monitoringPageInfo"),
  monitoringLoadingState: document.getElementById("monitoringLoadingState"),
  monitoringErrorState: document.getElementById("monitoringErrorState"),
  monitoringEmptyState: document.getElementById("monitoringEmptyState"),
  monitoringHealthSummary: document.getElementById("monitoringHealthSummary"),
  monitoringUpdatedAt: document.getElementById("monitoringUpdatedAt"),
  monitoringWarnings: document.getElementById("monitoringWarnings"),
  monitoringSummaryCards: document.getElementById("monitoringSummaryCards"),
  monitoringIntegrationHealth: document.getElementById("monitoringIntegrationHealth"),
  monitoringStuckJobs: document.getElementById("monitoringStuckJobs"),
  monitoringFailedItems: document.getElementById("monitoringFailedItems"),
  monitoringWordPressPreflights: document.getElementById("monitoringWordPressPreflights"),
  monitoringRecentEvents: document.getElementById("monitoringRecentEvents"),
  refreshCostsButton: document.getElementById("refreshCostsButton"),
  costRangeControls: document.getElementById("costRangeControls"),
  costPageSize: document.getElementById("costPageSize"),
  costPrevPage: document.getElementById("costPrevPage"),
  costNextPage: document.getElementById("costNextPage"),
  costPageInfo: document.getElementById("costPageInfo"),
  costLoadingState: document.getElementById("costLoadingState"),
  costErrorState: document.getElementById("costErrorState"),
  costEmptyState: document.getElementById("costEmptyState"),
  costExecutiveSummary: document.getElementById("costExecutiveSummary"),
  costUpdatedAt: document.getElementById("costUpdatedAt"),
  costNotes: document.getElementById("costNotes"),
  costKpiCards: document.getElementById("costKpiCards"),
  costTrendChart: document.getElementById("costTrendChart"),
  costWasteSummary: document.getElementById("costWasteSummary"),
  costStaffUsage: document.getElementById("costStaffUsage"),
  costJobList: document.getElementById("costJobList"),
  costRecentEvents: document.getElementById("costRecentEvents"),
  historyBody: document.getElementById("historyBody"),
  productionFlowBoard: document.getElementById("productionFlowBoard"),
  qcList: document.getElementById("qcList"),
  qcScore: document.getElementById("qcScore"),
  brandSettingsPreview: document.getElementById("brandSettingsPreview"),
  promptSettingsPreview: document.getElementById("promptSettingsPreview"),
  googleDriveIntegrationSection: document.getElementById("googleDriveIntegrationSection"),
  googleDriveStatusPill: document.getElementById("googleDriveStatusPill"),
  googleDriveStatusText: document.getElementById("googleDriveStatusText"),
  googleDriveConnectButton: document.getElementById("googleDriveConnectButton"),
  staffManagementSection: document.getElementById("staffManagementSection"),
  refreshStaffButton: document.getElementById("refreshStaffButton"),
  staffSearch: document.getElementById("staffSearch"),
  staffRoleFilter: document.getElementById("staffRoleFilter"),
  staffStatusFilter: document.getElementById("staffStatusFilter"),
  staffPasswordFilter: document.getElementById("staffPasswordFilter"),
  staffLoadingState: document.getElementById("staffLoadingState"),
  staffErrorState: document.getElementById("staffErrorState"),
  staffSuccessState: document.getElementById("staffSuccessState"),
  staffEmptyState: document.getElementById("staffEmptyState"),
  staffAdminList: document.getElementById("staffAdminList"),
  heroReviewTitle: document.getElementById("heroReviewTitle"),
  heroReviewStatus: document.getElementById("heroReviewStatus"),
  heroReviewMeta: document.getElementById("heroReviewMeta"),
  heroReviewProductSummary: document.getElementById("heroReviewProductSummary"),
  heroReviewReferenceSummary: document.getElementById("heroReviewReferenceSummary"),
  heroReviewRefCount: document.getElementById("heroReviewRefCount"),
  heroReviewGenerationId: document.getElementById("heroReviewGenerationId"),
  heroReviewRefs: document.getElementById("heroReviewRefs"),
  heroReviewHero: document.getElementById("heroReviewHero"),
  heroReviewSupportSet: document.getElementById("heroReviewSupportSet"),
  heroReviewApprovedAnchor: document.getElementById("heroReviewApprovedAnchor"),
  heroReviewSupportCount: document.getElementById("heroReviewSupportCount"),
  heroReviewSupportAssets: document.getElementById("heroReviewSupportAssets"),
  batchReviewTitle: document.getElementById("batchReviewTitle"),
  batchReviewRequest: document.getElementById("batchReviewRequest"),
  batchReviewStatus: document.getElementById("batchReviewStatus"),
  batchReviewNextAction: document.getElementById("batchReviewNextAction"),
  batchReviewPrimaryButton: document.getElementById("batchReviewPrimaryButton"),
  batchReviewLoadingState: document.getElementById("batchReviewLoadingState"),
  batchReviewErrorState: document.getElementById("batchReviewErrorState"),
  batchProgressGrid: document.getElementById("batchProgressGrid"),
  batchReviewBlockers: document.getElementById("batchReviewBlockers"),
  batchSkuGrid: document.getElementById("batchSkuGrid"),
  batchDebugDrawer: document.getElementById("batchDebugDrawer"),
  batchDebugContent: document.getElementById("batchDebugContent"),
  supportReviewSaveButton: document.getElementById("supportReviewSaveButton"),
  heroReviewDecisionDock: document.getElementById("heroReviewDecisionDock"),
  heroReviewRegenerateReason: document.getElementById("heroReviewRegenerateReason"),
  heroReviewApproveButton: document.getElementById("heroReviewApproveButton"),
  heroReviewRegenerateButton: document.getElementById("heroReviewRegenerateButton"),
  heroReviewMessage: document.getElementById("heroReviewMessage"),
  openCreateStaffButton: document.getElementById("openCreateStaffButton"),
  createStaffModal: document.getElementById("createStaffModal"),
  closeCreateStaffButton: document.getElementById("closeCreateStaffButton"),
  cancelCreateStaffButton: document.getElementById("cancelCreateStaffButton"),
  createStaffForm: document.getElementById("createStaffForm"),
  createStaffFullName: document.getElementById("createStaffFullName"),
  createStaffEmail: document.getElementById("createStaffEmail"),
  createStaffRole: document.getElementById("createStaffRole"),
  createStaffPassword: document.getElementById("createStaffPassword"),
  createStaffConfirmPassword: document.getElementById("createStaffConfirmPassword"),
  createStaffIsActive: document.getElementById("createStaffIsActive"),
  createStaffMustChangePassword: document.getElementById("createStaffMustChangePassword"),
  createStaffError: document.getElementById("createStaffError"),
  createStaffSubmitButton: document.getElementById("createStaffSubmitButton"),
  resetPasswordModal: document.getElementById("resetPasswordModal"),
  closeResetPasswordButton: document.getElementById("closeResetPasswordButton"),
  cancelResetPasswordButton: document.getElementById("cancelResetPasswordButton"),
  resetPasswordForm: document.getElementById("resetPasswordForm"),
  resetPasswordUserLabel: document.getElementById("resetPasswordUserLabel"),
  resetPasswordStatusLabel: document.getElementById("resetPasswordStatusLabel"),
  resetPasswordInactiveNote: document.getElementById("resetPasswordInactiveNote"),
  resetPasswordValue: document.getElementById("resetPasswordValue"),
  resetPasswordConfirmValue: document.getElementById("resetPasswordConfirmValue"),
  resetPasswordMustChange: document.getElementById("resetPasswordMustChange"),
  resetPasswordError: document.getElementById("resetPasswordError"),
  resetPasswordSubmitButton: document.getElementById("resetPasswordSubmitButton")
};

let currentPrompt = "";
let currentGeneratedImageUrl = "";
let approvedHeroImageUrl = "";
let currentStudioMasterImageUrl = "";
let approvedStudioMasterImageUrl = "";
let currentStudioMasterGenerationId = "";
let supportResults = [];
let customSupportShots = [];
let currentJobId = "";
let currentHeroGenerationId = "";
let lastSubmittedQcKey = "";
let lastRecordedApprovalGenerationId = "";
let localJobHistory = loadJobHistory();
let dbJobHistory = [];
let jobHistory = localJobHistory;
let jobHistoryError = "";
let latestJobsData = null;
let latestNextActionsData = null;
let nextActionsError = "";
let nextActionsLoading = false;
let latestBatchReviewData = null;
let batchReviewError = "";
let batchReviewLoading = false;
let batchReviewActionInProgress = false;
let selectedJobsRange = "today";
let selectedJobsPage = 1;
let selectedJobsPageSize = 10;
let jobsSearchTimer = null;
let latestAssetsData = null;
let selectedAssetsRange = "today";
let selectedAssetType = "outputs";
let selectedAssetsPage = 1;
let selectedAssetsPageSize = 10;
let assetsSearchTimer = null;
let latestMetricData = null;
let selectedKpiRange = "today";
let latestMonitoringData = null;
let selectedMonitoringRange = "today";
let selectedMonitoringPage = 1;
let selectedMonitoringPageSize = 10;
let latestCostData = null;
let selectedCostRange = "today";
let selectedCostPage = 1;
let selectedCostPageSize = 10;
let selectedCatalogSku = null;
let selectedCatalogReferences = [];
let stagedCatalogReferenceKeys = [];
let catalogReferenceLoading = false;
let skuWorkClaimState = { status: "unclaimed", version: 0 };
let skuWorkClaimPollTimer = null;
let skuWorkClaimRequestSeq = 0;
let skuPickerSearchTimer = null;
const skuPickerMinQueryLength = 3;
const skuPickerSearchTimeoutMs = 8000;
const skuWorkClaimPollMs = 15000;
const skuWorkClaimStatuses = new Set([
  "checking",
  "unclaimed",
  "claimed_by_me",
  "claimed_by_other",
  "claim_failed"
]);
const exactSkuLookupMaxWarmRetries = 4;
let skuPickerSearchRequestSeq = 0;
let latestSkuPickerResults = [];
let latestStaffUsers = [];
let resetPasswordTargetUser = null;
let createStaffInProgress = false;
let resetPasswordInProgress = false;
const staffUpdateInProgress = new Set();
let supabaseClient = null;
let currentSession = null;
let currentProfile = null;
let passwordSetupRequired = false;
let passwordChangeInProgress = false;
let authFlowInProgress = false;
let authResolutionPromise = null;
let initialOperatorRouteApplied = false;
let appActionsBound = false;
let globalDiagnosticsBound = false;
const appStates = ["boot", "auth-loading", "logged-out", "blocked", "password-required", "app-ready", "logging-out"];
const validRoles = new Set(["admin", "staff"]);
const recoveryActionsInProgress = new Set();
const appState = {
  state: "boot",
  session: null,
  profile: null,
  currentJobId: null,
  currentGenerationId: null,
  actions: {
    generate: false,
    approve: false,
    logout: false
  }
};

const pageMeta = {
  next: { eyebrow: "เริ่มจากตรงนี้", title: "งานของฉันวันนี้" },
  create: { eyebrow: "เริ่มงานภาพสินค้า", title: "สร้างภาพสินค้า" },
  jobs: { eyebrow: "ภาพรวมงานผลิต", title: "งานทั้งหมด" },
  assets: { eyebrow: "รูปทั้งหมด", title: "คลังภาพ" },
  kpi: { eyebrow: "ภาพรวมทีม", title: "ผลงานทีมภาพ" },
  costs: { eyebrow: "ต้นทุน", title: "ต้นทุนและการใช้งาน" },
  monitoring: { eyebrow: "สุขภาพระบบ", title: "ติดตามระบบ" },
  review: { eyebrow: "ตรวจภาพหลัก", title: "ตรวจภาพหลักก่อนสร้างภาพเสริม" },
  batch: { eyebrow: "ตรวจชุดงาน", title: "Batch Review" },
  settings: { eyebrow: "ผู้ดูแลระบบ", title: "ตั้งค่าระบบภาพ" }
};

function fillSelect(select, items) {
  select.innerHTML = "";
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = typeof item === "string" ? item : item.value;
    option.textContent = typeof item === "string" ? item : item.label;
    select.appendChild(option);
  });
}

function renderProductSubtypeOptions() {
  const subtypeOptions = productSubtypes[els.category.value] || [{ label: "ระบบเลือกจากภาพอ้างอิง", value: "auto", rule: "" }];
  fillSelect(els.productSubtype, subtypeOptions);
}

async function init() {
  setupGlobalDiagnostics();
  installGlobalEventHandlers();
  showAuthGate("auth-loading");
  els.operatorName.value = localStorage.getItem("winter-image-desk-operator") || "";
  fillSelect(els.brandProfile, Object.entries(brandProfiles).map(([value, profile]) => ({ value, label: profile.label })));
  fillSelect(els.category, Object.keys(categories));
  renderProductSubtypeOptions();
  fillSelect(els.imageType, Object.keys(imageTypes));
  fillSelect(els.modelProfile, modelProfiles);
  fillSelect(els.shotType, shotTypes);
  fillSelect(els.imageSize, imageSizeOptions);
  fillSelect(els.quality, qualityOptions);
  if (els.historyCategoryFilter) {
    fillSelect(els.historyCategoryFilter, [{ label: "ทุกหมวด", value: "" }, ...Object.keys(categories).map((category) => ({ label: category, value: category }))]);
  }
  renderQc();
  renderSupportShots();
  renderFilePreview(els.productImages, els.productPreview, 10);
  renderFilePreview(els.modelImages, els.modelPreview, 5);
  renderSkuPickerStatus();
  renderSelectedProductSummary();
  renderReferenceReadinessCard();
  updateCatalogDrivenFieldHierarchy();
  renderHistory();
  renderAssets();
  updateAssetLibraryHelper();
  renderSettingsPreview();
  applyBrandProfileUiHints();
  bindEvents();
  await initializeAuth();
  refreshSystemStatus();
  setInterval(refreshSystemStatus, 15000);
  updateWorkflowGate();
  navigateToPage(getPageFromHash());
}

async function initializeAuth() {
  if (!window.supabase?.createClient) {
    showBlocked("โหลด Supabase client ไม่สำเร็จ");
    return;
  }

  try {
    const response = await fetch("/api/supabase/config");
    const config = await response.json();
    if (!response.ok || !config.ok) {
      showBlocked("ยังไม่ได้ตั้งค่า SUPABASE_URL / SUPABASE_ANON_KEY");
      return;
    }

    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });

    const { data } = await promiseWithTimeout(
      supabaseClient.auth.getSession(),
      8000,
      "ตรวจสอบเซสชันไม่สำเร็จ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่"
    );
    currentSession = data.session || null;
    appState.session = currentSession;
    await runAuthResolution("init");

    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      currentSession = session || null;
      appState.session = currentSession;
      if (passwordChangeInProgress) return;
      if (event === "SIGNED_OUT") {
        if (authFlowInProgress || appState.state === "logging-out") return;
        clearFrontendAuthState();
        window.history.replaceState({}, document.title, `${window.location.pathname}#jobs`);
        showAuthGate("logged-out", "auth:event:signed_out");
        return;
      }
      if (event === "TOKEN_REFRESHED") {
        appState.session = currentSession;
        updateAuthUi(currentSession);
        return;
      }
      if (authFlowInProgress) return;
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED") {
        await runAuthResolution(`auth:event:${event.toLowerCase()}`);
      }
    });
  } catch (error) {
    showBlocked(`เชื่อม Supabase ไม่สำเร็จ: ${getSafeAuthErrorMessage(error)}`);
  }
}

function setPasswordSetupMessage(message, isSuccess = false) {
  els.passwordSetupMessage.textContent = message;
  els.passwordSetupMessage.classList.toggle("is-success", isSuccess);
}

function setupGlobalDiagnostics() {
  if (globalDiagnosticsBound) return;
  globalDiagnosticsBound = true;
  window.addEventListener("error", (event) => {
    console.error("[frontend:error]", {
      message: getSafeAuthErrorMessage(event.error || event.message),
      source: event.filename || "",
      line: event.lineno || 0,
      column: event.colno || 0
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    console.error("[frontend:unhandledrejection]", {
      message: getSafeAuthErrorMessage(event.reason)
    });
  });
  window.__workflowDebugState = () => ({
    state: appState.state,
    sessionPresent: Boolean(appState.session?.user),
    profile: appState.profile
      ? {
          id: appState.profile.id || "",
          email: appState.profile.email || "",
          role: appState.profile.role || "",
          is_active: appState.profile.is_active === true,
          must_change_password: appState.profile.must_change_password === true,
          profile_exists: profileExists(appState.profile)
        }
      : null,
    currentJobId: currentJobId || appState.currentJobId || "",
    currentGenerationId: currentHeroGenerationId || appState.currentGenerationId || "",
    actions: { ...appState.actions }
  });
}

async function runAuthResolution(reason = "") {
  if (authResolutionPromise) {
    console.info("[auth] resolution already running", { reason });
    return authResolutionPromise;
  }
  authResolutionPromise = resolveAuthGate(reason).finally(() => {
    authResolutionPromise = null;
  });
  return authResolutionPromise;
}

async function resolveAuthGate(reason = "") {
  console.info("[auth] resolve", { reason });
  if (currentSession?.user) {
    await refreshCurrentSession();
  }

  if (!currentSession?.user) {
    resetProfileState();
    showAuthGate("logged-out", "auth:no-session");
    return;
  }

  try {
    currentProfile = await loadCurrentProfile();
  } catch (error) {
    resetProfileState();
    showBlocked(getProfileErrorMessage(error));
    return;
  }

  if (!profileExists(currentProfile)) {
    resetProfileState();
    showBlocked("บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
    return;
  }

  if (!currentProfile.is_active) {
    passwordSetupRequired = false;
    applyRoleUi();
    updateAuthUi(currentSession);
    showBlocked("บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
    return;
  }

  passwordSetupRequired = currentProfile.must_change_password === true;
  currentProfile.role = normalizeRole(currentProfile.role);
  applyRoleUi();

  if (passwordSetupRequired) {
    updateAuthUi(currentSession);
    showAuthGate("password-required", "auth:must-change-password");
    return;
  }

  if (!validRoles.has(currentProfile.role)) {
    showBlocked("บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
    return;
  }

  showAuthGate("app-ready", "auth:profile-ready");
  updateAuthUi(currentSession);
  initAppActionsWhenReady();
  applyInitialOperatorRoute();
  refreshJobHistory();
  refreshMetrics();
  updateWorkflowGate();
  navigateToPage(getPageFromHash());
}

async function refreshCurrentSession() {
  const { data, error } = await promiseWithTimeout(
    supabaseClient.auth.getSession(),
    8000,
    "ตรวจสอบเซสชันไม่สำเร็จ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่"
  );
  if (error) throw error;
  currentSession = data.session || null;
  appState.session = currentSession;
  return currentSession;
}

async function refreshSessionProfileAndAppState() {
  await refreshCurrentSession();
  if (!currentSession?.access_token) {
    throw new Error("Session หมดอายุ กรุณา login ใหม่");
  }

  currentProfile = await loadCurrentProfileWithToken(currentSession.access_token);
  currentProfile.role = normalizeRole(currentProfile.role);
  passwordSetupRequired = currentProfile.must_change_password === true;
  applyRoleUi();

  if (passwordSetupRequired) {
    updateAuthUi(currentSession);
    showAuthGate("password-required", "auth:refreshed-password-required");
    return currentProfile;
  }

  if (!validRoles.has(currentProfile.role)) {
    showBlocked("บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
    return currentProfile;
  }

  showAuthGate("app-ready", "auth:refreshed-app-ready");
  updateAuthUi(currentSession);
  initAppActionsWhenReady();
  applyInitialOperatorRoute();
  updateWorkflowGate();
  navigateToPage(getPageFromHash());
  refreshJobHistory();
  refreshMetrics();
  return currentProfile;
}

async function loadCurrentProfile() {
  const response = await authFetch("/api/me", { allowPasswordRequired: true });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    const error = new Error(data.error || "Cannot load profile");
    error.code = data.code || "";
    throw error;
  }
  return data;
}

async function loadCurrentProfileWithToken(token) {
  const response = await fetch("/api/me", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "โหลดข้อมูลสิทธิ์ผู้ใช้ไม่สำเร็จ");
  }
  if (!profileExists(data)) {
    throw new Error("บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
  }
  if (!data.is_active) {
    throw new Error("บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
  }
  return data;
}

async function getLatestAccessToken() {
  const { data, error } = await promiseWithTimeout(
    supabaseClient.auth.getSession(),
    8000,
    "ตรวจสอบเซสชันไม่สำเร็จ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่"
  );
  if (error) throw error;
  currentSession = data.session || null;
  appState.session = currentSession;
  const token = currentSession?.access_token;
  if (!token) throw new Error("Session หมดอายุ กรุณา login ใหม่");
  return token;
}

function resetProfileState() {
  currentProfile = null;
  passwordSetupRequired = false;
  appState.profile = null;
  dbJobHistory = [];
  jobHistoryError = "";
  jobHistory = mergeJobHistory();
  renderHistory();
  updateAuthUi(currentSession);
}

function clearFrontendAuthState() {
  currentSession = null;
  currentProfile = null;
  passwordSetupRequired = false;
  passwordChangeInProgress = false;
  authFlowInProgress = false;
  appState.session = null;
  appState.profile = null;
  appState.actions.generate = false;
  appState.actions.approve = false;
  appState.actions.logout = false;
  dbJobHistory = [];
  jobHistoryError = "";
  latestJobsData = null;
  latestNextActionsData = null;
  latestAssetsData = null;
  latestMetricData = null;
  latestMonitoringData = null;
  selectedCatalogSku = null;
  selectedCatalogReferences = [];
  stagedCatalogReferenceKeys = [];
  latestSkuPickerResults = [];
  nextActionsError = "";
  nextActionsLoading = false;
  initialOperatorRouteApplied = false;
  resetTransientWorkflowState();
  jobHistory = mergeJobHistory();
  renderHistory();
  applyRoleUi();
  updateAuthUi(null, "ออกจากระบบแล้ว");
  updateWorkflowGate();
}

function resetTransientWorkflowState() {
  currentGeneratedImageUrl = "";
  approvedHeroImageUrl = "";
  currentStudioMasterImageUrl = "";
  approvedStudioMasterImageUrl = "";
  currentStudioMasterGenerationId = "";
  currentJobId = "";
  currentHeroGenerationId = "";
  lastSubmittedQcKey = "";
  lastRecordedApprovalGenerationId = "";
  supportResults = [];
  customSupportShots = [];
  setHeroLoading(false);
  els.generateButton.disabled = true;
  els.approveButton.disabled = true;
  els.generateStudioMasterButton.disabled = true;
  els.rerunStudioMasterButton.disabled = true;
  els.approveStudioMasterButton.disabled = true;
  els.generateSupportButton.disabled = true;
  els.approveSupportButton.disabled = true;
  els.generateButton.textContent = "สร้างภาพหลัก";
  els.approveButton.textContent = "อนุมัติและบันทึก";
  els.generateStudioMasterButton.textContent = "สร้าง Studio Master";
  els.rerunStudioMasterButton.textContent = "สร้างใหม่";
  els.approveStudioMasterButton.textContent = "อนุมัติ Studio Master";
  els.generateSupportButton.textContent = "สร้างภาพเสริม";
  els.approveSupportButton.textContent = "อนุมัติภาพเสริม";
  els.resultImage.hidden = true;
  els.resultImage.removeAttribute("src");
  els.resultStatus.textContent = "";
  els.emptyHero.hidden = false;
  renderStudioMasterPanel();
  resetQc();
  renderSupportShots();
  renderSupportGallery();
  renderAssets();
  renderSkuPickerStatus();
  renderCatalogReferencePanel();
  renderSelectedProductSummary();
  renderReferenceReadinessCard();
  updateCatalogDrivenFieldHierarchy();
  appState.currentJobId = null;
  appState.currentGenerationId = null;
}

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function profileExists(profile = currentProfile) {
  return profile?.profile_exists === true || Boolean(profile?.id && profile?.role);
}

function hasValidReadyProfile(profile = currentProfile) {
  const role = normalizeRole(profile?.role);
  return Boolean(profileExists(profile) && profile?.is_active === true && profile?.must_change_password !== true && validRoles.has(role));
}

function clearActionLoadingStates() {
  appState.actions.generate = false;
  appState.actions.approve = false;
  appState.actions.logout = false;
  setHeroLoading(false);
  els.generateButton.textContent = "สร้างภาพหลัก";
  els.approveButton.textContent = "อนุมัติและบันทึก";
  els.logoutButton.textContent = "ออกจากระบบ";
  els.authBlockedLogoutButton.textContent = "ออกจากระบบ";
}

function updateActionAvailability() {
  const readiness = getGenerateHeroReadiness();
  els.generateButton.disabled = readiness.disabled;
  if (els.generateButtonReason) {
    els.generateButtonReason.textContent = readiness.reason;
    els.generateButtonReason.className = `generate-button-reason ${readiness.tone ? `is-${readiness.tone}` : ""}`.trim();
  }
  const ready = isAppReady();
  els.approveButton.disabled = !ready || appState.actions.approve || !currentGeneratedImageUrl;
  els.generateStudioMasterButton.disabled = !ready || !canGenerateStudioMaster();
  els.rerunStudioMasterButton.disabled = !ready || !canGenerateStudioMaster();
  els.approveStudioMasterButton.disabled = !ready || !currentStudioMasterImageUrl || Boolean(approvedStudioMasterImageUrl);
  els.generateSupportButton.disabled = !ready || !canGenerateSupport();
  els.approveSupportButton.disabled = !ready || !supportResults.some((item) => item.imageUrl && item.status === "done");
  els.logoutButton.disabled = appState.actions.logout;
  els.authBlockedLogoutButton.disabled = appState.actions.logout;
}

function setActionLoading(name, isLoading) {
  if (Object.prototype.hasOwnProperty.call(appState.actions, name)) {
    appState.actions[name] = isLoading;
  }
  if (name === "generate") {
    els.generateButton.textContent = isLoading ? "กำลังสร้าง..." : "สร้างภาพหลัก";
  }
  if (name === "approve") {
    els.approveButton.textContent = isLoading ? "กำลังบันทึก..." : "อนุมัติและบันทึก";
  }
  if (name === "logout") {
    els.logoutButton.textContent = isLoading ? "กำลังออกจากระบบ..." : "ออกจากระบบ";
    els.authBlockedLogoutButton.textContent = isLoading ? "กำลังออกจากระบบ..." : "ออกจากระบบ";
  }
  updateActionAvailability();
}

function setAppState(nextState, reason = "", patch = {}) {
  if (!appStates.includes(nextState)) {
    console.warn("[state] invalid", nextState, reason);
    return;
  }

  const previousState = appState.state;
  if (Object.prototype.hasOwnProperty.call(patch, "session")) currentSession = patch.session;
  if (Object.prototype.hasOwnProperty.call(patch, "profile")) {
    currentProfile = patch.profile;
    passwordSetupRequired = currentProfile?.must_change_password === true;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "currentJobId")) currentJobId = patch.currentJobId || "";
  if (Object.prototype.hasOwnProperty.call(patch, "currentGenerationId")) currentHeroGenerationId = patch.currentGenerationId || "";

  appState.state = nextState;
  appState.session = currentSession;
  appState.profile = currentProfile;
  appState.currentJobId = currentJobId || null;
  appState.currentGenerationId = currentHeroGenerationId || null;
  console.info("[state]", previousState, "->", nextState, reason);

  if (previousState === "app-ready" && nextState !== "app-ready") {
    clearActionLoadingStates();
  }

  appStates.forEach((stateName) => document.body.classList.remove(stateName));
  const gateState = nextState === "boot" || nextState === "logging-out" ? "auth-loading" : nextState;
  document.body.classList.add(nextState);
  if (gateState !== nextState) document.body.classList.add(gateState);
  els.authLoadingView.hidden = gateState !== "auth-loading";
  els.authLoginView.hidden = gateState !== "logged-out";
  els.authBlockedView.hidden = gateState !== "blocked";
  els.authPasswordView.hidden = gateState !== "password-required";

  if (gateState === "auth-loading") {
    const loadingTitle = els.authLoadingView.querySelector("h1");
    if (loadingTitle) loadingTitle.textContent = nextState === "logging-out" ? "กำลังออกจากระบบ..." : "กำลังตรวจสอบสิทธิ์...";
  }
  if (gateState === "logged-out") {
    els.gateLoginMessage.textContent = "";
    els.gateLoginMessage.classList.remove("is-success");
    setTimeout(() => els.gateLoginEmail.focus(), 0);
  }
  if (gateState === "password-required") {
    setPasswordSetupMessage("");
    setTimeout(() => els.passwordSetupNew.focus(), 0);
  }
  applyRoleUi();
  updateAuthUi(currentSession);
  updateActionAvailability();
}

function showAuthGate(state, reason = "auth-gate") {
  setAppState(state, reason);
}

function showBlocked(message) {
  els.authBlockedMessage.textContent = message;
  els.authBlockedLogoutButton.hidden = !currentSession;
  showAuthGate("blocked");
}

function isAppReady() {
  return appState.state === "app-ready" && Boolean(currentSession?.access_token) && !passwordSetupRequired && hasValidReadyProfile(currentProfile);
}

function isAdmin() {
  return normalizeRole(currentProfile?.role) === "admin";
}

function getAppState() {
  return appState.state || "unknown";
}

function logAction(name, message, details = {}) {
  console.info(`[${name}] ${message}`, {
    appState: getAppState(),
    sessionPresent: Boolean(currentSession?.access_token),
    profilePresent: profileExists(currentProfile),
    role: currentProfile?.role || "",
    mustChangePassword: currentProfile?.must_change_password === true,
    ...details
  });
}

function getActionErrorMessage(error, fallback = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง") {
  const message = getSafeAuthErrorMessage(error);
  if (/session|jwt|auth|login|เซสชัน|เข้าสู่ระบบ/i.test(message)) return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่";
  if (/permission|forbidden|403|สิทธิ์|active/i.test(message)) return "บัญชีนี้ไม่มีสิทธิ์หรือยังไม่ได้เปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ";
  if (/429|rate.?limit|too many requests|quota|ถี่เกินไป/i.test(message)) {
    return "ระบบเรียกใช้งาน AI ถี่เกินไป กรุณารอสักครู่แล้วกดทำงานต่ออีกครั้ง";
  }
  return message || fallback;
}

async function runAction(name, fn, { errorTarget = els.resultStatus, requireAppReady = name !== "logout" } = {}) {
  if (appState.actions[name]) {
    logAction(name, "ignored", { reason: "action already running" });
    return;
  }
  if (requireAppReady && !isAppReady()) {
    logAction(name, "early exit", { reason: "app not ready" });
    if (errorTarget) errorTarget.textContent = "ระบบยังไม่พร้อม กรุณารอสักครู่แล้วลองใหม่";
    return;
  }

  console.info("[action] start", name);
  setActionLoading(name, true);
  try {
    await fn();
    console.info("[action] finish", name);
  } catch (error) {
    const message = getActionErrorMessage(error);
    console.error("[action] error", name, { message });
    if (errorTarget) errorTarget.textContent = message;
  } finally {
    setActionLoading(name, false);
  }
}

async function runProtectedUiAction(name, fn, options = {}) {
  return runAction(name, fn, options);
}

function initAppActionsWhenReady() {
  if (!isAppReady()) {
    console.info("[actions] init skipped", {
      appState: getAppState(),
      sessionPresent: Boolean(currentSession?.access_token),
      profilePresent: profileExists(currentProfile),
      role: currentProfile?.role || "",
      mustChangePassword: currentProfile?.must_change_password === true
    });
    return;
  }

  updateActionAvailability();
  console.info("[actions] bound", {
    appState: getAppState(),
    role: currentProfile.role
  });
}

function handleGenerateHero() {
  return runAction("generate", generateImage, { errorTarget: els.resultStatus });
}

function handleApproveSave() {
  return runAction("approve", approveImage, { errorTarget: els.resultStatus });
}

function isSelectedSkuReferenceBlocked() {
  return selectedCatalogSku?.reference_readiness?.status === "blocked";
}

function hasManualProductReferenceUpload() {
  return (els.productImages.files?.length || 0) > 0;
}

function hasStagedCatalogReferences() {
  return stagedCatalogReferenceKeys.length > 0;
}

function hasSelectedCatalogReferenceSource() {
  return Boolean(selectedCatalogSku?.reference_drive_id || selectedCatalogSku?.reference_url);
}

function hasSelectedCatalogStageableReferences() {
  return selectedCatalogReferences.some((reference) => reference.stage_available && (reference.generation_url || reference.staged_url) && reference.reference_key);
}

function canAutoUseCatalogReferencesForHero() {
  return Boolean(selectedCatalogSku?.sku && hasSelectedCatalogStageableReferences() && !isSelectedSkuReferenceBlocked());
}

function isSelectedSkuReferenceBlockedWithoutFallback() {
  return isSelectedSkuReferenceBlocked() && !hasManualProductReferenceUpload() && !hasStagedCatalogReferences();
}

function getSelectedSkuReferenceBlockerMessage() {
  const blocker = selectedCatalogSku?.reference_readiness?.blockers?.[0];
  return blocker?.message_th || "สินค้านี้ยังไม่มีรูปอ้างอิงที่พร้อมใช้ กรุณาใช้รูปจากแคตตาล็อก/Drive หรืออัปโหลดรูปสินค้าเองก่อนสร้างภาพหลัก";
}

function countSelectedReferenceFiles() {
  const summary = selectedCatalogSku?.resolution_summary || {};
  const readiness = selectedCatalogSku?.reference_readiness || {};
  const foundFiles = Number(summary.file_count || readiness.reference_count || selectedCatalogReferences.length || 0) || 0;
  const stageableImages = selectedCatalogReferences.filter((reference) => reference.stage_available && reference.reference_key).length
    || Number(summary.stageable_image_count || readiness.stageable_reference_count || 0)
    || stagedCatalogReferenceKeys.length
    || 0;
  const blockedFiles = selectedCatalogReferences.filter((reference) => (reference.blockers || []).length).length
    || Number(summary.blocked_file_count || readiness.blocked_reference_count || 0)
    || 0;
  return { foundFiles, stageableImages, blockedFiles };
}

function getCatalogDriveUrl() {
  const sourceFields = selectedCatalogSku?.reference_source_fields || {};
  if (sourceFields.resolved_reference_url) return sourceFields.resolved_reference_url;
  const driveFolderId = selectedCatalogSku?.reference_drive_id || "";
  return selectedCatalogSku?.reference_url || (driveFolderId ? `https://drive.google.com/drive/folders/${driveFolderId}` : "");
}

function getReferenceReadinessViewModel(message = "") {
  const counts = countSelectedReferenceFiles();
  const readiness = selectedCatalogSku?.reference_readiness || {};
  const driveUrl = getCatalogDriveUrl();
  const hasManualFallback = hasManualProductReferenceUpload();
  const hasSource = hasSelectedCatalogReferenceSource();
  const stageable = hasSelectedCatalogStageableReferences();
  const staged = hasStagedCatalogReferences();
  const blockers = (readiness.blockers || []).map((item) => item.message_th || item.code).filter(Boolean);
  const warnings = (readiness.warnings || []).map((item) => item.message_th || item.code).filter(Boolean);

  if (!selectedCatalogSku?.sku) {
    return {
      state: "empty",
      className: "reference-state-warning",
      title: "ยังไม่ได้เลือกสินค้า",
      description: message || "เลือกสินค้าจากแคตตาล็อก แล้วแอปจะตรวจรูปอ้างอิงให้",
      counts,
      driveUrl,
      blockers,
      warnings
    };
  }

  if (catalogReferenceLoading) {
    return {
      state: "loading",
      className: "reference-state-loading",
      title: "กำลังเตรียมรูปจาก Drive",
      description: message || "เจอข้อมูลสินค้าแล้ว กำลังดึงรูปอ้างอิงมาให้ใช้สร้างภาพหลัก",
      counts,
      driveUrl,
      blockers,
      warnings
    };
  }

  if (isSelectedSkuReferenceBlockedWithoutFallback()) {
    return {
      state: "blocked",
      className: "reference-state-blocked",
      title: "รูปอ้างอิงยังติดปัญหา",
      description: message || getSelectedSkuReferenceBlockerMessage(),
      counts,
      driveUrl,
      blockers,
      warnings
    };
  }

  if (staged || stageable) {
    return {
      state: "ready",
      className: "reference-state-ready",
      title: staged ? "รูปอ้างอิงพร้อมสร้างภาพหลัก" : "รูปอ้างอิงพร้อมใช้งาน",
      description: message || (staged ? `เตรียมรูปไว้แล้ว ${stagedCatalogReferenceKeys.length} รูป` : "แอปจะใช้รูปจากแคตตาล็อกให้อัตโนมัติ"),
      counts,
      driveUrl,
      blockers,
      warnings
    };
  }

  if (hasSource && warnings.length) {
    return {
      state: "warning",
      className: "reference-state-warning",
      title: "เจอรูปอ้างอิง แต่ควรตรวจดูอีกครั้ง",
      description: message || warnings[0] || "พบโฟลเดอร์ Google Drive แล้ว แต่ยังไม่มีรูปที่พร้อมใช้",
      counts,
      driveUrl,
      blockers,
      warnings
    };
  }

  if (!hasSource && !hasManualFallback) {
    return {
      state: "manual_fallback_needed",
      className: "reference-state-warning",
      title: "ต้องอัปโหลดรูปเอง",
      description: message || "สินค้านี้ยังไม่มีรูปจาก Drive ในแคตตาล็อก กรุณาแนบรูปสินค้าเอง",
      counts,
      driveUrl,
      blockers,
      warnings
    };
  }

  return {
    state: hasManualFallback ? "manual_fallback_ready" : "manual_fallback_needed",
    className: hasManualFallback ? "reference-state-ready" : "reference-state-warning",
    title: hasManualFallback ? "ใช้รูปที่อัปโหลดเองได้แล้ว" : "ต้องอัปโหลดรูปเอง",
    description: message || (hasManualFallback ? "จะใช้รูปที่อัปโหลดเป็นรูปอ้างอิงหลัก" : "ยังไม่มีรูปจากแคตตาล็อกที่พร้อมใช้"),
    counts,
    driveUrl,
    blockers,
    warnings
  };
}

function getGenerateHeroReadiness() {
  if (!isAppReady()) {
    return { disabled: true, tone: "blocked", reason: "กรุณาเข้าสู่ระบบก่อนเริ่มสร้างภาพ" };
  }
  if (appState.actions.generate) {
    return { disabled: true, tone: "loading", reason: "กำลังสร้างภาพหลัก..." };
  }
  const claimReadiness = getSkuWorkClaimReadiness();
  if (claimReadiness.disabled) return claimReadiness;
  if (catalogReferenceLoading && selectedCatalogSku?.sku && hasSelectedCatalogReferenceSource() && !hasManualProductReferenceUpload()) {
    return { disabled: true, tone: "loading", reason: "กำลังโหลดรูปอ้างอิงจาก Google Drive" };
  }
  if (isSelectedSkuReferenceBlockedWithoutFallback()) {
    return { disabled: true, tone: "blocked", reason: `ต้องอัปโหลดรูปเอง: ${getSelectedSkuReferenceBlockerMessage()}` };
  }
  if (!hasManualProductReferenceUpload() && selectedCatalogSku?.sku && hasSelectedCatalogReferenceSource() && !hasStagedCatalogReferences() && !canAutoUseCatalogReferencesForHero()) {
    return { disabled: true, tone: "warning", reason: "ยังไม่มีรูปจากแคตตาล็อก/Drive ที่พร้อมใช้" };
  }
  if (!hasManualProductReferenceUpload() && !hasStagedCatalogReferences() && !canAutoUseCatalogReferencesForHero()) {
    return { disabled: true, tone: "warning", reason: "เลือกสินค้าที่มีรูปพร้อมใช้ หรืออัปโหลดรูปเองก่อน" };
  }
  return {
    disabled: false,
    tone: "ready",
    reason: hasStagedCatalogReferences() || canAutoUseCatalogReferencesForHero()
      ? "พร้อมสร้างภาพหลักจากรูปอ้างอิง"
      : "พร้อมสร้างภาพหลักจากรูปที่อัปโหลด"
  };
}

function normalizeCatalogSkuLookup(value = "") {
  return String(value || "").trim().toUpperCase();
}

function looksLikeExactCatalogSku(value = "") {
  const query = normalizeCatalogSkuLookup(value);
  return query.length >= 9 && /^[A-Z0-9][A-Z0-9_-]+$/.test(query) && /\d/.test(query);
}

function renderSkuPickerStatus(message = "") {
  if (!els.skuPickerStatus) return;
  const readiness = selectedCatalogSku?.reference_readiness;
  els.skuPickerStatus.classList.remove("is-ready", "is-warning", "is-blocked");
  if (!selectedCatalogSku) {
    els.skuPickerStatus.textContent = message || "ค้นหาสินค้า แล้วแอปจะเติมข้อมูลกับรูปอ้างอิงให้เอง";
    updateActionAvailability();
    return;
  }
  const status = readiness?.status || "unknown";
  const blockers = (readiness?.blockers || []).map((item) => item.message_th || item.code).filter(Boolean);
  const warnings = (readiness?.warnings || []).map((item) => item.message_th || item.code).filter(Boolean);
  const productSummary = [
    selectedCatalogSku.branch || "",
    [selectedCatalogSku.category, selectedCatalogSku.subcategory].filter(Boolean).join(" / "),
    selectedCatalogSku.reference_url ? "มีรูปใน Google Drive" : ""
  ].filter(Boolean);
  els.skuPickerStatus.classList.add(status === "blocked" ? "is-blocked" : status === "ready" ? "is-ready" : "is-warning");
  els.skuPickerStatus.textContent = [
    `${selectedCatalogSku.sku} · ${selectedCatalogSku.product_name || "-"}`,
    productSummary.length ? `ข้อมูลสินค้า: ${productSummary.join(" · ")}` : "",
    catalogReferenceLoading ? "กำลังโหลดรูปจาก Google Drive..." : `รูปอ้างอิง: ${readiness?.label_th || status}`,
    blockers.length ? blockers[0] : "",
    warnings.length && !blockers.length ? warnings[0] : ""
  ].filter(Boolean).join("\n");
  updateActionAvailability();
}

function renderSelectedProductSummary() {
  if (!els.selectedProductSummary) return;
  if (!selectedCatalogSku?.sku) {
    els.selectedProductSummary.hidden = true;
    els.selectedProductSummary.innerHTML = "";
    return;
  }
  const brandProfile = getSelectedBrandProfile();
  const readiness = selectedCatalogSku.reference_readiness || {};
  const referenceLabel = readiness.label_th || readiness.status || "ยังไม่ทราบสถานะ";
  const driveUrl = getCatalogDriveUrl();
  const summaryRows = [
    ["รหัสสินค้า", selectedCatalogSku.sku],
    ["ชื่อสินค้า", selectedCatalogSku.product_name || "-"],
    ["สาขา / โปรไฟล์ภาพ", [selectedCatalogSku.branch, brandProfile.shortName].filter(Boolean).join(" / ") || "-"],
    ["หมวดสินค้า", [selectedCatalogSku.category, selectedCatalogSku.subcategory].filter(Boolean).join(" / ") || "-"],
    ["จุดเด่น", selectedCatalogSku.feature_notes || "-"],
    ["โฟลเดอร์รูป", driveUrl || selectedCatalogSku.canonical_source || "-"],
    ["สถานะรูปอ้างอิง", referenceLabel]
  ];
  els.selectedProductSummary.hidden = false;
  els.selectedProductSummary.classList.add("selected-product-summary");
  els.selectedProductSummary.innerHTML = `
    <div class="selected-product-summary-heading">
      <strong>${escapeHtml(selectedCatalogSku.product_name || selectedCatalogSku.sku)}</strong>
      <span>${escapeHtml(referenceLabel)}</span>
    </div>
    <dl>
      ${summaryRows.map(([label, value]) => `
        <div>
          <dt>${escapeHtml(label)}</dt>
          <dd>${driveUrl && label === "โฟลเดอร์รูป"
            ? `<a href="${escapeHtml(driveUrl)}" target="_blank" rel="noopener">${escapeHtml(value)}</a>`
            : escapeHtml(value)}</dd>
        </div>
      `).join("")}
    </dl>
  `;
}

function buildCreateDiagnosticsModel(message = "") {
  const readinessView = getReferenceReadinessViewModel(message);
  const claim = skuWorkClaimState || {};
  const sourceFields = selectedCatalogSku?.reference_source_fields || {};
  const rows = [
    ["รหัสสินค้า", selectedCatalogSku?.sku || "-"],
    ["สถานะรูปอ้างอิง", readinessView.state || "-"],
    ["สถานะงานที่ล็อกไว้", claim.status || "-"],
    ["เวอร์ชันงาน", String(claim.version || 0)],
    ["จุดตรวจสถานะงาน", claim.claim_status_endpoint || "-"],
    ["สถานะจากเซิร์ฟเวอร์", claim.http_status ? String(claim.http_status) : "-"],
    ["รหัสปัญหา", claim.error_code || "-"],
    ["โฟลเดอร์รูป", readinessView.driveUrl || "-"],
    ["แถวข้อมูลต้นทาง", sourceFields.source_row ? String(sourceFields.source_row) : "-"],
    ["โฟลเดอร์ที่เลือกใช้", sourceFields.resolved_reference_folder_id || sourceFields.reference_folder_id || "-"]
  ];
  const referenceIssues = [];
  for (const reference of selectedCatalogReferences) {
    const warnings = (reference.warnings || []).map((item) => item.message_th || item.code).filter(Boolean);
    const blockers = (reference.blockers || []).map((item) => item.message_th || item.code).filter(Boolean);
    const details = [
      reference.blocker_message || reference.blocker_code || "",
      ...blockers,
      ...warnings
    ].filter(Boolean);
    if (details.length) {
      referenceIssues.push({
        label: reference.label_th || reference.file_name || reference.reference_key || "รูปอ้างอิง",
        tone: blockers.length || reference.blocker_code || reference.blocker_message ? "danger" : "warning",
        details
      });
    }
  }
  return {
    rows,
    blockers: readinessView.blockers || [],
    warnings: readinessView.warnings || [],
    referenceIssues,
    claimMessage: claim.message || "",
    empty: !selectedCatalogSku?.sku
  };
}

function renderCreateDiagnosticsPanel(message = "") {
  if (!els.createDiagnosticsPanel) return;
  const diagnostics = buildCreateDiagnosticsModel(message);
  if (diagnostics.empty) {
    els.createDiagnosticsPanel.innerHTML = `<p class="diagnostics-empty">เลือกสินค้าก่อน แล้วจะแสดงสาเหตุเมื่อรูปหรืองานนี้มีปัญหา</p>`;
    return;
  }
  const statusRows = diagnostics.rows
    .filter(([, value]) => value && value !== "-")
    .map(([label, value]) => `
      <div>
        <dt>${escapeHtml(label)}</dt>
        <dd>${escapeHtml(value)}</dd>
      </div>
    `).join("");
  const readinessIssues = [
    ...diagnostics.blockers.map((item) => ({ tone: "danger", text: item })),
    ...diagnostics.warnings.map((item) => ({ tone: "warning", text: item }))
  ];
  els.createDiagnosticsPanel.innerHTML = `
    <dl class="diagnostics-kv">${statusRows}</dl>
    ${diagnostics.claimMessage ? `<div class="diagnostics-callout danger">${escapeHtml(diagnostics.claimMessage)}</div>` : ""}
    ${readinessIssues.length ? `
      <div class="diagnostics-group">
        <strong>สิ่งที่ต้องแก้ก่อนสร้างภาพ</strong>
        ${readinessIssues.map((issue) => `<span class="${escapeHtml(issue.tone)}">${escapeHtml(issue.text)}</span>`).join("")}
      </div>
    ` : ""}
    ${diagnostics.referenceIssues.length ? `
      <div class="diagnostics-group">
        <strong>รูปอ้างอิงที่ต้องตรวจ</strong>
        ${diagnostics.referenceIssues.map((issue) => `
          <details class="diagnostics-file">
            <summary>
              <span class="${escapeHtml(issue.tone)}">${escapeHtml(issue.tone === "danger" ? "ติดปัญหา" : "ควรตรวจ")}</span>
              ${escapeHtml(issue.label)}
            </summary>
            ${issue.details.map((detail) => `<small>${escapeHtml(detail)}</small>`).join("")}
          </details>
        `).join("")}
      </div>
    ` : ""}
    ${!diagnostics.claimMessage && !readinessIssues.length && !diagnostics.referenceIssues.length
      ? `<p class="diagnostics-empty">ยังไม่พบปัญหาที่ต้องตรวจเพิ่ม</p>`
      : ""}
  `;
}

function renderReferenceReadinessCard(message = "") {
  if (!els.referenceReadinessCard) return;
  if (!selectedCatalogSku?.sku) {
    els.referenceReadinessCard.hidden = true;
    els.referenceReadinessCard.innerHTML = "";
    renderCreateDiagnosticsPanel(message);
    return;
  }
  const view = getReferenceReadinessViewModel(message);
  const countLabels = [
    ["ไฟล์ที่พบ", view.counts.foundFiles],
    ["รูปพร้อมใช้", view.counts.stageableImages],
    ["ต้องตรวจ", view.counts.blockedFiles]
  ];
  const stateLabels = {
    empty: "รอเลือกสินค้า",
    loading: "กำลังเตรียมรูป",
    blocked: "ต้องแก้ก่อน",
    ready: "พร้อมใช้",
    warning: "ควรตรวจ",
    manual_fallback_needed: "ต้องแนบรูป",
    manual_fallback_ready: "พร้อมใช้"
  };
  els.referenceReadinessCard.hidden = false;
  els.referenceReadinessCard.className = `reference-readiness-card ${view.className}`;
  els.referenceReadinessCard.innerHTML = `
    <div class="reference-readiness-heading">
      <strong>${escapeHtml(view.title)}</strong>
      <span>${escapeHtml(stateLabels[view.state] || view.state)}</span>
    </div>
    <p>${escapeHtml(view.description)}</p>
    <div class="reference-readiness-counts">
      ${countLabels.map(([label, value]) => `<span><strong>${Number(value || 0)}</strong>${escapeHtml(label)}</span>`).join("")}
    </div>
    ${view.driveUrl ? `<a class="reference-drive-link" href="${escapeHtml(view.driveUrl)}" target="_blank" rel="noopener">เปิดโฟลเดอร์ใน Google Drive</a>` : ""}
  `;
  renderCreateDiagnosticsPanel(message);
}

function resetSkuWorkClaimState() {
  stopSkuWorkClaimPolling();
  skuWorkClaimRequestSeq += 1;
  skuWorkClaimState = { status: "unclaimed", version: 0 };
  renderSkuWorkClaimCard();
}

function normalizeSkuWorkClaimState(claim = {}) {
  const rawStatus = claim.status || claim.claim_status || "unclaimed";
  let status = "unclaimed";
  if (rawStatus === "available") {
    status = "unclaimed";
  } else if (rawStatus === "loading" || rawStatus === "claiming") {
    status = "checking";
  } else if (rawStatus === "claimed") {
    status = claim.locked_by_me ? "claimed_by_me" : "claimed_by_other";
  } else if (rawStatus === "error") {
    status = "claim_failed";
  } else if (skuWorkClaimStatuses.has(rawStatus)) {
    status = rawStatus;
  }
  return {
    ...claim,
    status,
    version: Number(claim.version ?? claim.current_version ?? 0)
  };
}

function setSkuWorkClaimFailed({ message = "", code = "", httpStatus = 0, endpoint = "" } = {}) {
  skuWorkClaimState = normalizeSkuWorkClaimState({
    ...skuWorkClaimState,
    status: "claim_failed",
    message,
    error_code: code,
    http_status: httpStatus,
    claim_status_endpoint: endpoint,
    version: skuWorkClaimState.version || 0
  });
}

function formatSkuWorkClaimFailureMessage({ response = null, data = {}, fallback = "ล็อกงานไม่สำเร็จ" } = {}) {
  const code = data?.code || "";
  if (code === "sku_work_state_store_unavailable") {
    return "ยังล็อกงานไม่ได้ เพราะฐานข้อมูลสถานะงานยังไม่พร้อมหรืออ่านไม่ได้";
  }
  if (code === "sku_work_state_store_forbidden") {
    return "ยังล็อกงานไม่ได้ เพราะสิทธิ์อ่าน/เขียนสถานะงานไม่ครบ";
  }
  return getApiErrorMessage(response, data, fallback);
}

function renderSkuWorkClaimCard(message = "") {
  if (!els.skuWorkClaimCard) return;
  if (!selectedCatalogSku?.sku) {
    els.skuWorkClaimCard.hidden = true;
    els.skuWorkClaimCard.innerHTML = "";
    renderCreateDiagnosticsPanel(message);
    return;
  }
  const state = skuWorkClaimState || {};
  const label = state.locked_by_label || "ทีมอื่น";
  const view = state.status === "claimed_by_me"
    ? { className: "claim-state-ready", title: "ล็อกงานนี้ไว้ให้คุณแล้ว", description: "พร้อมทำต่อได้ โดยไม่ชนกับคนอื่น" }
    : skuWorkClaimState.status === "claimed_by_other"
      ? { className: "claim-state-blocked", title: `งานนี้มีคนทำอยู่: ${label}`, description: message || "รอให้คนนั้นปล่อยงาน หรือให้เวลาล็อกหมดอายุก่อน" }
      : state.status === "checking"
        ? { className: "claim-state-loading", title: "กำลังตรวจว่างานนี้ว่างไหม", description: message || "ระบบกำลังดูว่าสามารถล็อกงานนี้ให้คุณได้หรือไม่" }
        : state.status === "claim_failed"
          ? { className: "claim-state-blocked", title: "ตรวจสถานะงานไม่สำเร็จ", description: message || state.message || "ยังล็อกงานนี้ไม่ได้ กรุณาลองใหม่หรือตรวจสิทธิ์ผู้ใช้งาน" }
          : { className: "claim-state-warning", title: "งานนี้ยังไม่ได้ล็อก", description: message || "แอปจะล็อกงานนี้ให้ก่อนเริ่มสร้างภาพหลัก" };
  els.skuWorkClaimCard.hidden = false;
  els.skuWorkClaimCard.className = `sku-work-claim-card ${view.className}`;
  els.skuWorkClaimCard.innerHTML = `
    <div class="sku-work-claim-heading">
      <strong>${escapeHtml(view.title)}</strong>
      <span>${state.status === "claimed_by_me" ? "ล็อกแล้ว" : `v${escapeHtml(String(state.version || 0))}`}</span>
    </div>
    <p>${escapeHtml(view.description)}</p>
    ${state.expires_at ? `<small>ปล่อยงานอัตโนมัติ ${escapeHtml(formatJobTime(state.expires_at))}</small>` : ""}
  `;
  renderCreateDiagnosticsPanel(message);
}

function getSkuWorkClaimReadiness() {
  if (!selectedCatalogSku?.sku) return { disabled: false };
  if (skuWorkClaimState.status === "claimed_by_me") return { disabled: false };
  if (skuWorkClaimState.status === "claimed_by_other") {
    return {
      disabled: true,
      tone: "blocked",
      reason: `งานนี้มี ${skuWorkClaimState.locked_by_label || "ทีมอื่น"} ทำอยู่ จึงยังสร้างภาพซ้ำไม่ได้`
    };
  }
  if (skuWorkClaimState.status === "checking") {
    return { disabled: true, tone: "loading", reason: "กำลังตรวจว่างานนี้ล็อกให้คุณได้ไหม" };
  }
  if (skuWorkClaimState.status === "claim_failed") {
    const referenceReady = hasStagedCatalogReferences() || canAutoUseCatalogReferencesForHero() || hasManualProductReferenceUpload();
    return {
      disabled: true,
      tone: "blocked",
      reason: referenceReady
        ? "รูปพร้อมแล้ว แต่ยังล็อกงานนี้ไม่ได้"
        : "ยังล็อกงานนี้ไม่ได้ กรุณาลองใหม่หรือตรวจสิทธิ์ผู้ใช้งาน"
    };
  }
  return { disabled: true, tone: "loading", reason: "กำลังล็อกงานนี้ก่อนสร้างภาพหลัก" };
}

async function loadSkuWorkClaimStatus({ silent = false } = {}) {
  if (!selectedCatalogSku?.sku) return null;
  const requestedSku = selectedCatalogSku.sku;
  const requestId = ++skuWorkClaimRequestSeq;
  if (!silent) {
    skuWorkClaimState = normalizeSkuWorkClaimState({ ...skuWorkClaimState, status: "checking" });
    renderSkuWorkClaimCard("กำลังตรวจว่างานนี้ล็อกให้คุณได้หรือไม่");
    updateActionAvailability();
  }
  try {
    const response = await authFetch(`/api/sku-work/${encodeURIComponent(requestedSku)}`);
    const data = await readJsonResponse(response, "ตรวจสถานะงานไม่สำเร็จ");
    if (requestId !== skuWorkClaimRequestSeq || selectedCatalogSku?.sku !== requestedSku) return null;
    if (!response.ok || data.ok === false) {
      setSkuWorkClaimFailed({
        message: formatSkuWorkClaimFailureMessage({ response, data, fallback: "ตรวจสถานะงานไม่สำเร็จ" }),
        code: data.code || "",
        httpStatus: response.status,
        endpoint: "GET /api/sku-work/:sku"
      });
      renderSkuWorkClaimCard(skuWorkClaimState.message);
      updateActionAvailability();
      return null;
    }
    skuWorkClaimState = normalizeSkuWorkClaimState(data.claim || {});
    renderSkuWorkClaimCard();
    updateActionAvailability();
    return skuWorkClaimState;
  } catch (error) {
    if (requestId !== skuWorkClaimRequestSeq) return null;
    setSkuWorkClaimFailed({
      message: getSafeAuthErrorMessage(error) || "ตรวจสถานะงานไม่สำเร็จ",
      endpoint: "GET /api/sku-work/:sku"
    });
    renderSkuWorkClaimCard(skuWorkClaimState.message);
    updateActionAvailability();
    return null;
  }
}

async function claimSelectedSkuWork() {
  if (!selectedCatalogSku?.sku) return null;
  const requestedSku = selectedCatalogSku.sku;
  skuWorkClaimState = normalizeSkuWorkClaimState({ ...skuWorkClaimState, status: "checking" });
  renderSkuWorkClaimCard("กำลังล็อกงานนี้ให้คุณก่อนเริ่มงาน");
  updateActionAvailability();
  try {
    const currentClaim = await loadSkuWorkClaimStatus({ silent: true });
    if (!currentClaim || selectedCatalogSku?.sku !== requestedSku) return null;
    if (skuWorkClaimState.status === "claimed_by_other") {
      renderSkuWorkClaimCard();
      startSkuWorkClaimPolling();
      return skuWorkClaimState;
    }
    const response = await authFetch(`/api/sku-work/${encodeURIComponent(requestedSku)}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submittedVersion: skuWorkClaimState.version || 0 })
    });
    const data = await readJsonResponse(response, "ล็อกงานไม่สำเร็จ");
    if (selectedCatalogSku?.sku !== requestedSku) return null;
    if (!response.ok || data.ok === false) {
      if (data.code === "sku_work_claim_conflict") {
        skuWorkClaimState = normalizeSkuWorkClaimState(data.conflict || data.claim || { status: "claimed_by_other" });
        skuWorkClaimState.status = "claimed_by_other";
      } else {
        setSkuWorkClaimFailed({
          message: formatSkuWorkClaimFailureMessage({ response, data, fallback: "ล็อกงานไม่สำเร็จ" }),
          code: data.code || "",
          httpStatus: response.status,
          endpoint: "POST /api/sku-work/:sku/claim"
        });
      }
      renderSkuWorkClaimCard(formatSkuWorkClaimFailureMessage({ response, data, fallback: "ล็อกงานไม่สำเร็จ" }));
      updateActionAvailability();
      startSkuWorkClaimPolling();
      return skuWorkClaimState;
    }
    skuWorkClaimState = normalizeSkuWorkClaimState(data.claim || {});
    renderSkuWorkClaimCard();
    updateActionAvailability();
    startSkuWorkClaimPolling();
    return skuWorkClaimState;
  } catch (error) {
    setSkuWorkClaimFailed({
      message: getSafeAuthErrorMessage(error) || "ล็อกงานไม่สำเร็จ",
      endpoint: "POST /api/sku-work/:sku/claim"
    });
    renderSkuWorkClaimCard(skuWorkClaimState.message);
    updateActionAvailability();
    return null;
  }
}

async function releaseSelectedSkuWork() {
  if (!selectedCatalogSku?.sku || skuWorkClaimState.status !== "claimed_by_me") return;
  const releasingSku = selectedCatalogSku.sku;
  try {
    await authFetch(`/api/sku-work/${encodeURIComponent(releasingSku)}/release`, { method: "POST" });
  } catch (error) {
    logAction("sku-claim", "release skipped", { reason: getSafeAuthErrorMessage(error) });
  }
}

function startSkuWorkClaimPolling() {
  stopSkuWorkClaimPolling();
  skuWorkClaimPollTimer = window.setInterval(() => {
    if (selectedCatalogSku?.sku) loadSkuWorkClaimStatus({ silent: true });
  }, skuWorkClaimPollMs);
}

function stopSkuWorkClaimPolling() {
  if (!skuWorkClaimPollTimer) return;
  window.clearInterval(skuWorkClaimPollTimer);
  skuWorkClaimPollTimer = null;
}

function updateCatalogDrivenFieldHierarchy() {
  const catalogDrivenSelected = Boolean(selectedCatalogSku?.sku);
  const wasCatalogDriven = els.form?.dataset.catalogDrivenSelected === "true";
  if (els.form) {
    els.form.classList.toggle("catalog-driven-selected", catalogDrivenSelected);
    els.form.dataset.catalogDrivenSelected = String(catalogDrivenSelected);
  }
  [els.productSku, els.imageReference].forEach((field) => {
    if (!field) return;
    field.readOnly = catalogDrivenSelected;
    field.setAttribute("aria-readonly", String(catalogDrivenSelected));
  });
  [
    els.brandProfile,
    els.category,
    els.productSubtype,
    els.imageType,
    els.modelProfile,
    els.shotType,
    els.imageSize,
    els.quality
  ].forEach((field) => {
    if (!field) return;
    field.classList.toggle("catalog-derived-field", catalogDrivenSelected);
  });
  const secondarySections = [
    document.getElementById("productDirectionSection"),
    document.getElementById("jobNotesSection")
  ].filter(Boolean);
  if (catalogDrivenSelected && !wasCatalogDriven) {
    secondarySections.forEach((section) => {
      section.open = false;
    });
  } else if (!catalogDrivenSelected) {
    secondarySections.forEach((section) => {
      section.open = true;
    });
  }
  if (els.fallbackReferenceSection && catalogDrivenSelected && !hasManualProductReferenceUpload()) {
    const needsFallback = getReferenceReadinessViewModel().state === "manual_fallback_needed";
    els.fallbackReferenceSection.open = needsFallback;
  }
  const referenceInputSection = document.getElementById("referenceInputSection");
  if (referenceInputSection) {
    const needsFallback = !catalogDrivenSelected || getReferenceReadinessViewModel().state === "manual_fallback_needed";
    if (!wasCatalogDriven || !catalogDrivenSelected || needsFallback) {
      referenceInputSection.open = needsFallback;
    }
  }
}

function renderCatalogReferencePanel(message = "") {
  if (!els.catalogReferencePanel || !els.catalogReferenceCards || !els.catalogReferenceStatus) return;
  renderSelectedProductSummary();
  renderReferenceReadinessCard(message);
  updateCatalogDrivenFieldHierarchy();
  const hasSku = Boolean(selectedCatalogSku?.sku);
  els.catalogReferencePanel.hidden = !hasSku;
  if (!hasSku) {
    els.catalogReferenceCards.innerHTML = "";
    els.catalogReferenceStatus.textContent = message || "เลือกสินค้าเพื่อโหลดรูปอ้างอิง";
    if (els.useCatalogReferencesButton) els.useCatalogReferencesButton.disabled = true;
    updateActionAvailability();
    return;
  }

  const stageable = selectedCatalogReferences.filter((reference) => reference.stage_available && reference.reference_key);
  const stagedCount = stagedCatalogReferenceKeys.length;
  const sourceFields = selectedCatalogSku.reference_source_fields || {};
  const resolutionSummary = selectedCatalogSku.resolution_summary || {};
  const driveUrl = getCatalogDriveUrl();
  const sourceTextParts = [
    driveUrl ? "มีโฟลเดอร์ใน Google Drive" : "",
    sourceFields.source_row ? `แถวข้อมูล ${escapeHtml(sourceFields.source_row)}` : "",
    resolutionSummary.google_drive_checked ? `ตรวจแล้ว: ${Number(resolutionSummary.file_count || 0)} ไฟล์ / ${Number(resolutionSummary.image_file_count || 0)} รูป` : ""
  ].filter(Boolean).join(" · ");
  els.catalogReferenceStatus.textContent = message || [
    catalogReferenceLoading ? "กำลังโหลดรูปจาก Google Drive..." : "",
    `รูปที่ใช้สร้างภาพหลักได้ ${stageable.length} รูป`,
    stagedCount ? `เตรียมไว้แล้ว ${stagedCount} รูป` : "",
    sourceTextParts
  ].filter(Boolean).join(" · ");
  if (els.useCatalogReferencesButton) {
    els.useCatalogReferencesButton.disabled = catalogReferenceLoading || !stageable.length;
    els.useCatalogReferencesButton.textContent = stagedCount ? "ใช้รูปชุดนี้แล้ว" : "ใช้รูปชุดนี้สร้างภาพหลัก";
  }

  if (!selectedCatalogReferences.length) {
    els.catalogReferenceCards.innerHTML = catalogReferenceLoading
      ? `<div class="catalog-reference-empty">กำลังโหลดรูปจาก Google Drive...</div>`
      : `<div class="catalog-reference-empty">ยังไม่มีรูปอ้างอิงสำหรับสินค้านี้</div>`;
    updateActionAvailability();
    return;
  }
  const sourceHtml = driveUrl
    ? `<div class="catalog-reference-source"><a href="${escapeHtml(driveUrl)}" target="_blank" rel="noopener">เปิดโฟลเดอร์ใน Google Drive</a></div>`
    : "";

  els.catalogReferenceCards.innerHTML = selectedCatalogReferences.map((reference) => {
    const isStaged = stagedCatalogReferenceKeys.includes(reference.reference_key);
    const warnings = (reference.warnings || []).map((item) => item.message_th || item.code).filter(Boolean);
    const blockers = (reference.blockers || []).map((item) => item.message_th || item.code).filter(Boolean);
    const blockerDetail = reference.blocker_message || reference.blocker_code || "";
    return `
      <article class="catalog-reference-card ${isStaged ? "is-staged" : ""}" role="listitem">
        <div class="catalog-reference-preview">
          ${reference.preview_url ? `<img src="${escapeHtml(reference.preview_url)}" alt="${escapeHtml(reference.label_th || "รูปอ้างอิง")}" loading="lazy" />` : `<span>ไม่มีภาพตัวอย่าง</span>`}
        </div>
        <div class="catalog-reference-meta">
          <strong>${escapeHtml(reference.label_th || "รูปอ้างอิง")}</strong>
          <span>${reference.stage_available ? "ใช้สร้างภาพหลักได้" : "ต้องใช้รูปอื่นแทน"} · ${escapeHtml(reference.source || "-")}</span>
          ${isStaged ? `<small class="success-text">เตรียมไว้แล้ว</small>` : ""}
          ${warnings.length ? `<small>${escapeHtml(warnings.slice(0, 1).join(" · "))}</small>` : ""}
          ${blockers.length || blockerDetail ? `<small class="danger-text">${escapeHtml([blockerDetail, ...blockers].filter(Boolean).slice(0, 2).join(" · "))}</small>` : ""}
        </div>
      </article>
    `;
  }).join("") + sourceHtml;
  updateActionAvailability();
}

async function loadCatalogReferencesForSelectedSku() {
  if (!selectedCatalogSku?.sku) {
    selectedCatalogReferences = [];
    stagedCatalogReferenceKeys = [];
    renderCatalogReferencePanel();
    renderSelectedProductSummary();
    renderReferenceReadinessCard();
    updateCatalogDrivenFieldHierarchy();
    return;
  }
  catalogReferenceLoading = true;
  const requestedSku = selectedCatalogSku.sku;
  selectedCatalogReferences = [];
  stagedCatalogReferenceKeys = [];
  let finalMessage = "";
  renderCatalogReferencePanel();
  renderSkuPickerStatus();
  renderSelectedProductSummary();
  renderReferenceReadinessCard();
  updateActionAvailability();
  try {
    const listResponse = await authFetch(`/api/catalog/sku/${encodeURIComponent(requestedSku)}/references`);
    const listData = await readJsonResponse(listResponse, "โหลดรูปอ้างอิงของสินค้านี้ไม่สำเร็จ");
    if (!listResponse.ok || listData.ok === false) throw new Error(listData.error || "โหลดรูปอ้างอิงของสินค้านี้ไม่สำเร็จ");
    if (selectedCatalogSku?.sku !== requestedSku) return;
    selectedCatalogReferences = listData.references || [];
    selectedCatalogSku = {
      ...selectedCatalogSku,
      reference_readiness: listData.reference_readiness || selectedCatalogSku.reference_readiness,
      reference_source_fields: listData.reference_source_fields || selectedCatalogSku.reference_source_fields || {},
      resolution_summary: listData.resolution_summary || selectedCatalogSku.resolution_summary || {}
    };
    if (selectedCatalogSku.reference_source_fields.resolved_reference_drive_id) {
      selectedCatalogSku.reference_drive_id = selectedCatalogSku.reference_source_fields.resolved_reference_drive_id;
      selectedCatalogSku.reference_url = selectedCatalogSku.reference_source_fields.resolved_reference_url || selectedCatalogSku.reference_url;
      if (els.imageReference) els.imageReference.value = selectedCatalogSku.reference_url;
    }
    finalMessage = selectedCatalogReferences.length
      ? "พบรูปจาก Drive แล้ว กำลังเตรียมให้พร้อมสร้างภาพหลัก..."
      : "";
    renderSkuPickerStatus();
    renderCatalogReferencePanel(finalMessage);
    renderSelectedProductSummary();
    renderReferenceReadinessCard(finalMessage);
    updateCatalogDrivenFieldHierarchy();
    updateActionAvailability();

    const stageResponse = await authFetch(`/api/catalog/sku/${encodeURIComponent(requestedSku)}/references/stage`, {
      method: "POST"
    });
    const data = await readJsonResponse(stageResponse, "เตรียมรูปอ้างอิงไม่สำเร็จ");
    if (!stageResponse.ok || data.ok === false) throw new Error(data.error || "เตรียมรูปอ้างอิงไม่สำเร็จ");
    if (selectedCatalogSku?.sku !== requestedSku) return;
    selectedCatalogReferences = data.references || [];
    selectedCatalogSku = {
      ...selectedCatalogSku,
      reference_readiness: data.reference_readiness || selectedCatalogSku.reference_readiness,
      reference_source_fields: data.reference_source_fields || selectedCatalogSku.reference_source_fields || {},
      resolution_summary: data.resolution_summary || selectedCatalogSku.resolution_summary || {}
    };
    if (selectedCatalogSku.reference_source_fields.resolved_reference_drive_id) {
      selectedCatalogSku.reference_drive_id = selectedCatalogSku.reference_source_fields.resolved_reference_drive_id;
      selectedCatalogSku.reference_url = selectedCatalogSku.reference_source_fields.resolved_reference_url || selectedCatalogSku.reference_url;
      if (els.imageReference) els.imageReference.value = selectedCatalogSku.reference_url;
    }
    autoStageCatalogReferencesForHero();
    if (hasSelectedCatalogStageableReferences()) {
      finalMessage = `เตรียมรูปสำเร็จ ${selectedCatalogReferences.filter((reference) => reference.stage_available && (reference.generation_url || reference.staged_url)).length} รูป พร้อมสร้างภาพหลัก`;
    }
  } catch (error) {
    if (!selectedCatalogReferences.length) {
      selectedCatalogReferences = [];
      stagedCatalogReferenceKeys = [];
    }
    finalMessage = selectedCatalogReferences.length
      ? (getSafeAuthErrorMessage(error) || "เตรียมรูปอ้างอิงไม่สำเร็จ แต่ยังเปิดดูไฟล์จาก Drive ได้ ถ้าต้องรีบงานนี้ให้อัปโหลดรูปเอง")
      : (getSafeAuthErrorMessage(error) || "โหลดรูปอ้างอิงไม่สำเร็จ กรุณาอัปโหลดรูปสินค้าเอง");
  } finally {
    if (selectedCatalogSku?.sku !== requestedSku) return;
    catalogReferenceLoading = false;
    renderSkuPickerStatus();
    renderCatalogReferencePanel(finalMessage);
    renderSelectedProductSummary();
    renderReferenceReadinessCard(finalMessage);
    updateCatalogDrivenFieldHierarchy();
    updateActionAvailability();
  }
}

function useCatalogReferencesForHero() {
  const stageable = selectedCatalogReferences
    .filter((reference) => reference.stage_available && (reference.generation_url || reference.staged_url) && reference.reference_key)
    .map((reference) => reference.reference_key);
  stagedCatalogReferenceKeys = [...new Set(stageable)].slice(0, 6);
  renderCatalogReferencePanel(stagedCatalogReferenceKeys.length
    ? `แนบรูปอ้างอิงจากแคตตาล็อก/Drive แล้ว ${stagedCatalogReferenceKeys.length} รูป`
    : "ยังไม่มีรูปอ้างอิงที่ใช้สร้างภาพหลักได้ กรุณาอัปโหลดรูปสินค้าเอง");
  renderReferenceReadinessCard();
  updateActionAvailability();
}

function autoStageCatalogReferencesForHero() {
  if (hasManualProductReferenceUpload() || hasStagedCatalogReferences()) return;
  const stageable = selectedCatalogReferences
    .filter((reference) => reference.stage_available && (reference.generation_url || reference.staged_url) && reference.reference_key)
    .map((reference) => reference.reference_key);
  stagedCatalogReferenceKeys = [...new Set(stageable)].slice(0, 6);
}

function getSupportGenerationImageUrls() {
  return getOrderedSupportGenerationImageUrls("");
}

function getStudioMasterGenerationImageUrls() {
  const urls = [];
  const addUrl = (url) => {
    const normalized = String(url || "").trim();
    if (normalized && !urls.includes(normalized)) urls.push(normalized);
  };

  addUrl(approvedHeroImageUrl);
  selectedCatalogReferences
    .filter((reference) => reference.stage_available && (reference.generation_url || reference.staged_url))
    .forEach((reference) => addUrl(reference.generation_url || reference.staged_url));

  return urls.slice(0, 7);
}

function getOrderedSupportGenerationImageUrls(shot = "") {
  const urls = [];
  const addUrl = (url) => {
    const normalized = String(url || "").trim();
    if (normalized && !urls.includes(normalized)) urls.push(normalized);
  };
  const addProductReferences = () => {
    selectedCatalogReferences
      .filter((reference) => reference.stage_available && (reference.generation_url || reference.staged_url))
      .forEach((reference) => addUrl(reference.generation_url || reference.staged_url));
  };

  if (isManualDetailSupportShot(shot)) {
    addUrl(approvedStudioMasterImageUrl);
    addUrl(approvedHeroImageUrl);
  } else {
    addUrl(approvedHeroImageUrl);
    addUrl(approvedStudioMasterImageUrl);
  }
  addProductReferences();

  return urls.slice(0, 8);
}

function renderSkuPickerResults(items = []) {
  if (!els.skuPickerResults) return;
  latestSkuPickerResults = items;
  els.skuPickerResults.hidden = !items.length;
  els.skuPickerResults.setAttribute("aria-hidden", String(!items.length));
  if (!items.length) {
    els.skuPickerResults.innerHTML = "";
    return;
  }
  els.skuPickerResults.innerHTML = items.map((item, index) => `
    <button class="sku-picker-option" type="button" data-sku-picker-index="${index}" role="option">
      <strong>${escapeHtml(item.sku)} · ${escapeHtml(item.product_name || "-")}</strong>
      <span>${escapeHtml(item.branch || "unknown")} · ${escapeHtml(item.category || "-")} / ${escapeHtml(item.subcategory || "-")} · ${escapeHtml(item.reference_readiness?.label_th || item.reference_readiness?.status || "unknown")}</span>
    </button>
  `).join("");
}

function isExactSkuWarmTimeout(error) {
  const message = getSafeAuthErrorMessage(error);
  return /กำลังเตรียมข้อมูล catalog ครั้งแรก|รอบแรกอาจใช้เวลานาน/i.test(message);
}

async function lookupExactCatalogSku(query, requestId, { retryAfterMs = 0, attempt = 0 } = {}) {
  const sku = normalizeCatalogSkuLookup(query);
  if (
    requestId !== skuPickerSearchRequestSeq ||
    normalizeCatalogSkuLookup(query) !== normalizeCatalogSkuLookup(els.skuPickerSearch?.value?.trim() || "")
  ) return;
  renderSkuPickerResults([]);
  renderSkuPickerStatus("กำลังเตรียมข้อมูล catalog ครั้งแรก...");
  if (retryAfterMs > 0) {
    await delay(retryAfterMs);
    if (
      requestId !== skuPickerSearchRequestSeq ||
      normalizeCatalogSkuLookup(query) !== normalizeCatalogSkuLookup(els.skuPickerSearch?.value?.trim() || "")
    ) return;
  }
  try {
    const response = await authFetchWithTimeout(
      `/api/catalog/sku/${encodeURIComponent(sku)}`,
      {},
      skuPickerSearchTimeoutMs,
      "กำลังเตรียมข้อมูล catalog ครั้งแรก หากเป็นรอบแรกอาจใช้เวลานานกว่าปกติ"
    );
    const data = await readJsonResponse(response, "โหลดข้อมูล SKU ไม่สำเร็จ");
    if (
      requestId !== skuPickerSearchRequestSeq ||
      normalizeCatalogSkuLookup(query) !== normalizeCatalogSkuLookup(els.skuPickerSearch?.value?.trim() || "")
    ) return;
    if (data.code === "catalog_warming") {
      const nextRetryAfterMs = Math.max(300, Math.min(2500, Number(data.retry_after_ms || 1000) || 1000));
      renderSkuPickerStatus(data.error || "กำลังเตรียมข้อมูล catalog ครั้งแรก...");
      window.setTimeout(() => lookupExactCatalogSku(sku, requestId, { retryAfterMs: nextRetryAfterMs, attempt: attempt + 1 }), 0);
      return;
    }
    if (!response.ok || data.ok === false) throw new Error(data.error || "โหลดข้อมูล SKU ไม่สำเร็จ");
    selectCatalogSku(data.item);
  } catch (error) {
    if (requestId !== skuPickerSearchRequestSeq) return;
    if (isExactSkuWarmTimeout(error) && attempt < exactSkuLookupMaxWarmRetries) {
      const nextRetryAfterMs = Math.max(700, retryAfterMs || 1200);
      renderSkuPickerStatus("กำลังเตรียมข้อมูล catalog ครั้งแรก หากเป็นรอบแรกอาจใช้เวลานานกว่าปกติ");
      window.setTimeout(() => lookupExactCatalogSku(sku, requestId, { retryAfterMs: nextRetryAfterMs, attempt: attempt + 1 }), 0);
      return;
    }
    renderSkuPickerResults([]);
    renderSkuPickerStatus(getSafeAuthErrorMessage(error) || "ไม่พบรหัสสินค้านี้ในแคตตาล็อก");
  }
}

async function searchCatalogSkus() {
  const query = els.skuPickerSearch?.value?.trim() || "";
  const requestId = ++skuPickerSearchRequestSeq;
  if (!query) {
    renderSkuPickerResults([]);
    if (!selectedCatalogSku) renderSkuPickerStatus();
    return;
  }
  if (query.length < skuPickerMinQueryLength) {
    renderSkuPickerResults([]);
    renderSkuPickerStatus(`พิมพ์รหัสสินค้าหรือชื่อสินค้าอย่างน้อย ${skuPickerMinQueryLength} ตัวอักษร`);
    return;
  }
  if (!isAppReady()) {
    renderSkuPickerStatus("กรุณาเข้าสู่ระบบก่อนค้นหาสินค้าจากแคตตาล็อก");
    return;
  }
  if (looksLikeExactCatalogSku(query)) {
    await lookupExactCatalogSku(query, requestId);
    return;
  }
  try {
    renderSkuPickerStatus("กำลังค้นหาสินค้าในแคตตาล็อก...");
    const params = new URLSearchParams({ q: query, limit: "20" });
    const response = await authFetchWithTimeout(
      `/api/catalog/sku-search?${params.toString()}`,
      {},
      skuPickerSearchTimeoutMs,
      "ค้นหาสินค้าใช้เวลานานผิดปกติ กรุณาลองค้นหาอีกครั้ง"
    );
    const data = await readJsonResponse(response, "ค้นหาสินค้าไม่สำเร็จ");
    if (requestId !== skuPickerSearchRequestSeq || query !== (els.skuPickerSearch?.value?.trim() || "")) return;
    if (!response.ok || data.ok === false) throw new Error(data.error || "ค้นหาสินค้าไม่สำเร็จ");
    renderSkuPickerResults(data.items || []);
    if (!selectedCatalogSku) {
      renderSkuPickerStatus((data.items || []).length ? "เลือกสินค้าจากผลค้นหา 1 รายการ" : "ไม่พบสินค้าในแคตตาล็อก");
    }
  } catch (error) {
    if (requestId !== skuPickerSearchRequestSeq) return;
    renderSkuPickerResults([]);
    renderSkuPickerStatus(getSafeAuthErrorMessage(error) || "ค้นหาสินค้าไม่สำเร็จ");
  }
}

function selectCatalogSku(item) {
  if (!item?.sku) return;
  selectedCatalogSku = item;
  selectedCatalogReferences = [];
  stagedCatalogReferenceKeys = [];
  applyCatalogSkuToForm(item);
  renderSkuPickerResults([]);
  if (els.skuPickerSearch) els.skuPickerSearch.value = `${item.sku} · ${item.product_name || ""}`.trim();
  renderSkuPickerStatus();
  renderSelectedProductSummary();
  renderSkuWorkClaimCard();
  renderReferenceReadinessCard();
  updateCatalogDrivenFieldHierarchy();
  claimSelectedSkuWork();
  loadCatalogReferencesForSelectedSku();
  if (currentPrompt) buildPrompt();
}

function clearCatalogSkuSelection() {
  releaseSelectedSkuWork();
  selectedCatalogSku = null;
  selectedCatalogReferences = [];
  stagedCatalogReferenceKeys = [];
  latestSkuPickerResults = [];
  resetSkuWorkClaimState();
  if (els.skuPickerSearch) els.skuPickerSearch.value = "";
  renderSkuPickerResults([]);
  renderSkuPickerStatus();
  renderCatalogReferencePanel();
  renderSelectedProductSummary();
  renderReferenceReadinessCard();
  updateCatalogDrivenFieldHierarchy();
  updateActionAvailability();
}

function applyCatalogSkuToForm(item) {
  els.productSku.value = item.sku || "";
  const brandProfile = brandProfileFromCatalogBranch(item.branch);
  if (brandProfile && brandProfiles[brandProfile]) {
    els.brandProfile.value = brandProfile;
    applyBrandProfileUiHints();
  }
  const category = categoryFromCatalog(item.category, item.subcategory);
  if (category && categories[category]) {
    els.category.value = category;
    renderProductSubtypeOptions();
    applySubtypeFromCatalog(item.subcategory);
  }
  if (item.reference_url) els.imageReference.value = item.reference_url;
  if (item.feature_notes && !els.keyFeature.value.trim()) els.keyFeature.value = item.feature_notes;
  renderSupportShots();
}

function brandProfileFromCatalogBranch(branch = "") {
  const normalized = String(branch || "").toLowerCase();
  if (normalized.includes("go")) return "go-mall";
  if (normalized.includes("rent")) return "rent-a-coat";
  return "";
}

function categoryFromCatalog(category = "", subcategory = "") {
  const text = `${category} ${subcategory}`.toLowerCase();
  if (text.includes("รองเท้า") || text.includes("boot") || text.includes("shoe")) return "รองเท้า / บูท";
  if (text.includes("กางเกง") || text.includes("pants")) return "กางเกง";
  if (text.includes("ถุงมือ") || text.includes("glove")) return "ถุงมือ";
  if (text.includes("หมวก") || text.includes("hat") || text.includes("beanie")) return "หมวก";
  if (text.includes("ผ้าพันคอ") || text.includes("scarf")) return "ผ้าพันคอ / อุปกรณ์ชิ้นเล็ก";
  if (text.includes("ถุงเท้า") || text.includes("sock")) return "ถุงเท้า";
  if (text.includes("เซ็ต") || text.includes("set")) return "ชุดกันหนาวเป็นเซ็ต";
  if (text.includes("โค้ท") || text.includes("parka") || text.includes("long coat")) return "เสื้อโค้ทยาว / พาร์กา";
  if (text.includes("เสื้อ") || text.includes("แจ็คเก็ต") || text.includes("jacket") || text.includes("outerwear")) return "เสื้อแจ็คเก็ต / เสื้อท่อนบน";
  return "";
}

function applySubtypeFromCatalog(subcategory = "") {
  const normalized = String(subcategory || "").toLowerCase();
  const options = Array.from(els.productSubtype.options || []);
  const match = options.find((option) => normalized && option.textContent.toLowerCase().includes(normalized));
  if (match) els.productSubtype.value = match.value;
}

function applyRoleUi() {
  const settingsLink = els.pageNav.querySelector('[data-page-link="settings"]');
  const monitoringLink = els.pageNav.querySelector('[data-page-link="monitoring"]');
  const costsLink = els.pageNav.querySelector('[data-page-link="costs"]');
  if (settingsLink) settingsLink.hidden = !isAdmin();
  if (monitoringLink) monitoringLink.hidden = !isAdmin();
  if (costsLink) costsLink.hidden = !isAdmin();
  if (els.googleDriveIntegrationSection) els.googleDriveIntegrationSection.hidden = !isAdmin();
  if (els.staffManagementSection) els.staffManagementSection.hidden = !isAdmin();
}

function applyInitialOperatorRoute() {
  if (initialOperatorRouteApplied) return;
  initialOperatorRouteApplied = true;
  const page = getPageFromHash();
  if (page === "batch" || page === "review") return;
  if (!window.location.hash || page === "next") {
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}#next`);
  }
}

function getProfileErrorMessage(error) {
  if (error?.code === "profile_missing") {
    return "บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแลระบบ";
  }
  return getSafeAuthErrorMessage(error);
}

function getSafeAuthErrorMessage(error) {
  const message = error?.message || error || "กรุณาลองใหม่อีกครั้ง";
  return String(message)
    .replace(/(access_token|refresh_token|provider_token|provider_refresh_token)=([^&\s]+)/gi, "$1=[hidden]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[hidden-token]")
    .slice(0, 240);
}

function updateAuthUi(session, message = "") {
  appState.session = session || null;
  appState.profile = currentProfile;
  const isLoggedIn = Boolean(session?.user);
  const canUseApp = isAppReady();
  const email = currentProfile?.email || session?.user?.email || "";
  const roleLabel = currentProfile?.role ? ` · ${currentProfile.role}` : "";
  els.authCard.classList.toggle("is-logged-in", isLoggedIn);
  els.loginForm.hidden = isLoggedIn;
  els.logoutButton.hidden = !isLoggedIn;
  els.generateButton.disabled = !canUseApp;
  els.generateStudioMasterButton.disabled = !canUseApp || !canGenerateStudioMaster();
  els.generateSupportButton.disabled = !canUseApp || !canGenerateSupport();

  els.authState.innerHTML = isLoggedIn
    ? `<strong>${passwordSetupRequired ? "ต้องตั้งรหัสผ่าน" : "เข้าสู่ระบบแล้ว"}</strong><span>${escapeHtml(message || `${email}${roleLabel}`)}</span>`
    : `<strong>ยังไม่ได้เข้าสู่ระบบ</strong><span>${escapeHtml(message || "เข้าสู่ระบบก่อนสร้าง ตรวจ และติดตามงาน")}</span>`;
  updateActionAvailability();
}

async function getAccessToken({ allowPasswordRequired = false } = {}) {
  if (!supabaseClient) throw new Error("Supabase client is not ready.");
  const { data, error } = await promiseWithTimeout(
    supabaseClient.auth.getSession(),
    8000,
    "ตรวจสอบเซสชันไม่สำเร็จ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่"
  );
  if (error) throw error;
  currentSession = data.session || null;
  appState.session = currentSession;
  if (!currentSession?.access_token) {
    updateAuthUi(null, "Session หมดอายุ กรุณา login ใหม่");
    throw new Error("กรุณา login ก่อนใช้งาน");
  }
  if (passwordSetupRequired && !allowPasswordRequired) {
    showAuthGate("password-required");
    throw new Error("กรุณาตั้งรหัสผ่านใหม่ก่อนเริ่มใช้งาน");
  }
  return currentSession.access_token;
}

async function authFetch(url, options = {}) {
  const {
    allowPasswordRequired = false,
    timeoutMs = 45000,
    timeoutMessage = "ระบบใช้เวลานานผิดปกติ กรุณาลองใหม่อีกครั้ง",
    ...fetchOptions
  } = options;

  return fetchWithTimeout(async (signal) => {
    const token = await getAccessToken({ allowPasswordRequired });
    const headers = new Headers(fetchOptions.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...fetchOptions, headers, signal: fetchOptions.signal || signal });
  }, timeoutMs, timeoutMessage);
}

async function fetchWithTimeout(fetcher, timeoutMs, timeoutMessage) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(controller.signal);
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(timeoutMessage || "ระบบใช้เวลานานผิดปกติ กรุณาลองใหม่อีกครั้ง");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function promiseWithTimeout(promise, timeoutMs, timeoutMessage) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

async function authFetchWithTimeout(url, options = {}, timeoutMs = 45000, timeoutMessage = "") {
  return authFetch(url, { ...options, timeoutMs, timeoutMessage });
}

async function readJsonResponse(response, fallbackMessage) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(fallbackMessage);
  }
}

function getApiErrorMessage(response, data, fallback = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง") {
  if (response.status === 401) return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่";
  if (response.status === 403) return "บัญชีนี้ไม่มีสิทธิ์หรือยังไม่ได้เปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ";
  if (response.status === 429) {
    return data?.error || "ระบบเรียกใช้งาน AI หรือ API ถี่เกินไป กรุณารอสักครู่แล้วลองใหม่";
  }
  return data?.error || fallback;
}

async function refreshSystemStatus() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    const pending = data.queue?.pending || 0;
    const active = data.queue?.active || 0;
    const drive = data.google_drive_connected || data.checks?.googleDriveConnected
      ? "Google Drive พร้อม"
      : data.googleDriveApiConfigured || data.google_drive_configured
        ? "Google Drive ต้อง reconnect"
        : data.driveOutputConfigured
          ? "Drive พร้อม"
          : "บันทึกในเครื่อง";
    els.systemStatus.textContent = active || pending ? `คิวงาน ${active}/${pending}` : `พร้อมใช้งาน · ${drive}`;
  } catch {
    els.systemStatus.textContent = "ระบบไม่ตอบสนอง";
  }
}

function getPageFromHash() {
  const page = window.location.hash.replace("#", "").trim().split("?")[0];
  if (page === "batch-review") return "batch";
  return pageMeta[page] ? page : "create";
}

function getHashParams() {
  const hash = window.location.hash.replace(/^#/, "");
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(query);
}

function runPageTransition(updateDom, direction = "forward") {
  const canTransition =
    typeof document.startViewTransition === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!canTransition) {
    updateDom();
    return;
  }

  document.startViewTransition({
    update: updateDom,
    types: [direction]
  });
}

function navigateToPage(page) {
  let targetPage = pageMeta[page] ? page : "create";
  if ((targetPage === "settings" || targetPage === "monitoring" || targetPage === "costs") && !isAdmin()) {
    targetPage = "create";
    if (window.location.hash !== "#create") window.location.hash = "create";
  }
  els.pageViews.forEach((view) => {
    view.classList.toggle("active", view.dataset.page === targetPage);
  });
  els.pageNav.querySelectorAll("[data-page-link]").forEach((link) => {
    link.classList.toggle("active", link.dataset.pageLink === targetPage);
  });
  els.topbarEyebrow.textContent = pageMeta[targetPage].eyebrow;
  els.topbarTitle.textContent = pageMeta[targetPage].title;

  if (targetPage === "next") {
    renderNextActions();
    if (isAppReady()) refreshNextActions();
  }
  if (targetPage === "jobs") {
    renderHistory();
    if (isAppReady()) refreshJobHistory();
  }
  if (targetPage === "assets") {
    renderAssets();
    if (isAppReady()) refreshAssetLibrary();
  }
  if (targetPage === "review" && isAppReady()) loadHeroReviewPage();
  if (targetPage === "batch" && isAppReady()) loadBatchReviewPage();
  if (targetPage === "kpi") refreshMetrics();
  if (targetPage === "costs" && isAdmin()) refreshCosts();
  if (targetPage === "monitoring" && isAdmin()) refreshMonitoring();
  if (targetPage === "settings") {
    renderSettingsPreview();
    refreshGoogleDriveStatus();
    refreshStaffUsers();
  }
}

function installGlobalEventHandlers() {
  if (appActionsBound) return;
  appActionsBound = true;

  document.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;

    const action = actionButton.dataset.action;
    if (action === "generate-hero") {
      event.preventDefault();
      handleGenerateHero();
      return;
    }
    if (action === "approve-save") {
      event.preventDefault();
      handleApproveSave();
      return;
    }
    if (action === "logout") {
      event.preventDefault();
      handleLogout();
      return;
    }
    if (action === "google-drive-connect") {
      event.preventDefault();
      connectGoogleDrive();
    }
  });

  document.addEventListener("submit", (event) => {
    if (event.target === els.gateLoginForm || event.target === els.loginForm) {
      handleLogin(event);
      return;
    }
    if (event.target === els.passwordSetupForm) {
      handlePasswordSetup(event);
    }
  });

  console.info("[actions] global handlers installed");
}

function bindEvents() {
  window.addEventListener("hashchange", () => navigateToPage(getPageFromHash()));
  els.pageNav.addEventListener("click", (event) => {
    const link = event.target.closest("[data-page-link]");
    if (!link) return;
    event.preventDefault();
    const page = link.dataset.pageLink;
    const currentPage = getPageFromHash();
    const navLinks = Array.from(els.pageNav.querySelectorAll("[data-page-link]"));
    const currentIndex = navLinks.findIndex((item) => item.dataset.pageLink === currentPage);
    const nextIndex = navLinks.findIndex((item) => item.dataset.pageLink === page);
    const direction = currentIndex >= 0 && nextIndex >= 0 && nextIndex < currentIndex ? "backward" : "forward";

    runPageTransition(() => {
      window.location.hash = page;
      navigateToPage(page);
    }, direction);
  });

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    buildPrompt();
  });
  if (els.heroReviewApproveButton) els.heroReviewApproveButton.addEventListener("click", approveHeroFromReviewPage);
  if (els.heroReviewRegenerateButton) els.heroReviewRegenerateButton.addEventListener("click", regenerateHeroFromReviewPage);
  if (els.supportReviewSaveButton) els.supportReviewSaveButton.addEventListener("click", saveSupportReviewDecisions);
  if (els.batchReviewPrimaryButton) els.batchReviewPrimaryButton.addEventListener("click", handleBatchPrimaryAction);
  if (els.batchSkuGrid) els.batchSkuGrid.addEventListener("click", handleBatchItemActionClick);
  if (els.refreshNextActionsButton) els.refreshNextActionsButton.addEventListener("click", refreshNextActions);

  els.copyButton.addEventListener("click", async () => {
    if (!currentPrompt) buildPrompt();
    await navigator.clipboard.writeText(currentPrompt);
    els.copyButton.textContent = "คัดลอกแล้ว";
    setTimeout(() => (els.copyButton.textContent = "คัดลอก"), 1200);
  });

  els.refreshMetricsButton.addEventListener("click", refreshMetrics);
  els.kpiRangeControls.addEventListener("click", (event) => {
    const button = event.target.closest("[data-kpi-range]");
    if (!button) return;
    selectedKpiRange = button.dataset.kpiRange || "7d";
    els.kpiRangeControls.querySelectorAll("[data-kpi-range]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    refreshMetrics();
  });
  els.refreshMonitoringButton.addEventListener("click", refreshMonitoring);
  els.monitoringRangeControls.addEventListener("click", (event) => {
    const button = event.target.closest("[data-monitoring-range]");
    if (!button) return;
    selectedMonitoringRange = button.dataset.monitoringRange || "7d";
    selectedMonitoringPage = 1;
    els.monitoringRangeControls.querySelectorAll("[data-monitoring-range]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    refreshMonitoring();
  });
  els.monitoringPageSize.addEventListener("change", () => {
    selectedMonitoringPageSize = normalizeMonitoringPageSize(els.monitoringPageSize.value);
    selectedMonitoringPage = 1;
    refreshMonitoring();
  });
  els.monitoringPrevPage.addEventListener("click", () => {
    selectedMonitoringPage = Math.max(1, selectedMonitoringPage - 1);
    refreshMonitoring();
  });
  els.monitoringNextPage.addEventListener("click", () => {
    const totalPages = latestMonitoringData?.pagination?.totalPages || selectedMonitoringPage + 1;
    selectedMonitoringPage = Math.min(totalPages, selectedMonitoringPage + 1);
    refreshMonitoring();
  });
  els.refreshCostsButton.addEventListener("click", refreshCosts);
  els.costRangeControls.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cost-range]");
    if (!button) return;
    selectedCostRange = button.dataset.costRange || "7d";
    selectedCostPage = 1;
    els.costRangeControls.querySelectorAll("[data-cost-range]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    refreshCosts();
  });
  els.costPageSize.addEventListener("change", () => {
    selectedCostPageSize = normalizeProductionPageSize(els.costPageSize.value);
    selectedCostPage = 1;
    refreshCosts();
  });
  els.costPrevPage.addEventListener("click", () => {
    selectedCostPage = Math.max(1, selectedCostPage - 1);
    refreshCosts();
  });
  els.costNextPage.addEventListener("click", () => {
    const totalPages = latestCostData?.pagination?.totalPages || selectedCostPage + 1;
    selectedCostPage = Math.min(totalPages, selectedCostPage + 1);
    refreshCosts();
  });
  els.refreshStaffButton.addEventListener("click", refreshStaffUsers);
  els.openCreateStaffButton.addEventListener("click", openCreateStaffModal);
  els.closeCreateStaffButton.addEventListener("click", closeCreateStaffModal);
  els.cancelCreateStaffButton.addEventListener("click", closeCreateStaffModal);
  els.createStaffModal.addEventListener("click", (event) => {
    if (event.target === els.createStaffModal) closeCreateStaffModal();
  });
  els.createStaffForm.addEventListener("submit", handleCreateStaffSubmit);
  els.closeResetPasswordButton.addEventListener("click", closeResetPasswordModal);
  els.cancelResetPasswordButton.addEventListener("click", closeResetPasswordModal);
  els.resetPasswordModal.addEventListener("click", (event) => {
    if (event.target === els.resetPasswordModal) closeResetPasswordModal();
  });
  els.resetPasswordForm.addEventListener("submit", handleResetPasswordSubmit);
  [els.staffSearch, els.staffRoleFilter, els.staffStatusFilter, els.staffPasswordFilter].forEach((filter) => {
    filter.addEventListener("input", renderStaffUsers);
    filter.addEventListener("change", renderStaffUsers);
  });
  els.staffAdminList.addEventListener("change", handleStaffFieldChange);
  els.staffAdminList.addEventListener("click", handleStaffListClick);
  els.refreshJobsButton.addEventListener("click", refreshJobHistory);
  els.jobsRangeControls.addEventListener("click", (event) => {
    const button = event.target.closest("[data-jobs-range]");
    if (!button) return;
    selectedJobsRange = button.dataset.jobsRange || "7d";
    selectedJobsPage = 1;
    els.jobsRangeControls.querySelectorAll("[data-jobs-range]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    refreshJobHistory();
  });
  els.historySearch.addEventListener("input", () => {
    window.clearTimeout(jobsSearchTimer);
    jobsSearchTimer = window.setTimeout(() => {
      selectedJobsPage = 1;
      refreshJobHistory();
    }, 250);
  });
  els.historyStatusFilter.addEventListener("change", () => {
    selectedJobsPage = 1;
    refreshJobHistory();
  });
  els.jobsPageSize.addEventListener("change", () => {
    selectedJobsPageSize = normalizeProductionPageSize(els.jobsPageSize.value);
    selectedJobsPage = 1;
    refreshJobHistory();
  });
  els.jobsPrevPage.addEventListener("click", () => {
    selectedJobsPage = Math.max(1, selectedJobsPage - 1);
    refreshJobHistory();
  });
  els.jobsNextPage.addEventListener("click", () => {
    const totalPages = latestJobsData?.pagination?.totalPages || selectedJobsPage + 1;
    selectedJobsPage = Math.min(totalPages, selectedJobsPage + 1);
    refreshJobHistory();
  });
  els.assetsRangeControls.addEventListener("click", (event) => {
    const button = event.target.closest("[data-assets-range]");
    if (!button) return;
    selectedAssetsRange = button.dataset.assetsRange || "7d";
    selectedAssetsPage = 1;
    els.assetsRangeControls.querySelectorAll("[data-assets-range]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    refreshAssetLibrary();
  });
  els.assetTypeTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-asset-type]");
    if (!button) return;
    selectedAssetType = normalizeAssetTypeFilter(button.dataset.assetType);
    selectedAssetsPage = 1;
    els.assetTypeTabs.querySelectorAll("[data-asset-type]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    updateAssetLibraryHelper();
    refreshAssetLibrary();
  });
  els.assetSearch.addEventListener("input", () => {
    window.clearTimeout(assetsSearchTimer);
    assetsSearchTimer = window.setTimeout(() => {
      selectedAssetsPage = 1;
      refreshAssetLibrary();
    }, 250);
  });
  els.assetJobIdFilter.addEventListener("input", () => {
    window.clearTimeout(assetsSearchTimer);
    assetsSearchTimer = window.setTimeout(() => {
      selectedAssetsPage = 1;
      refreshAssetLibrary();
    }, 250);
  });
  els.assetsPageSize.addEventListener("change", () => {
    selectedAssetsPageSize = normalizeProductionPageSize(els.assetsPageSize.value);
    selectedAssetsPage = 1;
    refreshAssetLibrary();
  });
  els.assetsPrevPage.addEventListener("click", () => {
    selectedAssetsPage = Math.max(1, selectedAssetsPage - 1);
    refreshAssetLibrary();
  });
  els.assetsNextPage.addEventListener("click", () => {
    const totalPages = latestAssetsData?.pagination?.totalPages || selectedAssetsPage + 1;
    selectedAssetsPage = Math.min(totalPages, selectedAssetsPage + 1);
    refreshAssetLibrary();
  });
  els.assetGallery.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-copy-value]");
    if (!button) return;
    await navigator.clipboard.writeText(button.dataset.copyValue || "");
    const original = button.textContent;
    button.textContent = "คัดลอกแล้ว";
    window.setTimeout(() => {
      button.textContent = original;
    }, 1200);
  });
  document.addEventListener("click", handleRecoveryActionClick);
  els.operatorName.addEventListener("input", () => {
    localStorage.setItem("winter-image-desk-operator", els.operatorName.value.trim());
  });
  els.brandProfile.addEventListener("change", () => {
    applyBrandProfileUiHints();
    renderSupportShots();
    if (currentPrompt) buildPrompt();
  });
  els.generateSupportButton.addEventListener("click", generateSupportSet);
  els.approveSupportButton.addEventListener("click", approveSupportSet);
  els.generateStudioMasterButton.addEventListener("click", () => generateStudioMaster({ rerun: false }));
  els.rerunStudioMasterButton.addEventListener("click", () => generateStudioMaster({ rerun: true }));
  els.approveStudioMasterButton.addEventListener("click", approveStudioMaster);
  els.supportGallery.addEventListener("click", (event) => {
    const rerunButton = event.target.closest("[data-rerun-support]");
    if (!rerunButton) return;
    rerunSupportImage(Number(rerunButton.dataset.rerunSupport));
  });
  els.productImages.addEventListener("change", () => {
    renderFilePreview(els.productImages, els.productPreview, 10);
    renderSkuPickerStatus();
    renderCatalogReferencePanel();
    renderReferenceReadinessCard();
    updateCatalogDrivenFieldHierarchy();
    updateActionAvailability();
  });
  els.modelImages.addEventListener("change", () => renderFilePreview(els.modelImages, els.modelPreview, 5));
  els.skuPickerSearch.addEventListener("input", () => {
    window.clearTimeout(skuPickerSearchTimer);
    skuPickerSearchTimer = window.setTimeout(searchCatalogSkus, 250);
  });
  els.skuPickerClearButton.addEventListener("click", clearCatalogSkuSelection);
  els.useCatalogReferencesButton.addEventListener("click", useCatalogReferencesForHero);
  els.skuPickerResults.addEventListener("click", (event) => {
    const option = event.target.closest("[data-sku-picker-index]");
    if (!option) return;
    selectCatalogSku(latestSkuPickerResults[Number(option.dataset.skuPickerIndex)]);
  });
  els.productSku.addEventListener("input", () => {
    if (selectedCatalogSku && els.productSku.value.trim().toUpperCase() !== selectedCatalogSku.sku) {
      selectedCatalogSku = null;
      selectedCatalogReferences = [];
      stagedCatalogReferenceKeys = [];
      renderSkuPickerStatus("SKU ถูกแก้เองแล้ว ข้อมูล catalog ถูกปลดล็อกเป็น manual mode");
      renderCatalogReferencePanel();
      renderSelectedProductSummary();
      renderReferenceReadinessCard();
      updateCatalogDrivenFieldHierarchy();
      updateActionAvailability();
    }
  });
  els.keyFeature.addEventListener("input", () => renderSupportShots());
  els.notes.addEventListener("input", () => renderSupportShots());
  els.addCustomShotButton.addEventListener("click", addCustomSupportShot);
  els.customSupportShot.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addCustomSupportShot();
    }
  });
  els.resetSupportButton.addEventListener("click", () => {
    customSupportShots = [];
    renderSupportShots();
    supportResults = [];
    renderSupportGallery();
  });
  els.category.addEventListener("change", () => {
    renderProductSubtypeOptions();
    renderSupportShots();
    if (currentPrompt) buildPrompt();
  });
  els.productSubtype.addEventListener("change", () => {
    renderSupportShots();
    if (currentPrompt) buildPrompt();
  });
  els.imageType.addEventListener("change", () => {
    if (currentPrompt) buildPrompt();
  });
  els.shotType.addEventListener("change", () => {
    renderSupportShots();
    if (currentPrompt) buildPrompt();
  });

  els.addQueueButton.addEventListener("click", () => {
    if (!currentPrompt) buildPrompt();
    const name = getJobBaseName("Untitled product");
    addHistoryItem({
      name,
      type: els.imageType.value,
      category: els.category.value,
      status: "รอตรวจ"
    });
  });

  els.resetButton.addEventListener("click", () => {
    const operatorName = els.operatorName.value;
    els.form.reset();
    els.operatorName.value = operatorName;
    els.brandProfile.selectedIndex = 0;
    els.category.selectedIndex = 0;
    renderProductSubtypeOptions();
    els.imageType.selectedIndex = 0;
    els.modelProfile.selectedIndex = 0;
    els.shotType.selectedIndex = 0;
    els.imageSize.selectedIndex = 0;
    els.quality.selectedIndex = 0;
    currentPrompt = "";
    currentGeneratedImageUrl = "";
    approvedHeroImageUrl = "";
    currentStudioMasterImageUrl = "";
    approvedStudioMasterImageUrl = "";
    currentStudioMasterGenerationId = "";
    currentJobId = "";
    currentHeroGenerationId = "";
    selectedCatalogSku = null;
    selectedCatalogReferences = [];
    stagedCatalogReferenceKeys = [];
    latestSkuPickerResults = [];
    if (els.skuPickerSearch) els.skuPickerSearch.value = "";
    renderSkuPickerResults([]);
    appState.currentJobId = null;
    appState.currentGenerationId = null;
    lastSubmittedQcKey = "";
    lastRecordedApprovalGenerationId = "";
    supportResults = [];
    customSupportShots = [];
    resetQc();
    els.promptOutput.textContent = "กรอกข้อมูลงาน แล้วกดสร้างภาพหลัก คำสั่งจะพร้อมให้ตรวจเอง";
    els.resultCard.hidden = true;
    els.emptyHero.hidden = false;
    setHeroLoading(false);
    els.resultImage.removeAttribute("src");
    els.resultStatus.textContent = "";
    renderStudioMasterPanel();
    renderFilePreview(els.productImages, els.productPreview, 10);
    renderFilePreview(els.modelImages, els.modelPreview, 5);
    updateHeroStatus();
    renderSupportShots();
    renderSupportGallery();
    renderAssets();
    renderSkuPickerStatus();
    renderCatalogReferencePanel();
    updateMeta("-", "-", "waiting");
    applyBrandProfileUiHints();
  });

  if (els.clearHistoryButton) {
    els.clearHistoryButton.addEventListener("click", () => {
      localJobHistory = [];
      jobHistory = mergeJobHistory();
      saveJobHistory();
      renderHistory();
    });
  }
}

async function handleLogin(event) {
  event.preventDefault();
  if (!supabaseClient) {
    els.gateLoginMessage.textContent = "Supabase ยังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบ";
    return;
  }

  const submittedForm = event.target;
  const isGateLogin = submittedForm === els.gateLoginForm;
  const emailInput = isGateLogin ? els.gateLoginEmail : els.loginEmail;
  const passwordInput = isGateLogin ? els.gateLoginPassword : els.loginPassword;
  const button = isGateLogin ? els.gateLoginButton : els.loginButton;
  const defaultButtonText = button.textContent;
  const messageEl = isGateLogin ? els.gateLoginMessage : null;
  if (messageEl) {
    messageEl.textContent = "";
    messageEl.classList.remove("is-success");
  }

  button.disabled = true;
  button.textContent = "Logging in...";

  try {
    authFlowInProgress = true;
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;

    currentSession = data.session || null;
    passwordSetupRequired = false;
    passwordInput.value = "";
    await refreshSessionProfileAndAppState();
  } catch (error) {
    const message = `เข้าสู่ระบบไม่สำเร็จ: ${getSafeAuthErrorMessage(error)}`;
    if (messageEl) {
      messageEl.textContent = message;
    } else {
      updateAuthUi(null, message);
    }
  } finally {
    authFlowInProgress = false;
    button.disabled = false;
    button.textContent = defaultButtonText;
  }
}

async function handleLogout() {
  if (!supabaseClient) return;
  if (appState.actions.logout) return;

  let logoutMessage = "ออกจากระบบแล้ว";
  try {
    authFlowInProgress = true;
    setAppState("logging-out", "logout:start");
    setActionLoading("logout", true);
    const { error } = await promiseWithTimeout(
      supabaseClient.auth.signOut(),
      5000,
      "ออกจากระบบใช้เวลานานผิดปกติ กรุณาลองใหม่อีกครั้ง"
    );
    if (error) throw error;
  } catch (error) {
    logoutMessage = `ออกจากระบบจากเครื่องนี้แล้ว แต่ server ตอบกลับไม่สมบูรณ์: ${getSafeAuthErrorMessage(error)}`;
    console.warn("[logout] signOut failed; clearing local state", { message: getSafeAuthErrorMessage(error) });
  } finally {
    clearFrontendAuthState();
    window.history.replaceState({}, document.title, `${window.location.pathname}#jobs`);
    showAuthGate("logged-out", "logout:finished");
    els.gateLoginMessage.textContent = logoutMessage;
    els.gateLoginMessage.classList.add("is-success");
    authFlowInProgress = false;
  }
}

async function handlePasswordSetup(event) {
  event.preventDefault();
  if (!supabaseClient || !currentSession?.user) {
    setPasswordSetupMessage("Session หมดอายุ กรุณา login ใหม่");
    updateAuthUi(null, "Session หมดอายุ กรุณา login ใหม่");
    return;
  }

  const newPassword = els.passwordSetupNew.value;
  const confirmPassword = els.passwordSetupConfirm.value;
  if (newPassword.length < 8) {
    setPasswordSetupMessage("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
    return;
  }
  if (newPassword !== confirmPassword) {
    setPasswordSetupMessage("รหัสผ่านยืนยันไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง");
    return;
  }

  els.passwordSetupButton.disabled = true;
  els.passwordSetupButton.textContent = "กำลังบันทึก...";

  try {
    passwordChangeInProgress = true;
    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
    if (error) throw error;

    const token = await getLatestAccessToken();
    const response = await fetch("/api/me/password-changed", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    const changedData = await response.json();
    if (!response.ok || !changedData.ok) {
      throw new Error(changedData.error || "บันทึกสถานะการเปลี่ยนรหัสผ่านไม่สำเร็จ");
    }

    els.passwordSetupNew.value = "";
    els.passwordSetupConfirm.value = "";
    setPasswordSetupMessage("ตั้งรหัสผ่านสำเร็จ พร้อมเริ่มใช้งาน", true);
    const profile = await refreshSessionProfileAndAppState();
    if (profile.must_change_password) {
      throw new Error("ระบบยังไม่สามารถปลดสถานะรหัสผ่านชั่วคราวได้ กรุณาลองอีกครั้ง");
    }
  } catch (error) {
    setPasswordSetupMessage(`ตั้งรหัสผ่านไม่สำเร็จ: ${getSafeAuthErrorMessage(error)}`);
  } finally {
    passwordChangeInProgress = false;
    els.passwordSetupButton.disabled = false;
    els.passwordSetupButton.textContent = "บันทึกรหัสผ่าน";
  }
}

async function generateImage() {
  logAction("generate", "clicked");
  logAction("generate", "appState");
  logAction("generate", "session present", { sessionPresent: Boolean(currentSession?.access_token) });
  logAction("generate", "profile present", { profilePresent: profileExists(currentProfile) });

  if (!isAppReady()) {
    logAction("generate", "early exit", { reason: "not app-ready" });
    els.resultCard.hidden = false;
    els.emptyHero.hidden = false;
    els.resultStatus.textContent = "กรุณาเข้าสู่ระบบและตรวจสอบสิทธิ์ให้เรียบร้อยก่อนสร้างภาพ";
    updateAuthUi(currentSession);
    return;
  }

  buildPrompt();

  const claimReadiness = getSkuWorkClaimReadiness();
  if (claimReadiness.disabled) {
    logAction("generate", "early exit", { reason: claimReadiness.reason });
    els.resultCard.hidden = false;
    els.resultStatus.textContent = claimReadiness.reason;
    renderSkuWorkClaimCard(claimReadiness.reason);
    return;
  }

  if (isSelectedSkuReferenceBlockedWithoutFallback()) {
    const message = getSelectedSkuReferenceBlockerMessage();
    logAction("generate", "early exit", { reason: message });
    els.resultCard.hidden = false;
    els.resultStatus.textContent = message;
    renderSkuPickerStatus();
    return;
  }

  const validationMessage = validateInputFiles();
  if (validationMessage) {
    logAction("generate", "early exit", { reason: validationMessage });
    els.resultCard.hidden = false;
    els.resultStatus.textContent = validationMessage;
    return;
  }
  logAction("generate", "validation passed", {
    productFileCount: els.productImages.files?.length || 0,
    modelFileCount: els.modelImages.files?.length || 0,
    stagedCatalogReferenceCount: stagedCatalogReferenceKeys.length
  });

  els.resultCard.hidden = false;
  els.emptyHero.hidden = true;
  els.resultImage.hidden = true;
  els.resultImage.removeAttribute("src");
  setHeroLoading(true, "กำลังสร้างภาพหลัก", "กำลังแนบรูปอ้างอิงและส่งงานให้ AI สร้างภาพ");
  els.resultStatus.textContent = "กำลังเริ่มงานสร้างภาพ...";
  els.generateButton.disabled = true;
  els.approveButton.disabled = true;
  els.generateButton.textContent = "กำลังสร้าง...";

  try {
    const formData = buildGenerateFormData(currentPrompt, [], { jobKind: "hero", shot: "Hero" });
    logAction("generate", "before request", {
      productFileCount: els.productImages.files?.length || 0,
      stagedCatalogReferenceCount: stagedCatalogReferenceKeys.length,
      currentJobId,
      currentGenerationId: currentHeroGenerationId
    });
    const data = await startGenerationJob(formData, (job) => {
      setHeroLoading(true, getJobTitle(job), job.message || "กำลังทำงาน");
      els.resultStatus.textContent = `${getJobTitle(job)} · ${job.message || ""}`;
    });

    currentJobId = data.jobId || currentJobId;
    currentHeroGenerationId = data.generationId || "";
    appState.currentJobId = currentJobId || null;
    appState.currentGenerationId = currentHeroGenerationId || null;
    currentGeneratedImageUrl = data.images[0].url;
    approvedHeroImageUrl = "";
    currentStudioMasterImageUrl = "";
    approvedStudioMasterImageUrl = "";
    currentStudioMasterGenerationId = "";
    lastSubmittedQcKey = "";
    lastRecordedApprovalGenerationId = "";
    supportResults = [];
    resetQc();
    els.emptyHero.hidden = true;
    setHeroLoading(false);
    els.resultImage.hidden = false;
    els.resultImage.src = currentGeneratedImageUrl;
    els.resultStatus.textContent = `สร้างภาพสำเร็จ · Request ID: ${data.requestId || "-"}`;
    updateHeroStatus();
    renderStudioMasterPanel();
    updateWorkflowGate();
    renderSupportGallery();
    renderAssets();
    refreshMetrics();
    refreshJobHistory();
  } catch (error) {
    logAction("generate", "request failed", { reason: getSafeAuthErrorMessage(error) });
    setHeroLoading(false);
    els.emptyHero.hidden = false;
    els.resultStatus.textContent = `สร้างภาพไม่สำเร็จ: ${getSafeAuthErrorMessage(error) || "ส่งงานสร้างภาพไม่สำเร็จ"}`;
  } finally {
    updateActionAvailability();
    els.approveButton.disabled = !currentGeneratedImageUrl;
    els.generateButton.textContent = "สร้างภาพหลัก";
  }
}

function setHeroLoading(isLoading, title = "", hint = "") {
  els.generationState.hidden = !isLoading;
  els.resultCard.classList.toggle("is-generating", isLoading);
  if (title) els.generationTitle.textContent = title;
  if (hint) els.generationHint.textContent = hint;
}

async function approveImage() {
  logAction("approve", "clicked");
  logAction("approve", "appState", { appState: getAppState() });
  logAction("approve", "current jobId", { currentJobId });
  logAction("approve", "current generationId", { currentHeroGenerationId });
  logAction("approve", "before validation");

  if (!isAppReady()) {
    logAction("approve", "early exit", { reason: "not app-ready" });
    els.resultStatus.textContent = "กรุณาเข้าสู่ระบบและตรวจสอบสิทธิ์ให้เรียบร้อยก่อนบันทึก";
    updateAuthUi(currentSession);
    return;
  }

  if (!currentGeneratedImageUrl) {
    logAction("approve", "early exit", { reason: "missing generated image" });
    els.resultStatus.textContent = "ยังไม่มีภาพที่สร้างเสร็จให้อนุมัติ";
    return;
  }
  if (!currentJobId || !currentHeroGenerationId) {
    logAction("approve", "early exit", { reason: "missing job or generation id", currentJobId, currentHeroGenerationId });
    els.resultStatus.textContent = "ยังไม่มีข้อมูลงานสำหรับบันทึก กรุณาสร้างภาพใหม่อีกครั้ง";
    return;
  }

  els.approveButton.disabled = true;
  els.approveButton.textContent = "กำลังบันทึก...";

  try {
    logAction("approve", "before request", { currentJobId, currentHeroGenerationId });
    logAction("approve", "before authFetch", { currentJobId, currentHeroGenerationId });
    const response = await authFetchWithTimeout("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl: currentGeneratedImageUrl,
        jobName: getJobBaseName("approved-product"),
        generationId: currentHeroGenerationId,
        ...getRequestMetadata({ jobKind: "hero", shot: "Hero", jobId: currentJobId })
      })
    }, 90000, "อนุมัติและบันทึกใช้เวลานานผิดปกติ กรุณาลองใหม่อีกครั้ง");
    logAction("approve", "request sent", { httpStatus: response.status });
    const data = await readJsonResponse(response, "อนุมัติและบันทึกไม่สำเร็จ: server ส่งข้อมูลกลับมาไม่ถูกต้อง");
    logAction("approve", "response status/body", {
      httpStatus: response.status,
      ok: data.ok === true,
      code: data.code || "",
      hasGoogleDriveFile: Boolean(data.googleDriveFile),
      hasDrivePath: Boolean(data.drivePath || data.approvedPath)
    });

    if (!response.ok || !data.ok) {
      const message = getApiErrorMessage(response, data, "อนุมัติและบันทึกไม่สำเร็จ");
      if (/google drive|drive|oauth|token|เชื่อมต่อ/i.test(message)) {
        throw new Error("Google Drive ยังไม่ได้เชื่อมต่อ กรุณาให้ Admin เชื่อมต่อก่อน");
      }
      throw new Error(message);
    }

    els.resultStatus.textContent = getApprovalMessage(data);
    await recordApproval(data);
    approvedHeroImageUrl = currentGeneratedImageUrl;
    updateHeroStatus();
    updateWorkflowGate();
    renderAssets();

    addHistoryItem({
      name: getJobBaseName("สินค้าที่อนุมัติแล้ว"),
      type: els.imageType.value,
      category: els.category.value,
      status: "ภาพหลักอนุมัติแล้ว"
    });
    logAction("approve", "success", { currentJobId, currentHeroGenerationId });
    refreshMetrics();
  } catch (error) {
    logAction("approve", "request failed", { reason: getSafeAuthErrorMessage(error) });
    els.resultStatus.textContent = `อนุมัติไม่สำเร็จ: ${getSafeAuthErrorMessage(error)}`;
  } finally {
    els.approveButton.disabled = false;
    els.approveButton.textContent = "อนุมัติและบันทึก";
  }
}

async function generateStudioMaster(options = {}) {
  const { rerun = false } = options;
  const validationMessage = validateInputFiles();
  if (!canGenerateStudioMaster()) {
    renderStudioMasterPanel("ต้องอนุมัติภาพหลักและตรวจครบ 7/7 ก่อนสร้าง Studio Master");
    return;
  }
  if (validationMessage) {
    renderStudioMasterPanel(validationMessage);
    return;
  }

  currentStudioMasterImageUrl = rerun ? currentStudioMasterImageUrl : "";
  approvedStudioMasterImageUrl = "";
  currentStudioMasterGenerationId = "";
  supportResults = [];
  renderSupportGallery();
  renderStudioMasterPanel("กำลังสร้าง Studio Master...");
  els.generateStudioMasterButton.disabled = true;
  els.rerunStudioMasterButton.disabled = true;
  els.approveStudioMasterButton.disabled = true;
  els.generateStudioMasterButton.textContent = rerun ? "กำลังสร้างใหม่..." : "กำลังสร้าง...";

  try {
    const prompt = buildStudioMasterPrompt();
    const data = await startGenerationJob(
      buildGenerateFormData(prompt, getStudioMasterGenerationImageUrls(), {
        jobKind: "studio_master",
        shot: "studio_master",
        jobId: currentJobId
      }),
      (job) => {
        renderStudioMasterPanel(`${getJobTitle(job)} · ${job.message || "กำลังสร้าง Studio Master"}`);
      }
    );
    currentJobId = data.jobId || currentJobId;
    currentStudioMasterGenerationId = data.generationId || "";
    currentStudioMasterImageUrl = data.images[0].url;
    renderStudioMasterPanel("รอตรวจ Studio Master");
    addHistoryItem({
      name: `${getJobBaseName("Studio Master")} · Studio Master`,
      type: "Studio Master",
      category: els.category.value,
      status: "รอตรวจ"
    });
    refreshMetrics();
  } catch (error) {
    renderStudioMasterPanel(`สร้าง Studio Master ไม่สำเร็จ: ${getSafeAuthErrorMessage(error) || error.message}`);
  } finally {
    els.generateStudioMasterButton.textContent = "สร้าง Studio Master";
    updateWorkflowGate();
    updateActionAvailability();
  }
}

async function approveStudioMaster() {
  if (!currentStudioMasterImageUrl || !currentStudioMasterGenerationId) {
    renderStudioMasterPanel("ยังไม่มี Studio Master ที่พร้อมอนุมัติ");
    return;
  }

  els.approveStudioMasterButton.disabled = true;
  els.approveStudioMasterButton.textContent = "กำลังบันทึก...";
  try {
    const response = await authFetchWithTimeout("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl: currentStudioMasterImageUrl,
        jobName: `${getJobBaseName("studio-master")}-studio-master`,
        generationId: currentStudioMasterGenerationId,
        ...getRequestMetadata({ jobKind: "studio_master", shot: "studio_master", jobId: currentJobId })
      })
    }, 90000, "อนุมัติ Studio Master ใช้เวลานานผิดปกติ กรุณาลองใหม่อีกครั้ง");
    const data = await readJsonResponse(response, "อนุมัติ Studio Master ไม่สำเร็จ: server ส่งข้อมูลกลับมาไม่ถูกต้อง");
    if (!response.ok || !data.ok) throw new Error(getApiErrorMessage(response, data, "อนุมัติ Studio Master ไม่สำเร็จ"));

    approvedStudioMasterImageUrl = currentStudioMasterImageUrl;
    renderStudioMasterPanel(getApprovalMessage(data) || "อนุมัติ Studio Master แล้ว");
    addHistoryItem({
      name: `${getJobBaseName("Studio Master")} · อนุมัติแล้ว`,
      type: "Studio Master",
      category: els.category.value,
      status: "พร้อมทำภาพเสริม"
    });
    updateWorkflowGate();
    renderAssets();
    refreshMetrics();
  } catch (error) {
    renderStudioMasterPanel(`อนุมัติ Studio Master ไม่สำเร็จ: ${getSafeAuthErrorMessage(error) || error.message}`);
  } finally {
    els.approveStudioMasterButton.textContent = "อนุมัติ Studio Master";
    updateActionAvailability();
  }
}

async function generateSupportSet() {
  const heroUrl = approvedHeroImageUrl || currentGeneratedImageUrl;
  const selectedShots = getSelectedSupportShots();
  const validationMessage = validateInputFiles();

  if (!heroUrl) {
    renderSupportMessage("ต้องสร้างและอนุมัติภาพหลักก่อน หรืออย่างน้อยต้องมีภาพหลักที่สร้างสำเร็จ");
    return;
  }

  if (!approvedHeroImageUrl) {
    renderSupportMessage("แนะนำให้อนุมัติภาพหลักก่อน เพื่อใช้ภาพที่ผ่านการตรวจแล้วเป็นภาพตั้งต้น");
    return;
  }

  if (!approvedStudioMasterImageUrl) {
    renderSupportMessage("ต้องสร้างและอนุมัติ Studio Master ก่อนสร้างภาพเสริม");
    return;
  }

  if (!isQcComplete()) {
    renderSupportMessage("ต้องตรวจให้ครบ 7/7 ก่อนสร้างภาพเสริม เพื่อยืนยันว่าภาพหลักพร้อมใช้เป็นตัวตั้งต้น");
    return;
  }

  if (validationMessage) {
    renderSupportMessage(validationMessage);
    return;
  }

  if (!selectedShots.length) {
    renderSupportMessage("เลือกมุมภาพอย่างน้อย 1 มุมก่อนสร้างภาพเสริม");
    return;
  }

  supportResults = selectedShots.map((shot) => ({ shot, status: "waiting", imageUrl: "" }));
  renderSupportGallery();
  els.generateSupportButton.disabled = true;
  els.generateSupportButton.textContent = "กำลังสร้างภาพเสริม...";

  for (let index = 0; index < selectedShots.length; index += 1) {
    const shot = selectedShots[index];
    supportResults[index].status = "generating";
    renderSupportGallery();

    try {
      const prompt = buildSupportPrompt(shot, index + 1, selectedShots.length);
      const data = await startGenerationJob(buildGenerateFormData(prompt, getOrderedSupportGenerationImageUrls(shot), { jobKind: "support", shot, jobId: currentJobId }), (job) => {
        supportResults[index].status = `${getJobTitle(job)}: ${job.message || ""}`;
        renderSupportGallery();
      });

      supportResults[index] = {
        shot,
        status: "done",
        imageUrl: data.images[0].url,
        requestId: data.requestId || ""
      };
    } catch (error) {
      supportResults[index] = {
        shot,
        status: `error: ${error.message}`,
        imageUrl: ""
      };
    }
    renderSupportGallery();
    renderAssets();
  }

  updateWorkflowGate();
  refreshMetrics();
  els.generateSupportButton.textContent = "สร้างภาพเสริม";
}

async function approveSupportSet() {
  const readyItems = supportResults.filter((item) => item.imageUrl && item.status === "done");
  if (!readyItems.length) {
    renderSupportMessage("ยังไม่มีภาพเสริมที่พร้อมอนุมัติ");
    return;
  }

  els.approveSupportButton.disabled = true;
  els.approveSupportButton.textContent = "กำลังบันทึกภาพเสริม...";

  let savedCount = 0;
  try {
    for (const item of readyItems) {
      try {
        const response = await authFetchWithTimeout("/api/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: item.imageUrl,
            jobName: `${getJobBaseName("support-product")}-${item.shot}`,
            ...getRequestMetadata({ jobKind: "support", shot: item.shot, jobId: currentJobId })
          })
        }, 90000, "อนุมัติและบันทึกใช้เวลานานผิดปกติ กรุณาลองใหม่อีกครั้ง");
        const data = await readJsonResponse(response, "อนุมัติและบันทึกไม่สำเร็จ: server ส่งข้อมูลกลับมาไม่ถูกต้อง");
        if (!response.ok || !data.ok) throw new Error(getApiErrorMessage(response, data, "อนุมัติและบันทึกไม่สำเร็จ"));
        item.status = "approved";
        item.savedPath = data.googleDriveFile?.webViewLink || data.drivePath || data.approvedPath;
        savedCount += 1;
      } catch (error) {
        item.status = `approve error: ${getSafeAuthErrorMessage(error)}`;
      }
      renderSupportGallery();
      renderAssets();
    }

    addHistoryItem({
      name: `${getJobBaseName("ชุดภาพเสริม")} (${savedCount} ภาพ)`,
      type: "ชุดภาพเสริม",
      category: els.category.value,
      status: savedCount === readyItems.length ? "อนุมัติแล้ว" : "อนุมัติบางส่วน"
    });

    updateWorkflowGate();
    refreshMetrics();
  } finally {
    els.approveSupportButton.disabled = false;
    els.approveSupportButton.textContent = "อนุมัติภาพเสริม";
  }
}

async function rerunSupportImage(index) {
  const item = supportResults[index];
  if (!item) return;

  if (!approvedHeroImageUrl) {
    supportResults[index] = { ...item, status: "ยังสร้างใหม่ไม่ได้: ต้องมีภาพหลักที่อนุมัติแล้วก่อน" };
    renderSupportGallery();
    return;
  }

  if (!approvedStudioMasterImageUrl) {
    supportResults[index] = { ...item, status: "ยังสร้างใหม่ไม่ได้: ต้องสร้างและอนุมัติ Studio Master ก่อน" };
    renderSupportGallery();
    return;
  }

  if (!isQcComplete()) {
    supportResults[index] = { ...item, status: "ยังสร้างใหม่ไม่ได้: ต้องตรวจให้ครบ 7/7 ก่อน" };
    renderSupportGallery();
    return;
  }

  const validationMessage = validateInputFiles();
  if (validationMessage) {
    supportResults[index] = { ...item, status: `rerun blocked: ${validationMessage}` };
    renderSupportGallery();
    return;
  }

  const previousImageUrl = item.imageUrl;
  supportResults[index] = {
    ...item,
    status: "กำลังเตรียมสร้างใหม่",
    imageUrl: previousImageUrl,
    requestId: "",
    savedPath: ""
  };
  renderSupportGallery();

  try {
    const prompt = `${buildSupportPrompt(item.shot, index + 1, supportResults.length || 1)}
Rerun correction: regenerate only this support shot from the approved hero anchor. Pay extra attention to preserving every visible product detail from the hero, including real logo patches or labels only when they are visible and physically correct for this shot, zipper pulls, stitching, fur/lining, material texture, color, shape, and proportions. If a logo or detail exists on the hero/reference product and naturally belongs in this support shot, keep it visible and consistent.`;

    const data = await startGenerationJob(buildGenerateFormData(prompt, getOrderedSupportGenerationImageUrls(item.shot), { jobKind: "support", shot: item.shot, jobId: currentJobId }), (job) => {
      supportResults[index] = {
        ...supportResults[index],
        status: `กำลังสร้างใหม่: ${getJobTitle(job)}${job.message ? ` · ${job.message}` : ""}`,
        imageUrl: previousImageUrl
      };
      renderSupportGallery();
    });

    supportResults[index] = {
      shot: item.shot,
      status: "done",
      imageUrl: data.images[0].url,
      requestId: data.requestId || ""
    };
    refreshMetrics();
  } catch (error) {
    supportResults[index] = {
      ...item,
      status: `สร้างใหม่ไม่สำเร็จ: ${error.message}`,
      imageUrl: previousImageUrl
    };
  }

  renderSupportGallery();
  renderAssets();
}

function buildGenerateFormData(prompt, extraImageUrls = [], metadataOverrides = {}) {
  const productFiles = Array.from(els.productImages.files || []);
  const modelFiles = getSelectedBrandProfile().forceOffModel ? [] : Array.from(els.modelImages.files || []);
  const formData = new FormData();
  productFiles.forEach((file) => formData.append("productImages", file));
  modelFiles.forEach((file) => formData.append("modelImages", file));
  formData.append("prompt", prompt);
  formData.append("imageSize", els.imageSize.value);
  formData.append("quality", els.quality.value);
  formData.append("numImages", "1");
  formData.append("outputFormat", "png");
  Object.entries(getRequestMetadata(metadataOverrides)).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") formData.append(key, value);
  });
  if (extraImageUrls.length) {
    formData.append("extraImageUrls", JSON.stringify(extraImageUrls));
  }
  if (selectedCatalogSku?.sku && stagedCatalogReferenceKeys.length) {
    formData.append("catalogReferenceSku", selectedCatalogSku.sku);
    formData.append("catalogReferenceKeys", JSON.stringify(stagedCatalogReferenceKeys));
  } else if (!productFiles.length && canAutoUseCatalogReferencesForHero()) {
    formData.append("catalogReferenceSku", selectedCatalogSku.sku);
    formData.append("catalogReferenceAutoUse", "true");
  }
  return formData;
}

function getRequestMetadata(overrides = {}) {
  const subtype = getSelectedSubtype();
  return {
    operatorName: els.operatorName.value.trim() || "ไม่ระบุผู้ใช้งาน",
    sku: els.productSku.value.trim(),
    productName: getJobBaseName("Untitled product"),
    brand: els.brandName.value.trim(),
    catalogProductName: selectedCatalogSku?.product_name || "",
    catalogSource: selectedCatalogSku?.canonical_source || "",
    catalogBranch: selectedCatalogSku?.branch || "",
    catalogReferenceStatus: selectedCatalogSku?.reference_readiness?.status || "",
    catalogReferenceUrl: selectedCatalogSku?.reference_url || "",
    catalogReferenceDriveId: selectedCatalogSku?.reference_drive_id || "",
    brandProfile: getSelectedBrandProfile().shortName,
    category: els.category.value,
    productSubtypeValue: subtype?.value || "auto",
    productSubtypeLabel: subtype?.label || "ระบบเลือกจากภาพอ้างอิง",
    imageType: els.imageType.value,
    shotType: els.shotType.value,
    jobKind: overrides.jobKind || "hero",
    shot: overrides.shot || els.shotType.value || "Hero",
    jobId: overrides.jobId || ""
  };
}

async function startGenerationJob(formData, onProgress = () => {}) {
  logAction("generate", "before /api/generate/start");
  const response = await authFetchWithTimeout("/api/generate/start", {
    method: "POST",
    body: formData
  }, 90000, "ระบบใช้เวลานานผิดปกติ กรุณาลองใหม่อีกครั้ง");
  logAction("generate", "request sent", { httpStatus: response.status });
  const startData = await readJsonResponse(response, "เริ่มงาน Generate ไม่สำเร็จ: server ส่งข้อมูลกลับมาไม่ถูกต้อง");
  logAction("generate", "response status/body", {
    httpStatus: response.status,
    ok: startData.ok === true,
    jobId: startData.jobId || "",
    databaseJobId: startData.databaseJobId || "",
    generationId: startData.generationId || "",
    jobStatus: startData.job?.status || ""
  });

  if (!response.ok || !startData.ok) {
    throw new Error(getApiErrorMessage(response, startData, "ส่งงาน generate ไม่สำเร็จ"));
  }

  const startJobId = startData.databaseJobId || startData.jobId;
  const startGenerationId = startData.generationId || startData.job?.generationId || "";
  if (!startJobId || !startGenerationId) {
    throw new Error("เริ่มงาน generate ไม่สำเร็จ: ไม่พบ jobId หรือ generationId");
  }

  onProgress(startData.job);
  logAction("generate", "polling started", { jobId: startData.jobId || startJobId });
  const data = await pollGenerationJob(startData.jobId || startJobId, onProgress);
  logAction("generate", "completed", {
    jobId: data.jobId || startJobId,
    generationId: data.generationId || startGenerationId,
    imageCount: data.images?.length || 0
  });
  return {
    ...data,
    jobId: startJobId,
    generationId: startGenerationId || data.generationId || ""
  };
}

async function pollGenerationJob(jobId, onProgress) {
  let failedPolls = 0;
  const startedAt = Date.now();
  const maxWaitMs = 12 * 60 * 1000;
  for (;;) {
    if (Date.now() - startedAt > maxWaitMs) {
      logAction("generate", "timeout", { jobId });
      throw new Error("ระบบใช้เวลานานผิดปกติ กรุณาลองใหม่อีกครั้ง");
    }
    await delay(1800);
    try {
      const response = await authFetch(`/api/generate/jobs/${encodeURIComponent(jobId)}`, {
        timeoutMs: 12000,
        timeoutMessage: "อ่านสถานะ generation ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Cannot read generation job");
      }

      const job = data.job;
      onProgress(job);

      if (job.status === "done") {
        return {
          ok: true,
          jobId: job.databaseJobId || job.jobId || jobId,
          generationId: job.generationId || "",
          requestId: job.requestId,
          images: job.images,
          usage: job.usage || null
        };
      }

      if (job.status === "error") {
        logAction("generate", "failed", { jobId, reason: job.error || job.message || "Generation failed" });
        throw new Error(job.error || job.message || "Generation failed");
      }

      failedPolls = 0;
    } catch (error) {
      failedPolls += 1;
      if (failedPolls >= 8) {
        logAction("generate", "failed", { jobId, reason: getSafeAuthErrorMessage(error) });
        throw new Error(`ติดต่อ server ไม่ได้ระหว่างรอผล: ${error.message}`);
      }
      onProgress({
        status: "reconnecting",
        message: `กำลังเชื่อมต่อ server ใหม่ (${failedPolls}/8)`
      });
    }
  }
}

function getJobTitle(job) {
  const titles = {
    queued: "เข้าคิวแล้ว",
    uploading: "กำลังอัปโหลดรูปอ้างอิง",
    generating: "กำลังสร้างภาพ",
    reconnecting: "กำลังเชื่อมต่อใหม่",
    done: "สร้างภาพสำเร็จ",
    error: "สร้างภาพไม่สำเร็จ"
  };
  return titles[job.status] || "กำลังทำงาน";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validateInputFiles() {
  const productFiles = Array.from(els.productImages.files || []);
  const modelFiles = getSelectedBrandProfile().forceOffModel ? [] : Array.from(els.modelImages.files || []);
  if (isSelectedSkuReferenceBlockedWithoutFallback()) return getSelectedSkuReferenceBlockerMessage();
  if (!productFiles.length && catalogReferenceLoading && hasSelectedCatalogReferenceSource()) return "กำลังโหลดรูปอ้างอิงจาก Google Drive กรุณารอสักครู่แล้วกดสร้างภาพหลักอีกครั้ง";
  if (!productFiles.length && hasSelectedCatalogReferenceSource() && !hasSelectedCatalogStageableReferences()) return "ยังไม่มีรูปจาก Google Drive ที่ใช้สร้างภาพหลักได้ กรุณาตรวจรูปอ้างอิงหรือสิทธิ์ของ Drive";
  if (!productFiles.length && !hasStagedCatalogReferences() && !canAutoUseCatalogReferencesForHero()) return "กรุณาอัปโหลดรูปสินค้าอย่างน้อย 1 รูป หรือเลือกสินค้าที่มีรูปจากแคตตาล็อก/Drive";
  if (productFiles.length > 10) return "ภาพสินค้าอ้างอิงใส่ได้สูงสุด 10 ภาพ";
  if (modelFiles.length > 5) return "ภาพโมเดลอ้างอิงใส่ได้สูงสุด 5 ภาพ";
  return "";
}

function getSelectedSubtype() {
  const options = productSubtypes[els.category.value] || [];
  return options.find((item) => item.value === els.productSubtype.value) || options[0] || { label: "ระบบเลือกจากภาพอ้างอิง", value: "auto", rule: "" };
}

function getSubtypePromptRule() {
  const subtype = getSelectedSubtype();
  if (!subtype || subtype.value === "auto") {
    return "Product subtype logic: infer the exact subtype from the attached product references. Do not use SKU or staff filename as visual direction.";
  }
  return `Product subtype logic: ${subtype.rule}`;
}

function getSelectedBrandProfile() {
  return brandProfiles[els.brandProfile.value] || brandProfiles.custom;
}

function getEffectiveMode(selectedType, brandProfile = getSelectedBrandProfile()) {
  return brandProfile.forceOffModel ? "Off-model" : selectedType.mode;
}

function getBrandImagePrompt(selectedType, brandProfile, effectiveMode) {
  if (brandProfile.forceOffModel) {
    return [
      "Create a product-only e-commerce catalog image. No model, no face, no body parts, no mannequin, and no lifestyle scene.",
      brandProfile.backgroundRule,
      brandProfile.styleRule
    ].join(" ");
  }

  return [
    selectedType.prompt,
    brandProfile.backgroundRule,
    effectiveMode === "On-model" ? brandProfile.modelRule : "",
    brandProfile.styleRule
  ]
    .filter(Boolean)
    .join(" ");
}

function isUnisexModelProfile(model) {
  return /unisex|ชายหญิง|ชายและหญิง|ทั้งชายและหญิง/i.test(model || "");
}

function getModelDirection(category, model, brandProfile) {
  const selectedModel = model === "ระบบเลือกโมเดลให้เหมาะกับสินค้า" ? getAutoModelDirection(category) : model;
  if (isUnisexModelProfile(selectedModel)) {
    return `${getUnisexModelDirection(category, selectedModel)} ${brandProfile.modelRule} Keep both models aspirational but not over-posed, and keep the product as the main selling focus on both bodies.`;
  }
  return `Model profile: ${selectedModel}. ${getCropDirection(category)} ${brandProfile.modelRule} Keep the model aspirational but not over-posed, and keep the product as the main selling focus.`;
}

function getUnisexModelDirection(category, model) {
  const pairDirection = /วัยรุ่น/i.test(model)
    ? "a young adult Thai man and a young adult Thai woman with fresh, cheerful social-commerce energy"
    : "a Thai working-age man and a Thai working-age woman with polished, approachable social-commerce energy";

  return [
    `Model profile: Unisex two-model composition. Show exactly two models together in the same frame: ${pairDirection}.`,
    "Both models must wear the same exact product style from the reference so the image clearly communicates that this garment is suitable for both men and women.",
    "Balance the two models equally in scale, lighting, styling quality, and product readability. Do not make one model feel like a background extra.",
    getUnisexCropDirection(category),
    "Unisex product allowance: two worn copies of the same product are allowed only for this unisex communication shot. They must match the reference product identity, color, material, silhouette, construction, and visible details."
  ].join(" ");
}

function getUnisexCropDirection(category) {
  if (category === "เสื้อโค้ทยาว / พาร์กา") {
    return "Crop direction: use a two-person near full-body catalog crop from head to ankle or head to mid-calf so coat length, silhouette, sleeves, hood/collar, front opening, and hem are readable on both the man and woman.";
  }
  if (category === "เสื้อแจ็คเก็ต / เสื้อท่อนบน") {
    return "Crop direction: use a two-person upper-body or three-quarter catalog crop from head/neck to hip or upper thigh, keeping the jacket/top large and readable on both the man and woman. Do not use a distant full-body crop unless the garment length requires it.";
  }
  if (category === "กางเกง") {
    return "Crop direction: use a balanced two-person waist-to-feet or three-quarter crop. Pants must remain readable on both the man and woman, including waistband, pockets, leg shape, length, and hem.";
  }
  if (category === "รองเท้า / บูท") {
    return "Crop direction: use a two-person lower-leg crop only, showing one male styling and one female styling side by side. Do not show faces or full bodies. Keep the footwear dominant and readable on both people.";
  }
  if (category === "ถุงเท้า") {
    return "Crop direction: use a two-person lower-calf-to-feet crop only, showing the socks clearly on both a man and a woman. Socks must stay larger than any shoes or pants.";
  }
  if (category === "ถุงมือ") {
    return "Crop direction: use a two-person hands-and-forearms crop only, showing the gloves clearly on both a man and a woman with coordinated winter sleeves.";
  }
  if (category === "หมวก") {
    return "Crop direction: use a two-person head-and-shoulders crop, showing the hat clearly on both a man and a woman with balanced face visibility and winter collar styling.";
  }
  if (category === "ผ้าพันคอ / อุปกรณ์ชิ้นเล็ก") {
    return "Crop direction: use a two-person head-to-torso or relevant body crop that shows how the accessory works for both a man and a woman while keeping the accessory dominant.";
  }
  return "Crop direction: use the most useful balanced two-person catalog crop for this product category, keeping the product readable on both the man and woman.";
}

function getCiSafetyRule() {
  return "CI safety rule: the selected visual profile is only for scene cleanliness, lighting, casting, crop, and mood. Do not add any store/business brand name, store/business logo, watermark, hangtag, packaging, sign, advertising text, or graphic badge to the image. Preserve real product logos, product labels, product patches, and product text only when they already exist on the attached product reference or approved hero. If the product has no real brand mark in the reference and no product brand is provided, keep the product completely unbranded.";
}

function applyBrandProfileUiHints() {
  const brandProfile = getSelectedBrandProfile();
  if (brandProfile.forceOffModel && els.imageType.value === "ใส่กับโมเดล") {
    els.imageType.value = DEFAULT_IMAGE_TYPE;
  }
  els.modelImages.disabled = brandProfile.forceOffModel;
}

function getJobBaseName(fallback) {
  const sku = els.productSku.value.trim();
  if (sku) return sku;
  const subtype = getSelectedSubtype();
  return subtype?.value && subtype.value !== "auto" ? subtype.value : fallback;
}

function buildPrompt() {
  const selectedType = imageTypes[els.imageType.value] || imageTypes[DEFAULT_IMAGE_TYPE];
  const effectiveMode = getEffectiveMode(selectedType, getSelectedBrandProfile());
  currentPrompt = buildManualHeroPromptV3();
  els.promptOutput.textContent = currentPrompt;
  updateMeta(effectiveMode, els.category.value, getRisk(els.brandName.value.trim(), els.keyFeature.value.trim()));
  return currentPrompt;
}

function buildSupportPrompt(shot, shotIndex, totalShots) {
  const isDetailShot = isManualDetailSupportShot(shot);
  const brief = buildManualPdpSupportBrief(shot);
  const referenceLines = isDetailShot
    ? [
      "Reference Image 1 คือ Studio Master ที่อนุมัติแล้ว ใช้ล็อกฉาก studio แสง โทน สัดส่วนสินค้า และความต่อเนื่องของ gallery",
      "Reference Image 2 คือภาพหลักที่อนุมัติแล้ว ใช้ล็อกความสมจริง โมเดล และภาพรวมของเซ็ต",
      "Reference Image 3 เป็นต้นไปคือภาพสินค้าจริงจากแคตตาล็อก/Drive ใช้เป็น source of truth เพื่อตรวจสี ทรง วัสดุ โลโก้ แพตช์ และรายละเอียดจริง"
    ]
    : [
      "Reference Image 1 คือภาพหลักที่อนุมัติแล้ว ใช้ล็อกคนเดิม ทรงการใส่ styling แสง โทน และความสมจริง",
      "Reference Image 2 คือ Studio Master ที่อนุมัติแล้ว ใช้ล็อกฉาก studio สัดส่วนสินค้า และความต่อเนื่องของ gallery",
      "Reference Image 3 เป็นต้นไปคือภาพสินค้าจริงจากแคตตาล็อก/Drive ใช้เป็น source of truth เพื่อตรวจสี ทรง วัสดุ โลโก้ แพตช์ และรายละเอียดจริง"
    ];
  return [
    "อ้างอิงภาพหลักที่อนุมัติแล้ว Studio Master ที่อนุมัติแล้ว และภาพสินค้าจริงจากแคตตาล็อก/Drive",
    ...referenceLines,
    "",
    `[SPECIFIC_ANGLE] = ${brief.angle}`,
    `[PRODUCT_CATEGORY] = ${brief.productCategory}`,
    `[KEY_DETAIL] = ${brief.keyDetail}`,
    "",
    buildManualSupportCreateLine(brief),
    buildManualSupportTruthLine(shot),
    "รูปจริงจากแคตตาล็อก/Drive ใช้เป็น source of truth ของสินค้าเท่านั้น ไม่ใช้เป็น output โดยตรง",
    buildManualSupportPresentationLine(shot)
  ].join("\n");
}

function buildStudioMasterPrompt() {
  return [
    "อ้างอิงภาพหลักที่อนุมัติแล้วและภาพสินค้าจริง",
    "Reference Image 1 คือภาพหลักที่อนุมัติแล้ว ใช้ล็อกความสมจริง ทรงการใส่ โมเดล และโทนภาพ",
    "Reference Image 2 เป็นต้นไปคือภาพสินค้าจริง ใช้ล็อกสี ทรง วัสดุ โลโก้ แพตช์ ซิป ซับใน เฟอร์ และรายละเอียดจริง",
    "",
    "สร้างภาพ Studio Master สำหรับหน้าสินค้า เป็นภาพ studio ขาวหรือเทาอ่อนสะอาด สวยพอใช้ใน gallery เว็บไซต์",
    "สินค้าเป็นจุดเด่นหลัก เห็นรูปทรงโดยรวมชัดเจน เหมาะเป็นภาพอ้างอิงหลักสำหรับทำภาพมุมอื่นต่อ",
    "ถ้าสินค้าเป็นเสื้อ/โค้ท/เฟอร์และภาพหลักมีคน ให้ใช้คนเดิมจากภาพหลัก คงโครงหน้า ทรงผม สีผม ผิว สัดส่วน เสื้อด้านใน และ styling ห้ามเปลี่ยนคนเป็นคนใหม่",
    "สี ทรง วัสดุ โลโก้ แพตช์ ตัวเลขหรือข้อความเทคนิคจริง และรายละเอียดสำคัญต้องใกล้เคียงภาพต้นฉบับ ห้ามสร้างข้อความหรือตัวเลขใหม่",
    "ไม่ต้องใส่ข้อความ ไม่ต้องแบ่งกริด ไม่ต้องทำ collage"
  ].join("\n");
}

function buildManualHeroPromptV3() {
  return [
    buildLeanThaiHeroPromptBase(),
    buildManualHeroSmallProductCameraLine()
  ].filter(Boolean).join("\n\n");
}

function buildLeanThaiHeroPromptBase() {
  return [
    "อ้างอิงภาพต้นฉบับ สร้างภาพรีวิวที่ดูเรียล สื่อถึงการใช้งานจริงของสินค้า ให้ความรู้สึกเข้าถึงง่าย น่าเชื่อถือ พร้อมจัดองค์ประกอบภาพให้ดึงดูดและเหมาะกับการใช้ในสื่อโซเชียลหรือโฆษณา ไม่ต้องใส่ข้อความ ไม่ต้องแบ่งกริด",
    "",
    "กลุ่มเป้าหมาย: ผู้เดินทางท่องเที่ยวต่างประเทศเป็นประจำ",
    "ธุรกิจเช่า จำหน่ายชุดกันหนาวและอุปกรณ์กันหนาวครบวงจรในไทย เน้นกลุ่มเป้าหมายระดับกลางถึงสูง"
  ].join("\n");
}

function buildManualHeroSmallProductCameraLine() {
  const group = resolveManualProductUseCaseGroup();
  const lines = {
    gloves: "สำหรับถุงมือ ใช้มุมภาพระยะใกล้หรือครอปที่โฟกัสสินค้าเป็นหลัก ให้ถุงมือเด่นที่สุดในภาพ",
    hat: "สำหรับหมวก ใช้มุมภาพระยะใกล้หรือครอปช่วงศีรษะและไหล่ ให้หมวกเด่นที่สุดในภาพ",
    scarf_accessory: "สำหรับผ้าพันคอหรือผ้าคลุมคอ ใช้มุมภาพระยะใกล้จากคอถึงอกหรือช่วงลำตัวบน ให้สินค้าเด่นที่สุดในภาพ",
    socks: "สำหรับถุงเท้า ใช้มุมภาพระยะใกล้จากน่องถึงเท้าหรือครอปที่โฟกัสสินค้า ให้ถุงเท้าเด่นที่สุดในภาพ"
  };
  return lines[group] || "";
}

function buildManualSupportCreateLine(brief = {}) {
  return [
    `สร้างภาพสนับสนุนหน้า PDP ของ${brief.productCategory} ในมุม${brief.angle}`,
    "ให้ดูเรียล โปร่งใส และน่าเชื่อถือ สื่อถึงสินค้าของแท้ในสภาพที่สะอาดสมบูรณ์ พรีเมียม และพร้อมใช้งานจริง",
    `จัดวางอย่างเป็นระเบียบบนพื้นผิวสตูดิโอสีเทาอ่อนที่เรียบมินิมอล เน้นแสดงให้เห็น${brief.keyDetail}อย่างชัดเจน`,
    "จัดแสงไฟโชว์รูมที่สว่างเคลียร์และเป็นธรรมชาติ ไม่ดูเป็นภาพโฆษณาแฟชั่นที่รีทัชจนเนียนกริบหรือเงาเว่อร์เกินจริง"
  ].join(" ");
}

function buildManualPdpSupportBrief(shot) {
  const group = resolveManualProductUseCaseGroup();
  return {
    angle: resolveManualPdpSupportAngle(shot, group),
    productCategory: resolveManualPdpProductCategory(group),
    keyDetail: resolveManualPdpKeyDetail(shot, group)
  };
}

function resolveManualPdpSupportAngle(shot, group) {
  const normalizedShot = String(shot || "").trim();
  if (isInteriorSupportShot(normalizedShot)) return "ซูมรายละเอียดด้านใน (Interior View)";
  if (normalizedShot === "ด้านหลัง") {
    return group === "pants" ? "ด้านหลังเต็มตัวแบบวางราบ (Full Flat Lay Back View)" : "ด้านหลังแบบสตูดิโอ (Studio Back View)";
  }
  if (normalizedShot === "ด้านข้าง") return "ด้านข้างแบบสตูดิโอ (Studio Side View)";
  if (normalizedShot === "พื้นรองเท้า") return "เจาะรายละเอียดพื้นรองเท้า (Outsole Detail View)";
  if (normalizedShot === "ด้านในฝ่ามือ") return "ด้านฝ่ามือแบบเจาะรายละเอียด (Palm Detail View)";
  if (isManualDetailSupportShot(normalizedShot)) {
    return group === "gloves" || group === "hat" || group === "scarf_accessory" || group === "socks"
      ? "เจาะลึกรายละเอียดอุปกรณ์ (Close-up Detailed View)"
      : "เจาะลึกรายละเอียดวัสดุและงานประกอบ (Close-up Detailed View)";
  }
  if (normalizedShot === "ด้านหน้า") return "ด้านหน้าแบบสตูดิโอ (Studio Front View)";
  return `${normalizedShot || "มุมสินค้าเพิ่มเติม"} สำหรับหน้า PDP`;
}

function resolveManualPdpProductCategory(group) {
  const category = String(els.category?.value || "").trim();
  const subtype = String(getSelectedSubtype()?.label || "").trim();
  const productName = String(selectedCatalogSku?.product_name || els.skuPickerSearch?.value || "").trim();
  const text = `${category} ${subtype} ${productName}`.toLowerCase();
  if (group === "upper_outerwear" || group === "long_outerwear") {
    if (/down|ขนเป็ด|duck/.test(text)) return "เสื้อโค้ทกันหนาวขนเป็ด";
    if (/fur|เฟอร์/.test(text)) return "เสื้อโค้ทกันหนาวขนเฟอร์";
    if (/fleece|ฟลีซ/.test(text)) return "เสื้อแจ็คเก็ตกันหนาวฟลีซ";
    return "เสื้อโค้ทหรือแจ็คเก็ตกันหนาว";
  }
  if (group === "pants") return "กางเกงลุยหิมะกันหนาว";
  if (group === "footwear") return "รองเท้าหรือบูทกันหนาว";
  if (group === "gloves") return /waterproof|กันน้ำ/.test(text) ? "ถุงมือกันหนาวกันน้ำ" : "ถุงมือกันหนาว";
  if (group === "hat") return "หมวกกันหนาว";
  if (group === "scarf_accessory") return "ผ้าพันคอหรือผ้าคลุมคอกันหนาว";
  if (group === "socks") return "ถุงเท้ากันหนาว";
  return subtype || category || productName || "สินค้า";
}

function resolveManualPdpKeyDetail(shot, group) {
  const normalizedShot = String(shot || "").trim();
  if (isInteriorSupportShot(normalizedShot)) {
    return "ตัวอักษรบนป้ายแคร์ลาเบล (Care Label) และความสะอาดของเนื้อผ้าซับในด้านใน";
  }
  if (group === "pants") {
    if (normalizedShot === "ด้านหลัง") return "ทรงกางเกง ตะเข็บเย็บ และกระเป๋าหลังทั้งหมด";
    return "ทรงกางเกง ตะเข็บ กระเป๋า ผิวผ้า และรายละเอียดการตัดเย็บ";
  }
  if (group === "gloves") {
    if (normalizedShot === "ด้านในฝ่ามือ" || isManualDetailSupportShot(normalizedShot)) {
      return "พื้นผิวกันลื่นตรงฝ่ามือ (Grip Texture) และสายรัดข้อมือ";
    }
    return "รูปทรงนิ้ว ขอบข้อมือ ตะเข็บ วัสดุ และความหนาของถุงมือ";
  }
  if (group === "footwear") {
    if (normalizedShot === "พื้นรองเท้า") return "ลายพื้นรองเท้า ความหนา ขอบพื้น และพื้นผิวกันลื่น";
    return "ทรงรองเท้า ความสูง วัสดุ เชือกหรือสายรัด ป้ายจริง พื้นรองเท้า และงานเย็บ";
  }
  if (group === "scarf_accessory") return "เนื้อผ้า ลายถัก ขอบผ้า ความหนา และการทิ้งตัวของผ้า";
  if (group === "hat") return "ทรงหมวก ขอบพับ เนื้อผ้า ป้ายจริง และความหนาของวัสดุ";
  if (group === "socks") return "ขอบถุงเท้า เนื้อผ้า ความหนา ส้น ปลายเท้า ลายถัก และตะเข็บ";
  if (normalizedShot === "ด้านหลัง") return "ดีไซน์ด้านหลัง ฮู้ด ทรงไหล่ ความยาว ตะเข็บ และโลโก้หรือแพตช์จริงถ้ามี";
  if (normalizedShot === "ด้านข้าง") return "ทรงด้านข้าง ความหนา ความยาว ปลายแขน ซิป ตะเข็บ และสัดส่วนสินค้า";
  if (isManualDetailSupportShot(normalizedShot)) return "พื้นผิววัสดุ งานเย็บ ซิป ป้ายจริง ขอบผ้า และรายละเอียดที่ช่วยตัดสินใจ";
  return describeManualSupportShotV3(normalizedShot);
}

function buildManualSupportTruthLine(shot = "") {
  const category = els.category.value || "";
  const detailSuffix = isManualDetailSupportShot(shot) ? " ภาพต้องเป็นภาพเดียว ไม่ใช่ collage" : "";
  if (category.includes("เสื้อ")) {
    return `สี ทรง วัสดุ โลโก้ แพตช์ ตัวเลขหรือข้อความเทคนิคจริง และรายละเอียดสำคัญต้องใกล้เคียงภาพต้นฉบับ ห้ามสร้างข้อความหรือตัวเลขใหม่${detailSuffix}`;
  }
  if (category.includes("รองเท้า")) {
    return `สี ทรง ความสูง วัสดุ เชือกหรือสายรัด ป้ายแบรนด์จริง พื้นรองเท้า และรายละเอียดสำคัญต้องใกล้เคียงภาพต้นฉบับ ห้ามสร้างข้อความหรือตัวเลขใหม่${detailSuffix}`;
  }
  return `สี ทรง วัสดุ โลโก้ ป้ายจริง และรายละเอียดสำคัญต้องใกล้เคียงภาพต้นฉบับ ห้ามสร้างข้อความหรือตัวเลขใหม่${detailSuffix}`;
}

function buildManualSupportPresentationLine(shot) {
  const modelLine = isManualDetailSupportShot(shot)
    ? "ภาพนี้เป็น product-only หรือ detail crop ไม่ต้องมีโมเดล ไม่ต้องยกฉาก lifestyle ของ Hero มาใหม่"
    : "ถ้าช็อตนี้ต้องมีคน ให้คงคนเดิมจากภาพหลักเท่าที่จำเป็น ห้ามเปลี่ยนสินค้า ทรง สี หรือ styling สำคัญ";
  return [
    modelLine,
    "ภาพต้องดูเป็นเซ็ตเดียวกับ Studio Master และ Hero แต่เป็นภาพสินค้า studio สำหรับ gallery เว็บไซต์",
    "ไม่ต้องใส่ข้อความ ไม่ต้องแบ่งกริด ไม่ต้องแบ่งช่อง",
    "Strictly a single unified photograph, one frame only. Absolutely no split screen, no grid, no collage, no triptych, no multiple panels."
  ].join(" ");
}

function isManualDetailSupportShot(shot = "") {
  return /โคลสอัพ|close-up|ซับใน|ด้านใน|พื้นรองเท้า|texture|วัสดุ|รายละเอียด|ขอบเฟอร์|บุขน|ซิป/i.test(String(shot || ""));
}

function describeManualSupportShotV3(shot) {
  const group = resolveManualProductUseCaseGroup();
  const normalizedShot = String(shot || "").trim();
  if (normalizedShot === "ด้านหลัง") {
    if (group === "upper_outerwear" || group === "long_outerwear") return "คนจริงสวมสินค้าจากมุมด้านหลัง ให้เห็นดีไซน์ด้านหลัง ฮู้ด ทรงไหล่ ความยาว ตะเข็บ และรายละเอียดจริงจากภาพต้นฉบับ";
    return "สินค้ามุมด้านหลัง ให้เห็นดีไซน์ด้านหลัง ความยาว ทรงไหล่ ตะเข็บ ฮู้ด ปก หรือรายละเอียดที่ภาพด้านหน้าไม่เห็น";
  }
  if (normalizedShot === "ด้านข้าง") {
    if (group === "footwear") return "รองเท้ามุมด้านข้าง ให้เห็นทรง ความสูง พื้นรองเท้า หัวรองเท้า เชือกหรือสายรัด และสัดส่วนเมื่อใช้งานจริง";
    if (group === "upper_outerwear" || group === "long_outerwear") return "คนจริงสวมสินค้าจากมุมด้านข้างหรือเฉียง 45 องศา ให้เห็นทรง ความหนา ความยาว การเข้ารูปจริง และโลโก้ แพตช์ ตัวเลข หรือข้อความเทคนิคจริงบนแขนถ้ามีในภาพต้นฉบับ";
    return "สินค้ามุมด้านข้างหรือเฉียง 45 องศา ให้เห็นทรง ความหนา ความยาว และสัดส่วนการใช้งานจริงอย่างชัดเจน";
  }
  if (normalizedShot === "มุมบน") {
    if (group === "footwear") return "รองเท้ามุมด้านบน ให้เห็นช่องเปิด เชือกหรือสายรัด วัสดุด้านบน และรูปทรงหัวรองเท้า";
    return "มุมด้านบนของสินค้า ให้เห็นรูปทรง วัสดุ ผิวสัมผัส และรายละเอียดที่ภาพหลักไม่เห็น";
  }
  if (normalizedShot === "พื้นรองเท้า") {
    return "พื้นรองเท้าแบบสินค้าเดี่ยว ให้เห็นลายพื้น ความหนา ส้น ขอบพื้น และรายละเอียดการยึดเกาะอย่างชัดเจน";
  }
  if (normalizedShot === "โคลสอัพจุดเด่น") {
    if (group === "upper_outerwear" || group === "long_outerwear") return "ภาพ extreme close-up เดี่ยวจากสินค้าชุดเดียวกับภาพหลัก ให้เห็นวัสดุ ซิป ขอบคอ ปลายแขน ซับใน ขนเฟอร์ งานเย็บ หรือตัวเลข/ข้อความเทคนิคจริงถ้ามี";
    return "ภาพ close-up เดี่ยวของวัสดุ พื้นผิว งานเย็บ ขอบ ซิป ป้ายจริง หรือดีเทลสำคัญของสินค้า";
  }
  if (normalizedShot === "ภาพใช้งานจริงแบบ lifestyle") {
    return "การใช้งานจริงของสินค้าในบริบทเมืองหนาว ให้เห็นสัดส่วน วิธีใช้ และให้ภาพแตกต่างจากภาพหลัก";
  }
  if (normalizedShot === "ช็อตโชว์วัสดุกันน้ำ") {
    return "ภาพ close-up เดี่ยวของวัสดุ พื้นผิว และโครงสร้างที่สื่อคุณสมบัติกันน้ำหรือกันหิมะ โดยยังยึดสินค้าจริงจากภาพต้นฉบับ";
  }
  return `${normalizedShot || "ภาพเสริมสินค้า"} ให้เห็นข้อมูลใหม่ที่ช่วยลูกค้าตัดสินใจ โดยไม่ซ้ำกับภาพหลัก`;
}

function resolveManualProductUseCaseGroup() {
  const category = String(els.category?.value || "").trim();
  const subtype = String(getSelectedSubtype()?.label || "").trim();
  const productName = String(selectedCatalogSku?.product_name || els.skuPickerSearch?.value || "").trim();
  const text = `${category} ${subtype} ${productName}`.toLowerCase();
  if (/รองเท้า|boot|บูท|shoe|sorel|snow boot/.test(text)) return "footwear";
  if (/ถุงมือ|glove/.test(text)) return "gloves";
  if (/หมวก|hat|beanie/.test(text)) return "hat";
  if (/ผ้าพันคอ|scarf|neck warmer/.test(text)) return "scarf_accessory";
  if (/ถุงเท้า|sock/.test(text)) return "socks";
  if (/พาร์กา|parka|long coat|เสื้อโค้ทยาว|โค้ทยาว/.test(text)) return "long_outerwear";
  if (/เสื้อ|jacket|coat|puffer|down|parka|sweater/.test(text)) return "upper_outerwear";
  if (/กางเกง|pants|trousers/.test(text)) return "pants";
  return "generic";
}

function getSupportShotInstruction(category, shot) {
  if (category === "รองเท้า / บูท" && shot === "ด้านข้าง") {
    return "Support shot role: footwear side styling view. Show the side silhouette, shaft height, boot opening, sole thickness, toe shape, and cuff/hem interaction clearly. Pair with one intentional winter lower-body layer such as leggings, skinny winter pants, fleece-lined jeans, ski pants, or opaque tights. Socks are optional and must be a neat thin cuff only, never thick slouch socks or leg warmers. No bare legs as the main styling.";
  }
  if (category === "รองเท้า / บูท" && shot === "มุมบน") {
    return "Support shot role: footwear top view. Show boot opening, laces/straps, upper material, toe shape, and how the winter bottom layer meets the boot. Keep the opening clean and readable. Avoid thick socks, vague fluffy hems, leg-warmer styling, or unidentified cropped fabric.";
  }
  if (category === "รองเท้า / บูท" && shot === "ภาพใช้งานจริงแบบ lifestyle") {
    return "Support shot role: footwear lifestyle usage. Create a practical lower-body winter outfit around the boots, using one clear cross-sell-friendly bottom layer such as fleece-lined leggings, winter skinny pants, fleece-lined jeans, quilted winter pants, ski pants, or winter skirt with opaque tights. Keep boots dominant. Socks may appear only as a clean subtle cuff, not a bulky styling feature.";
  }
  if (category === "ถุงเท้า" && shot === "ภาพใช้งานจริงแบบ lifestyle") {
    return "Support shot role: socks lifestyle usage. Show socks as the main product with a believable winter lower-body outfit: cropped pants, leggings, indoor slippers, or boots placed so the sock cuff and knit texture remain visible.";
  }
  if (category === "ถุงมือ" && shot === "ภาพใช้งานจริงแบบ lifestyle") {
    return "Support shot role: glove lifestyle usage. Show gloves being worn with a visible winter sleeve, coat cuff, knit cuff, or fleece sleeve. The glove-to-sleeve transition must look warm, practical, and intentional.";
  }
  if (shot === "โคลสอัพจุดเด่น" || /(close-up|โคลสอัพ)/i.test(shot)) {
    return "Support shot role: close-up detail. Crop tightly on the product feature, material, lining, logo patch, seam, zipper, outsole, or texture that helps customers decide. Do not show a full-body model.";
  }
  if (isInteriorSupportShot(shot)) {
    return "Support shot role: interior construction. Open or fold the product naturally to show lining, fleece, padding, fur, stitching, or inner material clearly without damaging product shape.";
  }
  if (shot === "พื้นรองเท้า") {
    return "Support shot role: footwear outsole. Product-only detail image showing the sole tread pattern, thickness, grip, and side profile clearly. No model legs needed.";
  }
  if (shot === "มุมบน") {
    return "Support shot role: top view. Show the product from a clean top angle while keeping recognizable shape, material, and all important details visible.";
  }
  if (shot === "ด้านในฝ่ามือ") {
    return "Support shot role: palm-side glove detail. Show the inner palm grip, lining, cuff, and finger construction clearly, with a natural hand/forearm crop only if needed.";
  }
  if (shot === "ภาพใช้งานจริงแบบ lifestyle") {
    return "Support shot role: realistic usage. Keep it clean enough for e-commerce, but show believable winter usage and cross-sell-friendly styling. The main product must stay visually dominant.";
  }
  if (shot === "ด้านหลัง") {
    return "Support shot role: back view. Rotate the product or model naturally to show the rear design, back seams, hood, heel, waistband, or back construction clearly.";
  }
  if (shot === "ด้านข้าง") {
    return "Support shot role: side view. Show the side silhouette, thickness, sole height, sleeve profile, garment length, or product depth clearly.";
  }
  if (shot === "ด้านหน้า") {
    return "Support shot role: front view. Keep the product front-facing, large, sharp, and useful as a secondary catalog angle.";
  }
  if (shot === "กางฮู้ด / ใส่ฮู้ด" || /(ฮู้ด|hood)/i.test(shot)) {
    return "Support shot role: hood detail. Show hood shape, fur trim, drawcord, collar relationship, and wearing fit clearly.";
  }
  return `Support shot role: ${shot}. Keep the crop and composition useful for customers comparing product details.`;
}

function isInteriorSupportShot(shot) {
  return shot === "เปิดให้เห็นด้านใน / ซับใน" || /(ซับใน|ซับขน|บุด้านใน|lining|interior)/i.test(shot || "");
}

function getSupportLabelSafetyRule(shot) {
  if (!isInteriorSupportShot(shot)) return "";
  return [
    "Interior label safety: this support shot is for lining, fleece, padding, inner fabric texture, seam construction, warmth technology, or hidden functional construction only.",
    "Do not invent, enlarge, relocate, or emphasize neck tags, care labels, wash labels, size labels, hang tags, brand labels, or random printed text.",
    "If an interior label is not clearly visible in the approved hero or product references, or if its exact physical position is uncertain, omit it.",
    "Never place a tag floating on the collar, center chest, sleeve, zipper area, or any incorrect inner panel. Texture and construction are more important than labels in this shot."
  ].join(" ");
}

function getSupportCropRule(category, shot) {
  const isDetailShot = /(close-up|โคลสอัพ|ซับใน|ซับขน|บุด้านใน|lining|interior|โลโก้|ป้าย|เฟอร์|fur)/i.test(shot);
  const isLifestyleShot = /lifestyle|ใช้งานจริง/i.test(shot);
  const isHoodShot = /(ฮู้ด|hood)/i.test(shot);
  const isStandardAngle = ["ด้านหน้า", "ด้านหลัง", "ด้านข้าง"].includes(shot);

  if (category === "เสื้อแจ็คเก็ต / เสื้อท่อนบน") {
    if (isDetailShot) {
      return "Support crop rule for upper-body jacket: use a tight upper-body/detail crop only. Do not show full body, full legs, shoes, or excess empty background.";
    }
    if (isHoodShot) {
      return "Support crop rule for upper-body jacket hood shot: crop from head to upper thigh or head to hip. Show hood, collar, shoulders, chest, sleeves, and jacket hem clearly. Do not show full body, shoes, or full legs.";
    }
    if (isStandardAngle) {
      return "Support crop rule for upper-body jacket angle shots: do NOT use full body. Crop from head/neck to upper thigh or hip, keeping the jacket large in frame. Show shoulders, sleeves, zipper, hood/collar, side thickness, and jacket hem clearly. Exclude shoes and most of the legs.";
    }
    if (!isLifestyleShot) {
      return "Support crop rule for upper-body jacket: product-detail catalog crop, not full-body styling. Keep the jacket large and readable.";
    }
  }

  if (category === "เสื้อโค้ทยาว / พาร์กา") {
    if (isDetailShot) {
      return "Support crop rule for long coat/parka detail shot: use a tight detail crop only. Do not show full body unless the detail requires coat length context.";
    }
    if (isHoodShot) {
      return "Support crop rule for long coat/parka hood shot: use head-to-knee or head-to-thigh crop. Show hood, collar, shoulders, chest, sleeves, and upper coat length clearly. Do not show shoes unless necessary.";
    }
    if (isStandardAngle) {
      return "Support crop rule for long coat/parka angle shots: use a nearly full-body catalog crop from head to ankle or head to mid-calf. The coat must fill most of the frame and show full coat length, hem, hood/collar, sleeves, and silhouette. Shoes are optional and must not become a styling focus. Avoid excessive empty background.";
    }
    if (!isLifestyleShot) {
      return "Support crop rule for long coat/parka: nearly full-body product crop by default, keeping the coat large and readable.";
    }
  }

  if (category === "รองเท้า / บูท") {
    if (/พื้นรองเท้า|outsole|sole|โคลสอัพ|close-up|โลโก้|ป้าย/i.test(shot)) {
      return "Support crop rule for footwear detail: product-only or extreme close-up crop is allowed. Focus on outsole, upper material, shaft, logo, lining, laces, or stitching. No full body and no distracting outfit styling.";
    }
    return "Support crop rule for footwear: lower-leg crop only, from just below the knee to the feet. Do not show full body or face. The boots/shoes should fill most of the frame. Always show one clear winter lower-body layer. Keep boot opening, shaft, logo band, laces/straps, and silhouette readable. Avoid bare legs, bulky socks, slouch socks, leg warmers, vague fuzzy hems, or cropped fabric that cannot be identified.";
  }

  if (category === "ถุงเท้า") {
    if (isDetailShot) {
      return "Support crop rule for socks detail: tight crop on cuff, knit texture, thickness, pattern, label, or seam. Socks must remain fully readable.";
    }
    return "Support crop rule for socks: lower-calf-to-feet crop only. Socks must be the largest visual subject. Use cropped winter pants, leggings, slippers, or boots only if they do not hide the sock cuff and texture.";
  }

  if (category === "ถุงมือ") {
    if (isDetailShot || shot === "ด้านในฝ่ามือ") {
      return "Support crop rule for gloves detail: tight hand/forearm crop. Show palm, fingers, cuff, grip, lining, label, stitching, or material texture clearly.";
    }
    return "Support crop rule for gloves: hands-and-forearms crop only. Do not show full body or face. A winter sleeve/cuff should meet the glove naturally so the arm does not look empty.";
  }

  if (category === "หมวก") {
    if (isDetailShot) {
      return "Support crop rule for hat detail: tight crop on knit texture, pom-pom, folded cuff, real logo/label/patch, lining, or shape. Keep product details large. If the approved hero shows a front label/logo/patch on the hat, keep it visible, readable, and placed on the same part of the hat.";
    }
    return "Support crop rule for hat: head-and-shoulders crop only. Include a coordinated winter collar, scarf, knit, or jacket shoulder detail, but keep the hat dominant. If the approved hero shows a logo/label/patch on the hat, the support shot should keep that mark visible unless the requested angle naturally hides that exact side.";
  }

  if (category === "กางเกง") {
    if (isDetailShot) {
      return "Support crop rule for pants detail: tight crop on waistband, pocket, seam, lining, fleece interior, hem, or fabric texture. No full body unless needed to explain fit.";
    }
    if (isStandardAngle) {
      return "Support crop rule for pants angle shots: waist-to-feet crop by default. Pants must fill most of the frame and show waistband, hips, leg shape, length, and hem. The upper layer may be visible only from lower chest/waist area and must be a clean winter top that frames the waistband. Do not show exposed stomach, crop tops, bras, bikini tops, or summer styling. Shoes are secondary and should match winter use.";
    }
  }

  if (category === "ผ้าพันคอ / อุปกรณ์ชิ้นเล็ก") {
    if (isDetailShot) {
      return "Support crop rule for scarf/accessory detail: tight crop on fabric, weave, edge, tassel, label, fold, or fastening detail.";
    }
    return "Support crop rule for scarf/accessory: crop only the body area needed to show how it is worn. Include a suitable coat, knit, or jacket collar, but keep the accessory visually dominant.";
  }

  return "";
}

function getAutoModelDirection(category) {
  if (category === "รองเท้า / บูท") return "เฉพาะขา/เท้า ไม่เห็นหน้า";
  if (category === "ถุงเท้า") return "เฉพาะขา/เท้า ไม่เห็นหน้า";
  if (category === "ถุงมือ") return "เฉพาะมือ/แขน ไม่เห็นหน้า";
  if (category === "หมวก") return "ผู้หญิงไทยวัยทำงาน ลุค influencer สดใส";
  return "ผู้หญิงไทยวัยทำงาน ลุค influencer สดใส";
}

function getCropDirection(category) {
  if (category === "รองเท้า / บูท") {
    return "Crop direction: lower-leg only, from just below the knee to the feet. Do not show the full body or face. Use one clear winter lower-body layer such as fleece-lined leggings, skinny winter pants, fleece-lined jeans, quilted winter pants, ski pants, or winter skirt with opaque tights. Do not show bare legs as the main styling. Socks are optional and must be subtle, thin, smooth, and secondary, peeking only 1-2 cm above the boot opening. Avoid bulky slouch socks or leg warmers. Boots/shoes must stay dominant.";
  }
  if (category === "ถุงเท้า") {
    return "Crop direction: lower-leg only, from lower calf to feet. Do not show the full body or face. Socks must be clearly visible, not hidden by pants or shoes. Any pants, slippers, or boots must frame the sock instead of covering it.";
  }
  if (category === "ถุงมือ") {
    return "Crop direction: hands and forearms only. Do not show the full body or face. Gloves must be clearly visible in a natural wearing pose with a coordinated winter sleeve or cuff.";
  }
  if (category === "หมวก") {
    return "Crop direction: head-and-shoulders only. The hat must be clear, centered, and flattering, with a cheerful influencer-like facial expression.";
  }
  if (category === "ผ้าพันคอ / อุปกรณ์ชิ้นเล็ก") {
    return "Crop direction: show only the head-to-torso or relevant body area needed to display the accessory clearly.";
  }
  if (category === "กางเกง") {
    return "Crop direction: waist-to-feet by default. Full body only if needed for hero styling. Pants should be the clear hero, with waistband, fit, length, pockets, and hem visible. If the upper body appears, crop from lower chest downward with no exposed stomach and no crop top.";
  }
  if (category === "เสื้อโค้ทยาว / พาร์กา") {
    return "Crop direction: for support images, prefer a nearly full-body crop from head to ankle or head to mid-calf. Keep the long coat/parka large in frame and avoid excess background.";
  }
  if (category === "เสื้อแจ็คเก็ต / เสื้อท่อนบน") {
    return "Crop direction: for support images, prefer an upper-body product crop from head/neck to hip or upper thigh, not full body. Keep jacket details large and readable.";
  }
  return "Crop direction: use the most useful catalog crop for this product category.";
}

function getHeroRule(category, mode) {
  const shared = "Hero image rules: the image must be the first selling image for the product page. It should communicate product type, color, silhouette, fit, material, and key feature within 2 seconds. Keep background clean, product large, lighting bright, and avoid distracting props.";
  if (mode === "Off-model") {
    return `${shared} For product-only hero, center the product, show the full product clearly, and leave clean margins for website cropping.`;
  }
  if (category === "รองเท้า / บูท") {
    return `${shared} For footwear hero on-model, show only lower legs and both shoes/boots clearly. Pair with a clear winter lower-body layer and avoid bare legs as the main styling. Keep boot opening, shaft, logo band, laces/straps, and silhouette cleanly visible. Socks should be minimal or omitted. The footwear should occupy the visual focus, not the model.`;
  }
  if (category === "ถุงเท้า") {
    return `${shared} For socks hero on-model, show only lower legs and feet. Socks should be the main visible product and should not be covered by shoes unless the shot is specifically lifestyle.`;
  }
  if (category === "ถุงมือ") {
    return `${shared} For gloves hero on-model, show only hands and forearms in a natural pose with a coordinated winter sleeve/cuff. Gloves should be the main visual focus.`;
  }
  if (category === "กางเกง") {
    return `${shared} For pants hero on-model, show waist-to-feet crop or full-body only if styling is needed. Pants should occupy most of the frame and clearly show fit, length, waistband, pockets, and hem. The visible top must be cold-weather appropriate and should frame the waistband without hiding it. No exposed midriff, crop top, bikini-like top, summer cardigan styling, or random fashion top.`;
  }
  if (category === "หมวก") {
    return `${shared} For hat hero on-model, use a head-and-shoulders crop with a bright cheerful expression. The hat must remain the main focus. Preserve any real front label, logo patch, woven tag, pom-pom, fold, cuff, or knit pattern visible in the product reference.`;
  }
  return `${shared} For on-model hero, use natural flattering posture with influencer-like freshness, but keep the product as the main reason to look.`;
}

function getLayeringRule(category, mode) {
  if (mode === "Off-model") {
    return "Winter styling context: keep the catalog clean. If complementary items are needed, use only subtle folded winter accessories as secondary context and never let them compete with the product.";
  }

  const shared = "Winter layering intelligence: style the outfit as a believable cold-weather look, not generic fashion. Add only complementary winter layers that match the main product by function, color, season, and silhouette. Supporting clothing must feel intentionally styled, premium, and useful for cold weather. Do not add random fashion items, summer items, bare legs, bare arms, or mismatched colors. The main product remains the hero.";

  if (category === "รองเท้า / บูท") {
    return `${shared} For footwear, legs must not look empty. Pair the boots with ONE clearly identifiable winter lower-body layer: fleece-lined leggings, skinny winter pants, fleece-lined jeans, quilted winter pants, ski pants, or a winter skirt with opaque tights. Prefer clean pant/legging/tights-to-boot styling over visible socks. If socks appear, they must be a subtle thin smooth cuff peeking only 1-2 cm above the boot opening; never use bulky slouch socks, leg warmers, or socks that cover the shaft/logo/opening. Show cuff/hem interaction naturally: pants tucked into boots, leggings disappearing cleanly into the boot, a pant cuff resting just above the shaft, or opaque tights under a winter skirt. Avoid bare legs, vague fluffy hems, random mini skirts, summer shorts, or fabric cropped so tightly that customers cannot tell what they are seeing.`;
  }

  if (category === "ถุงเท้า") {
    return `${shared} For socks, pair with cropped winter pants, fleece-lined leggings, pajama-style winter pants, indoor slippers, or boots only if the socks remain visible. Show the sock cuff, knit texture, thickness, and how it layers with footwear or pants. Avoid bare legs looking disconnected or shoes that hide the product.`;
  }

  if (category === "ถุงมือ") {
    return `${shared} For gloves, arms must not look empty. Pair gloves with a winter jacket sleeve, coat cuff, knit sweater cuff, fleece sleeve, or thermal sleeve that naturally meets the glove. The glove-to-sleeve transition should look warm and practical. Avoid bare forearms, summer tops, or sleeves that cover the glove details.`;
  }

  if (category === "หมวก") {
    return `${shared} For hats, pair with a winter coat collar, scarf, knit sweater, hoodie, or puffer jacket around the neck/shoulders so the headwear feels part of a complete cold-weather outfit. Keep the face fresh and cheerful, but avoid letting styling overpower the hat. Keep any real hat label/logo/patch visible when it appears on the hero/reference.`;
  }

  if (category === "ผ้าพันคอ / อุปกรณ์ชิ้นเล็ก") {
    return `${shared} For scarf and small accessories, pair with an appropriate coat, knit sweater, hoodie, or jacket collar so the accessory has a natural reason to be worn. Show drape, fold, knot, or wearing position clearly.`;
  }

  if (category === "กางเกง") {
    return `${shared} For pants, pair with a suitable upper winter layer that makes sense for the pants type: fitted thermal top tucked in, ribbed knit sweater front-tucked, fleece pullover, technical ski jacket, cropped puffer that ends above the waistband without exposing skin, softshell jacket, hoodie under jacket, or long coat opened enough to reveal the pants. The top must cover the stomach and look warm. Show waistband, hips, length, hem, pocket, and fabric behavior clearly. Avoid crop tops, exposed belly, bras, camisoles, summer cardigans, random fashion tops, or oversized tops that hide the waistband unless the requested feature is only lower-leg/hem. For ski pants specifically, use a technical winter styling system: fitted thermal base layer, fleece midlayer, ski jacket/softshell/puffer, gloves optional, and winter boots.`;
  }

  if (category === "เสื้อแจ็คเก็ต / เสื้อท่อนบน") {
    return `${shared} For jackets and upper-body apparel, include one correct inner layer chosen to match the jacket style: fine-gauge turtleneck, ribbed mock neck, thermal crewneck, hoodie, knit sweater, merino base layer, fleece pullover, or collared shirt layered with knit. Do not default to a plain white turtleneck every time. The inner layer should support product visibility, not cover zipper, pockets, lining, logo, or collar details. Pair with suitable pants and winter shoes only when the crop shows them.`;
  }

  if (category === "เสื้อโค้ทยาว / พาร์กา") {
    return `${shared} For long coats and parkas, include one correct visible inner layer chosen to match the coat: knit sweater, ribbed turtleneck, hoodie, thermal top, fleece pullover, lightweight down vest, or layered shirt-and-knit combination. Do not default to a plain white turtleneck every time. Add suitable winter pants and winter shoes. Keep the coat open or styled only if it helps show coat silhouette and layering clearly.`;
  }

  if (category === "ชุดกันหนาวเป็นเซ็ต") {
    return `${shared} For outfit sets, make all layers feel intentionally matched: outerwear, inner layer, pants, footwear, and accessories should form one coherent travel-ready winter look.`;
  }

  return shared;
}

function getStylingVariationRule(category, mode) {
  if (mode === "Off-model") {
    return "Styling variation rule: product-only images should stay clean and consistent. Do not add a full outfit. If a secondary winter item appears, it must be minimal, cropped, and clearly subordinate to the product.";
  }

  const shared =
    "Styling variation rule: do not repeat the same plain white turtleneck styling by default. Choose a coordinated winter palette from cream, ivory, charcoal, black, gray, navy, denim, camel, chocolate, burgundy, olive, or muted earth tones based on the product color. Styling should feel like an intentional travel-ready winter outfit for Thai customers preparing for cold-weather trips, not a random fashion look.";

  if (category === "เสื้อแจ็คเก็ต / เสื้อท่อนบน") {
    return `${shared} For upper-body jackets, rotate innerwear options across jobs: ribbed mock neck, thermal crewneck, fine-knit sweater, hoodie, fleece pullover, merino base layer, or shirt-and-knit layering. If the jacket is glossy or technical, use cleaner innerwear. If it is denim/sherpa/knit, use warmer textured layers. Keep the jacket collar, zipper, pockets, sleeves, hem, and logo readable.`;
  }

  if (category === "เสื้อโค้ทยาว / พาร์กา") {
    return `${shared} For long coats and parkas, use more complete winter styling: knit sweater with trousers, hoodie with slim pants, thermal top with fleece-lined jeans, lightweight vest under parka, or scarf plus clean inner layer. Keep coat length, front opening, hood, fur trim, pockets, and silhouette readable.`;
  }

  if (category === "กางเกง") {
    return `${shared} For pants, vary the upper layer according to pants style while keeping the waist area clean and professional: fitted thermal top tucked into ski pants, fleece pullover with ski pants, softshell jacket with waterproof pants, cropped puffer over a tucked knit with fleece-lined jeans, knit sweater with winter slacks, hoodie under a jacket with cargo winter pants, or long coat opened over slim pants. Footwear must match the pants hem and season. Never use exposed midriff, crop top, bikini-like top, bare waist, or summer styling.`;
  }

  if (category === "รองเท้า / บูท") {
    return `${shared} For boots and footwear, choose one clear styling system per image: leggings tucked into boots, fleece-lined jeans tucked/stacked cleanly, ski pants over boot shaft, quilted winter pants, or winter skirt with opaque tights. Default to clean lower-body layering, not sock styling. If socks are used, keep them thin, smooth, minimal, and subordinate to the boot. Avoid bare legs, unclear plush hems, chunky socks, slouch socks, leg warmers, or socks-only styling unless the shot is specifically about sock compatibility.`;
  }

  if (category === "ถุงเท้า") {
    return `${shared} For socks, use styling that frames the sock: cropped winter pants, rolled fleece-lined cuffs, leggings, indoor slippers, or boots positioned low enough to show cuff and knit. Socks should not disappear behind shoes or pants.`;
  }

  if (category === "ถุงมือ") {
    return `${shared} For gloves, vary sleeve pairings: puffer sleeve, wool coat cuff, ribbed knit cuff, fleece sleeve, parka sleeve, or thermal base layer. The glove must remain the focus and the cuff transition must look practical.`;
  }

  if (category === "หมวก") {
    return `${shared} For hats, vary neck/shoulder styling: scarf with coat collar, puffer collar, knit sweater, hoodie under jacket, or fleece collar. Keep the hat shape and any real label/logo/patch visible. Do not rotate the hat so far that the main product mark disappears unless the shot is specifically a back view.`;
  }

  if (category === "ผ้าพันคอ / อุปกรณ์ชิ้นเล็ก") {
    return `${shared} For scarf/accessory images, vary wearing method: wrapped once, loose drape, tucked into coat, folded over shoulder, or paired with knit and coat collar. Show the fabric texture and edge clearly.`;
  }

  if (category === "ชุดกันหนาวเป็นเซ็ต") {
    return `${shared} For outfit sets, coordinate all visible pieces as one complete cold-weather travel look. Use balanced layering from base layer to outerwear to accessories to footwear, with no single item feeling accidental.`;
  }

  return shared;
}

function getRisk(brand, feature) {
  if (brand && feature) return "medium: check logo + feature";
  if (brand) return "medium: check logo";
  if (feature) return "low: check feature";
  return "low";
}

function updateMeta(mode, category, risk) {
  els.promptMode.textContent = `รูปแบบ: ${mode}`;
  els.promptCategory.textContent = `หมวด: ${category}`;
  els.promptRisk.textContent = `จุดที่ต้องระวัง: ${risk}`;
}

function updateHeroStatus() {
  if (approvedHeroImageUrl) {
    els.heroStatus.textContent = isQcComplete() ? "ภาพหลักอนุมัติแล้ว · ตรวจครบ 7/7" : "ภาพหลักอนุมัติแล้ว · รอตรวจ";
    els.heroStatus.classList.toggle("ready", isQcComplete());
    return;
  }
  if (currentGeneratedImageUrl) {
    els.heroStatus.textContent = "รออนุมัติภาพหลัก";
    els.heroStatus.classList.remove("ready");
    return;
  }
  els.heroStatus.textContent = "ยังไม่มีภาพหลัก";
  els.heroStatus.classList.remove("ready");
}

function canGenerateStudioMaster() {
  return Boolean(approvedHeroImageUrl) && isQcComplete();
}

function renderStudioMasterPanel(message = "") {
  if (!els.studioMasterStatus) return;
  const hasCandidate = Boolean(currentStudioMasterImageUrl);
  const isApproved = Boolean(approvedStudioMasterImageUrl);
  els.studioMasterCard.hidden = !hasCandidate;
  els.studioMasterEmpty.hidden = hasCandidate;
  if (hasCandidate) {
    els.studioMasterImage.src = currentStudioMasterImageUrl;
    els.studioMasterImage.hidden = false;
  } else {
    els.studioMasterImage.removeAttribute("src");
  }
  if (message) els.studioMasterMessage.textContent = message;
  else if (isApproved) els.studioMasterMessage.textContent = "อนุมัติแล้ว ใช้เป็น anchor สำหรับภาพเสริม";
  else if (hasCandidate) els.studioMasterMessage.textContent = "รอตรวจ Studio Master";
  else els.studioMasterMessage.textContent = "อนุมัติภาพหลักและตรวจครบ 7/7 แล้วจึงสร้าง Studio Master";

  if (isApproved) {
    els.studioMasterStatus.textContent = "อนุมัติแล้ว";
  } else if (hasCandidate) {
    els.studioMasterStatus.textContent = "รอตรวจ";
  } else if (canGenerateStudioMaster()) {
    els.studioMasterStatus.textContent = "พร้อมสร้าง";
  } else {
    els.studioMasterStatus.textContent = "ยังไม่ได้สร้าง";
  }
  els.studioMasterStatus.classList.toggle("ready", isApproved);
}

function canGenerateSupport() {
  return Boolean(approvedHeroImageUrl) && Boolean(approvedStudioMasterImageUrl) && isQcComplete();
}

function updateWorkflowGate() {
  const ready = canGenerateSupport();
  const hasSession = Boolean(currentSession?.access_token);
  const isLoggedIn = isAppReady();
  const studioReady = canGenerateStudioMaster();
  els.generateStudioMasterButton.disabled = !studioReady || !isLoggedIn;
  els.rerunStudioMasterButton.disabled = !studioReady || !isLoggedIn || !currentStudioMasterImageUrl;
  els.approveStudioMasterButton.disabled = !isLoggedIn || !currentStudioMasterImageUrl || Boolean(approvedStudioMasterImageUrl);
  els.generateSupportButton.disabled = !ready || !isLoggedIn;
  els.approveSupportButton.disabled = !supportResults.some((item) => item.imageUrl && item.status === "done");
  els.supportStatus.textContent = ready ? "พร้อมทำภาพเสริม" : "ล็อกอยู่";
  els.supportStatus.classList.toggle("ready", ready);
  els.generateSupportButton.title = ready
    ? isLoggedIn
      ? "พร้อมสร้างภาพเสริม"
      : hasSession
        ? "กรุณาตั้งรหัสผ่านใหม่ก่อนสร้างภาพเสริม"
        : "กรุณาเข้าสู่ระบบก่อนสร้างภาพเสริม"
    : approvedHeroImageUrl && isQcComplete()
      ? "ต้องสร้างและอนุมัติ Studio Master ก่อนสร้างภาพเสริม"
      : "ต้องอนุมัติภาพหลักและตรวจครบ 7/7 ก่อน";
  updateHeroStatus();
  renderStudioMasterPanel();
}

function renderSupportShots() {
  const shots = getDynamicSupportShots();
  els.supportShotList.innerHTML = shots
    .map(
      (shot, index) => `
        <label class="support-shot-item">
          <input type="checkbox" value="${escapeHtml(shot)}" ${index < 4 || customSupportShots.includes(shot) ? "checked" : ""}>
          <span>${escapeHtml(shot)}</span>
        </label>
      `
    )
    .join("");
}

function getDynamicSupportShots() {
  const baseShots = supportShotPresets[els.category.value] || ["ด้านหน้า", "ด้านข้าง", "โคลสอัพจุดเด่น"];
  const subtype = getSelectedSubtype();
  const text = `${els.keyFeature.value || ""} ${els.notes.value || ""} ${els.shotType.value || ""} ${subtype.label || ""} ${subtype.rule || ""}`.toLowerCase();
  const shots = [...baseShots];
  const add = (shot) => {
    if (!shots.includes(shot)) shots.push(shot);
  };

  getSubtypeSupportShots(subtype.value).forEach(add);

  if (/(ฮู้ด|hood)/i.test(text) && ["เสื้อโค้ทยาว / พาร์กา", "เสื้อแจ็คเก็ต / เสื้อท่อนบน"].includes(els.category.value)) {
    add("กางฮู้ด / ใส่ฮู้ด");
  }
  if (/(เฟอร์|fur)/i.test(text)) {
    add("close-up ขอบเฟอร์");
  }
  if (/(บุขน|ซับขน|ซับใน|fleece|sherpa|lining)/i.test(text)) {
    add("close-up ซับขน / บุด้านใน");
  }
  if (/(กันน้ำ|waterproof|water resistant)/i.test(text)) {
    add("ช็อตโชว์วัสดุกันน้ำ");
  }
  if (/(พื้น|sole|outsole|grip|กันลื่น)/i.test(text) && els.category.value === "รองเท้า / บูท") {
    add("พื้นรองเท้า");
  }
  if (/(โลโก้|logo|patch|ป้าย)/i.test(text)) {
    add("close-up โลโก้ / ป้ายแบรนด์");
  }

  customSupportShots.forEach(add);
  return shots;
}

function getSubtypeSupportShots(subtypeValue) {
  const map = {
    "fur-parka": ["กางฮู้ด / ใส่ฮู้ด", "close-up ขอบเฟอร์"],
    "long-padded-coat": ["ด้านข้าง", "โคลสอัพผ้าพัฟ / quilting", "close-up ซิป / กระเป๋า"],
    "ski-parka": ["ช็อตโชว์วัสดุกันน้ำ", "close-up ซิป / กระเป๋า"],
    "puffer-jacket": ["โคลสอัพผ้าพัฟ / quilting", "close-up ซิป / กระเป๋า"],
    "cropped-puffer-jacket": ["ด้านข้าง", "โคลสอัพผ้าพัฟ / quilting", "close-up ชายเสื้อ / cuffs"],
    "light-down": ["โคลสอัพผ้าพัฟ / quilting"],
    "fleece-jacket": ["close-up เนื้อผ้าฟลีซ"],
    "softshell-jacket": ["ช็อตโชว์วัสดุกันน้ำ", "close-up ซิป / กระเป๋า"],
    "denim-sherpa": ["close-up ซับขน / บุด้านใน", "เปิดให้เห็นด้านใน / ซับใน"],
    "hoodie-jacket": ["กางฮู้ด / ใส่ฮู้ด"],
    "knit-sweater": ["close-up เนื้อผ้า / ลายถัก", "ด้านข้าง"],
    "turtleneck-sweater": ["close-up คอเสื้อ / ลายถัก", "ด้านข้าง"],
    "thermal-base-layer-top": ["close-up เนื้อผ้า / ความยืด", "ช็อตโชว์การใส่เป็น base layer"],
    "long-john-top": ["close-up เนื้อผ้า / ความยืด", "ช็อตโชว์การใส่เป็น base layer"],
    "down-vest": ["ด้านข้าง", "โคลสอัพผ้าพัฟ / quilting"],
    "ski-pants": ["ช็อตโชว์ปลายขากับบูท", "ช็อตโชว์วัสดุกันน้ำ"],
    "waterproof-pants": ["ช็อตโชว์ปลายขากับบูท", "ช็อตโชว์วัสดุกันน้ำ"],
    "fleece-lined-jeans": ["close-up ซับขน / บุด้านใน", "ช็อตโชว์ปลายขากับบูท"],
    "thermal-leggings": ["close-up เนื้อผ้า / ความยืด", "ช็อตโชว์ปลายขากับบูท"],
    "skinny-winter-pants": ["ช็อตโชว์ปลายขากับบูท"],
    "wide-leg-winter-pants": ["ช็อตโชว์ทรงขา / ชายกางเกง"],
    "winter-cargo-pants": ["close-up กระเป๋า / ตะเข็บ", "ช็อตโชว์ปลายขากับบูท"],
    "thermal-base-layer-bottoms": ["close-up เนื้อผ้า / ความยืด", "ช็อตโชว์การใส่เป็น base layer"],
    "long-john-bottoms": ["close-up เนื้อผ้า / ความยืด", "ช็อตโชว์การใส่เป็น base layer"],
    "knit-pants": ["close-up เนื้อผ้า / ลายถัก", "ช็อตโชว์ทรงขา / ชายกางเกง"],
    "winter-slacks": ["close-up เนื้อผ้า / จีบกางเกง", "ช็อตโชว์ทรงขา / ชายกางเกง"],
    "snow-boots": ["พื้นรองเท้า", "close-up วัสดุด้านบน / เชือก"],
    "ankle-boots": ["พื้นรองเท้า", "close-up วัสดุ / ขอบข้อเท้า"],
    "mid-calf-boots": ["พื้นรองเท้า", "close-up shaft / ขอบบูท"],
    "knee-high-boots": ["ด้านข้าง", "close-up shaft / ขอบบูท"],
    "high-heel-boots": ["ด้านข้าง", "close-up ส้นรองเท้า / หัวรองเท้า"],
    "platform-boots": ["ด้านข้าง", "close-up พื้นแพลตฟอร์ม"],
    "fur-lined-boots": ["close-up ซับขน / บุด้านใน", "พื้นรองเท้า"],
    "waterproof-boots": ["ช็อตโชว์วัสดุกันน้ำ", "พื้นรองเท้า"],
    "hiking-winter-boots": ["พื้นรองเท้า", "close-up เชือก / หัวรองเท้า"],
    "winter-sneakers": ["พื้นรองเท้า", "close-up วัสดุ / เชือก"],
    "wool-socks": ["close-up เนื้อผ้า / ลายถัก"],
    "fleece-lined-socks": ["close-up ซับขน / บุด้านใน"],
    "long-winter-socks": ["ช็อตโชว์ความยาวถุงเท้า"],
    "ski-gloves": ["ด้านในฝ่ามือ", "close-up สายรัดข้อมือ / กันน้ำ"],
    "knit-gloves": ["close-up เนื้อผ้า / ลายถัก"],
    "leather-windproof-gloves": ["ด้านในฝ่ามือ", "close-up วัสดุหนัง / ตะเข็บ"],
    "pom-beanie": ["close-up ปอมปอม / ลายถัก"],
    "knit-beanie": ["close-up เนื้อผ้า / ป้ายแบรนด์"],
    "fur-bucket-hat": ["close-up ขนเฟอร์ / ขอบหมวก"],
    "knit-scarf": ["close-up เนื้อผ้า / ชายผ้า"],
    "faux-fur-scarf": ["close-up ขนเฟอร์ / texture"],
    "earmuffs": ["ด้านข้าง", "close-up ขนเฟอร์ / ที่ครอบหู"],
    "ski-set": ["ด้านหลัง", "ช็อตโชว์วัสดุกันน้ำ", "close-up จุดเด่น"],
    "travel-set": ["ด้านหลัง", "โคลสอัพจุดเด่น"],
    "kids-set": ["ด้านหลัง", "โคลสอัพจุดเด่น"]
  };
  return map[subtypeValue] || [];
}

function addCustomSupportShot() {
  const shot = els.customSupportShot.value.trim();
  if (!shot) return;
  if (!customSupportShots.includes(shot)) customSupportShots.push(shot);
  els.customSupportShot.value = "";
  renderSupportShots();
}

function getSelectedSupportShots() {
  return Array.from(els.supportShotList.querySelectorAll("input:checked")).map((input) => input.value);
}

function renderSupportGallery() {
  updateWorkflowGate();
  if (!supportResults.length) {
    els.supportGallery.innerHTML = '<p class="empty-state">ยังไม่มีภาพเสริม</p>';
    return;
  }

  els.supportGallery.innerHTML = supportResults
    .map((item, index) => {
      const image = item.imageUrl
        ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.shot)} support shot">`
        : `<div class="support-placeholder">${escapeHtml(item.status)}</div>`;
      const isBusy = String(item.status || "").includes("generating") || String(item.status || "").startsWith("rerun:");
      return `
        <article class="support-card">
          ${image}
          <div class="support-card-header">
            <strong>${escapeHtml(item.shot)}</strong>
            <button class="ghost-button compact support-rerun-button" type="button" data-rerun-support="${index}" ${isBusy ? "disabled" : ""} title="Generate ภาพนี้ใหม่โดยใช้ Hero เดิมเป็น reference">Rerun</button>
          </div>
          <span>${escapeHtml(item.status)}${item.requestId ? ` · ${escapeHtml(item.requestId)}` : ""}</span>
        </article>
      `;
    })
    .join("");
}

function getApprovalMessage(data) {
  if (data.googleDriveFile?.webViewLink) {
    return `อนุมัติแล้ว และอัปโหลดเข้า Google Drive API${data.googleDriveFile.skuMatched ? " ตามโฟลเดอร์ SKU" : ""}: ${data.googleDriveFile.webViewLink}`;
  }
  if (data.drivePath) {
    return `อนุมัติแล้ว และบันทึกเข้าโฟลเดอร์ Drive sync${data.skuMatched ? " ตามโฟลเดอร์ SKU" : ""}: ${data.drivePath}`;
  }
  if (data.localDeleted) {
    return "อนุมัติแล้ว และลบไฟล์ในเครื่องหลังส่งออกสำเร็จ";
  }
  return `อนุมัติแล้ว บันทึกที่: ${data.approvedPath}`;
}

function renderSupportMessage(message) {
  els.supportGallery.innerHTML = `<p class="empty-state">${escapeHtml(message)}</p>`;
}

function renderAssets() {
  const assets = latestAssetsData?.assets || [];
  const totalAssets = latestAssetsData?.pagination?.totalItems || assets.length;
  els.assetStatus.textContent = totalAssets ? `${formatThaiNumber(totalAssets)} ภาพ` : "รอภาพ";
  els.assetStatus.classList.toggle("ready", assets.length > 0);

  if (!assets.length) {
    els.assetGallery.innerHTML = '<p class="empty-state">ยังไม่มีภาพในช่วงเวลานี้</p>';
    renderProductionPagination("assets", latestAssetsData?.pagination);
    return;
  }

  els.assetGallery.innerHTML = assets
    .map(renderProductionAssetCard)
    .join("");
  renderProductionPagination("assets", latestAssetsData?.pagination);
}

function renderSettingsPreview() {
  els.brandSettingsPreview.innerHTML = Object.values(brandProfiles)
    .map(
      (profile) => `
        <div class="settings-row">
          <strong>${escapeHtml(profile.shortName)}</strong>
          <span>${profile.forceOffModel ? "Product-only" : "On-model allowed"}</span>
        </div>
      `
    )
    .join("");

  els.promptSettingsPreview.innerHTML = `
    <div class="settings-row"><strong>${Object.keys(categories).length}</strong><span>หมวดสินค้า</span></div>
    <div class="settings-row"><strong>${Object.values(productSubtypes).reduce((sum, items) => sum + items.length, 0)}</strong><span>ประเภทย่อย</span></div>
    <div class="settings-row"><strong>${modelProfiles.length}</strong><span>กลุ่มโมเดล</span></div>
    <div class="settings-row"><strong>${imageSizeOptions.length}</strong><span>ขนาดภาพ</span></div>
  `;
}

async function refreshGoogleDriveStatus() {
  if (!isAdmin()) return;

  els.googleDriveIntegrationSection.hidden = false;
  els.googleDriveStatusPill.textContent = "กำลังตรวจสอบ";
  els.googleDriveStatusPill.classList.remove("ready");
  els.googleDriveStatusText.textContent = "กำลังตรวจสอบสถานะ Google Drive...";
  els.googleDriveConnectButton.disabled = true;

  try {
    const response = await authFetch("/api/google/oauth/status");
    const data = await readJsonResponse(response, "โหลดสถานะ Google Drive ไม่สำเร็จ");
    if (!response.ok || !data.ok) throw new Error(data.error || "โหลดสถานะ Google Drive ไม่สำเร็จ");

    if (!data.configured) {
      els.googleDriveStatusPill.textContent = "ยังไม่พร้อม";
      els.googleDriveStatusText.textContent = "ยังไม่ได้ตั้งค่า Google OAuth บน server";
      els.googleDriveConnectButton.textContent = "เชื่อมต่อ Google Drive";
      els.googleDriveConnectButton.disabled = true;
      return;
    }

    if (data.connected) {
      els.googleDriveStatusPill.textContent = "เชื่อมต่อแล้ว";
      els.googleDriveStatusPill.classList.add("ready");
      els.googleDriveStatusText.textContent = `Google Drive พร้อมใช้งาน${data.updatedAt ? ` · อัปเดตล่าสุด ${formatJobTime(data.updatedAt)}` : ""}`;
      els.googleDriveConnectButton.textContent = "เชื่อมต่อใหม่";
    } else {
      els.googleDriveStatusPill.textContent = "ยังไม่เชื่อมต่อ";
      els.googleDriveStatusText.textContent = data.tokenError || "Google Drive ยังไม่ได้เชื่อมต่อ กรุณาให้ Admin เชื่อมต่อก่อน";
      els.googleDriveConnectButton.textContent = "เชื่อมต่อ Google Drive";
    }
    els.googleDriveConnectButton.disabled = false;
  } catch (error) {
    els.googleDriveStatusPill.textContent = "ตรวจสอบไม่ได้";
    els.googleDriveStatusText.textContent = getSafeAuthErrorMessage(error);
    els.googleDriveConnectButton.disabled = false;
  }
}

async function connectGoogleDrive() {
  if (!isAdmin()) return;

  els.googleDriveConnectButton.disabled = true;
  els.googleDriveConnectButton.textContent = "กำลังเปิด Google...";
  els.googleDriveStatusText.textContent = "กำลังเตรียมลิงก์เชื่อมต่อ Google Drive...";

  try {
    const response = await authFetch("/api/google/oauth/start");
    const data = await readJsonResponse(response, "เปิดลิงก์เชื่อมต่อ Google Drive ไม่สำเร็จ");
    if (!response.ok || !data.ok || !data.authUrl) {
      throw new Error(data.error || "เปิดลิงก์เชื่อมต่อ Google Drive ไม่สำเร็จ");
    }
    window.location.href = data.authUrl;
  } catch (error) {
    els.googleDriveStatusText.textContent = getSafeAuthErrorMessage(error);
    els.googleDriveConnectButton.disabled = false;
    els.googleDriveConnectButton.textContent = "เชื่อมต่อ Google Drive";
  }
}

async function refreshStaffUsers() {
  if (!isAdmin() || !els.staffManagementSection) return;

  els.staffManagementSection.hidden = false;
  setStaffLoading(true);
  setStaffError("");

  try {
    const response = await authFetch("/api/admin/users");
    const data = await readJsonResponse(response, "โหลดรายชื่อผู้ใช้งานไม่สำเร็จ");
    if (!response.ok || !data.ok) throw new Error(data.error || "โหลดรายชื่อผู้ใช้งานไม่สำเร็จ");
    latestStaffUsers = Array.isArray(data.users) ? data.users : [];
    renderStaffUsers();
  } catch (error) {
    setStaffError(`โหลดรายชื่อผู้ใช้งานไม่สำเร็จ: ${getSafeAuthErrorMessage(error)}`);
    latestStaffUsers = [];
    renderStaffUsers();
  } finally {
    setStaffLoading(false);
  }
}

function setStaffLoading(isLoading) {
  els.staffLoadingState.hidden = !isLoading;
  els.refreshStaffButton.disabled = isLoading;
}

function setStaffError(message) {
  els.staffErrorState.hidden = !message;
  els.staffErrorState.textContent = message || "โหลดรายชื่อผู้ใช้งานไม่สำเร็จ";
}

function setStaffSuccess(message) {
  els.staffSuccessState.hidden = !message;
  els.staffSuccessState.textContent = message || "สร้างผู้ใช้งานสำเร็จ";
  if (message) {
    setTimeout(() => {
      if (els.staffSuccessState.textContent === message) els.staffSuccessState.hidden = true;
    }, 4000);
  }
}

function openCreateStaffModal() {
  if (!isAdmin()) return;
  clearCreateStaffError();
  els.createStaffModal.hidden = false;
  document.body.classList.add("modal-open");
  setTimeout(() => els.createStaffEmail.focus(), 0);
}

function closeCreateStaffModal() {
  els.createStaffModal.hidden = true;
  document.body.classList.remove("modal-open");
  setCreateStaffLoading(false);
  clearCreateStaffError();
  els.createStaffPassword.value = "";
  els.createStaffConfirmPassword.value = "";
}

function resetCreateStaffForm() {
  els.createStaffForm.reset();
  els.createStaffRole.value = "staff";
  els.createStaffIsActive.checked = true;
  els.createStaffMustChangePassword.checked = true;
  els.createStaffPassword.value = "";
  els.createStaffConfirmPassword.value = "";
}

function setCreateStaffLoading(isLoading) {
  els.createStaffSubmitButton.disabled = isLoading;
  els.closeCreateStaffButton.disabled = isLoading;
  els.cancelCreateStaffButton.disabled = isLoading;
  els.createStaffSubmitButton.textContent = isLoading ? "กำลังสร้าง..." : "สร้างผู้ใช้งาน";
}

function setCreateStaffError(message) {
  els.createStaffError.hidden = !message;
  els.createStaffError.textContent = message || "สร้างผู้ใช้งานไม่สำเร็จ";
}

function clearCreateStaffError() {
  setCreateStaffError("");
}

async function handleCreateStaffSubmit(event) {
  event.preventDefault();
  if (!isAdmin() || createStaffInProgress) return;

  clearCreateStaffError();
  setStaffSuccess("");

  const payload = {
    full_name: els.createStaffFullName.value.trim(),
    email: els.createStaffEmail.value.trim(),
    role: els.createStaffRole.value,
    temporary_password: els.createStaffPassword.value,
    confirm_temporary_password: els.createStaffConfirmPassword.value,
    is_active: els.createStaffIsActive.checked,
    must_change_password: els.createStaffMustChangePassword.checked
  };

  const validationMessage = validateCreateStaffPayload(payload);
  if (validationMessage) {
    setCreateStaffError(validationMessage);
    return;
  }

  if (payload.role === "admin" && !window.confirm(`ยืนยันสร้างบัญชี admin สำหรับ ${payload.email}?`)) {
    return;
  }

  try {
    createStaffInProgress = true;
    setCreateStaffLoading(true);
    const response = await authFetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await readJsonResponse(response, "สร้างผู้ใช้งานไม่สำเร็จ");
    if (!response.ok || !data.ok) throw new Error(data.error || "สร้างผู้ใช้งานไม่สำเร็จ");

    resetCreateStaffForm();
    closeCreateStaffModal();
    setStaffSuccess(`สร้างผู้ใช้งาน ${data.user?.email || payload.email} สำเร็จ`);
    await refreshStaffUsers();
  } catch (error) {
    els.createStaffPassword.value = "";
    els.createStaffConfirmPassword.value = "";
    setCreateStaffError(`สร้างผู้ใช้งานไม่สำเร็จ: ${getSafeAuthErrorMessage(error)}`);
  } finally {
    createStaffInProgress = false;
    setCreateStaffLoading(false);
  }
}

function validateCreateStaffPayload(payload) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return "อีเมลไม่ถูกต้อง";
  if (!["admin", "staff"].includes(payload.role)) return "Role ต้องเป็น admin หรือ staff เท่านั้น";
  if (payload.temporary_password.length < 8) return "Temporary password ต้องมีอย่างน้อย 8 ตัวอักษร";
  if (payload.temporary_password !== payload.confirm_temporary_password) return "Temporary password และ confirm password ไม่ตรงกัน";
  return "";
}

function openResetPasswordModal(user) {
  if (!isAdmin() || !user) return;
  resetPasswordTargetUser = user;
  clearResetPasswordError();
  els.resetPasswordUserLabel.value = `${user.full_name || "ยังไม่ได้ใส่ชื่อ"} · ${user.email || "-"}`;
  els.resetPasswordStatusLabel.value = `${user.is_active ? "active" : "inactive"} · ${user.role || "staff"}`;
  els.resetPasswordInactiveNote.hidden = user.is_active !== false;
  els.resetPasswordMustChange.checked = true;
  els.resetPasswordValue.value = "";
  els.resetPasswordConfirmValue.value = "";
  els.resetPasswordModal.hidden = false;
  document.body.classList.add("modal-open");
  setTimeout(() => els.resetPasswordValue.focus(), 0);
}

function closeResetPasswordModal() {
  els.resetPasswordModal.hidden = true;
  document.body.classList.remove("modal-open");
  setResetPasswordLoading(false);
  clearResetPasswordError();
  resetPasswordTargetUser = null;
  els.resetPasswordValue.value = "";
  els.resetPasswordConfirmValue.value = "";
}

function setResetPasswordLoading(isLoading) {
  els.resetPasswordSubmitButton.disabled = isLoading;
  els.closeResetPasswordButton.disabled = isLoading;
  els.cancelResetPasswordButton.disabled = isLoading;
  els.resetPasswordSubmitButton.textContent = isLoading ? "กำลังรีเซ็ต..." : "รีเซ็ตรหัสผ่าน";
}

function setResetPasswordError(message) {
  els.resetPasswordError.hidden = !message;
  els.resetPasswordError.textContent = message || "รีเซ็ตรหัสผ่านไม่สำเร็จ";
}

function clearResetPasswordError() {
  setResetPasswordError("");
}

async function handleResetPasswordSubmit(event) {
  event.preventDefault();
  if (!isAdmin() || !resetPasswordTargetUser || resetPasswordInProgress) return;

  clearResetPasswordError();
  setStaffSuccess("");

  const temporaryPassword = els.resetPasswordValue.value;
  const confirmPassword = els.resetPasswordConfirmValue.value;
  const validationMessage = validateResetPasswordPayload(temporaryPassword, confirmPassword);
  if (validationMessage) {
    setResetPasswordError(validationMessage);
    return;
  }

  if (currentProfile?.id === resetPasswordTargetUser.id && !window.confirm("คุณกำลังรีเซ็ตรหัสผ่านบัญชี admin ของตัวเอง ยืนยันดำเนินการต่อ?")) {
    return;
  }

  try {
    resetPasswordInProgress = true;
    setResetPasswordLoading(true);
    const response = await authFetch(`/api/admin/users/${encodeURIComponent(resetPasswordTargetUser.id)}/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ temporaryPassword })
    });
    const data = await readJsonResponse(response, "รีเซ็ตรหัสผ่านไม่สำเร็จ");
    if (!response.ok || !data.ok) throw new Error(data.error || "รีเซ็ตรหัสผ่านไม่สำเร็จ");

    els.resetPasswordValue.value = "";
    els.resetPasswordConfirmValue.value = "";
    closeResetPasswordModal();
    setStaffSuccess("รีเซ็ตรหัสผ่านชั่วคราวสำเร็จ");
    await refreshStaffUsers();
  } catch (error) {
    els.resetPasswordValue.value = "";
    els.resetPasswordConfirmValue.value = "";
    setResetPasswordError(`รีเซ็ตรหัสผ่านไม่สำเร็จ: ${getSafeAuthErrorMessage(error)}`);
  } finally {
    resetPasswordInProgress = false;
    setResetPasswordLoading(false);
  }
}

function validateResetPasswordPayload(password, confirmPassword) {
  if (!password) return "กรุณาใส่ temporary password";
  if (password.length < 8) return "Temporary password ต้องมีอย่างน้อย 8 ตัวอักษร";
  if (password !== confirmPassword) return "Temporary password และ confirm password ไม่ตรงกัน";
  return "";
}

function renderStaffUsers() {
  if (!els.staffAdminList) return;

  const users = getFilteredStaffUsers();
  els.staffEmptyState.hidden = users.length > 0 || Boolean(latestStaffUsers.length);

  if (!users.length) {
    els.staffAdminList.innerHTML = latestStaffUsers.length
      ? '<div class="empty-state">ไม่พบผู้ใช้งานตาม filter นี้</div>'
      : "";
    return;
  }

  els.staffAdminList.innerHTML = users.map(renderStaffUserCard).join("");
}

function getFilteredStaffUsers() {
  const query = els.staffSearch.value.trim().toLowerCase();
  const role = els.staffRoleFilter.value;
  const status = els.staffStatusFilter.value;
  const password = els.staffPasswordFilter.value;

  return latestStaffUsers.filter((user) => {
    const text = `${user.full_name || ""} ${user.email || ""}`.toLowerCase();
    const queryMatch = !query || text.includes(query);
    const roleMatch = !role || user.role === role;
    const statusMatch = !status || (status === "active" ? user.is_active === true : user.is_active === false);
    const passwordMatch = !password || (password === "yes" ? user.must_change_password === true : user.must_change_password !== true);
    return queryMatch && roleMatch && statusMatch && passwordMatch;
  });
}

function renderStaffUserCard(user) {
  const updating = staffUpdateInProgress.has(user.id);
  const isSelf = currentProfile?.id === user.id;
  return `
    <article class="staff-admin-card" data-user-id="${escapeHtml(user.id)}">
      <div class="staff-admin-main">
        <div>
          <strong>${escapeHtml(user.full_name || "ยังไม่ได้ใส่ชื่อ")}</strong>
          <span>${escapeHtml(user.email || "-")}${isSelf ? " · บัญชีของคุณ" : ""}</span>
        </div>
        <div class="staff-badges">
          <span class="role ${escapeHtml(user.role)}">${escapeHtml(user.role)}</span>
          <span class="${user.is_active ? "active" : "inactive"}">${user.is_active ? "active" : "inactive"}</span>
          <span class="${user.must_change_password ? "password-required" : "normal"}">${user.must_change_password ? "password required" : "normal"}</span>
        </div>
      </div>
      <div class="staff-admin-meta">
        <span>สร้างเมื่อ ${escapeHtml(formatJobTime(user.created_at))}</span>
        <span>ล่าสุด ${escapeHtml(formatLatestStaffActivity(user.latest_activity))}</span>
      </div>
      <div class="staff-admin-controls">
        <label>
          ชื่อพนักงาน
          <input type="text" data-staff-field="full_name" value="${escapeHtml(user.full_name || "")}" ${updating ? "disabled" : ""} />
        </label>
        <button class="ghost-button compact" type="button" data-staff-action="save-name" ${updating ? "disabled" : ""}>บันทึกชื่อ</button>
        <button class="ghost-button compact" type="button" data-staff-action="reset-password" ${updating ? "disabled" : ""}>Reset Password</button>
        <label>
          Role
          <select data-staff-field="role" ${updating ? "disabled" : ""}>
            <option value="staff" ${user.role === "staff" ? "selected" : ""}>staff</option>
            <option value="admin" ${user.role === "admin" ? "selected" : ""}>admin</option>
          </select>
        </label>
        <label class="staff-toggle">
          <input type="checkbox" data-staff-field="is_active" ${user.is_active ? "checked" : ""} ${updating ? "disabled" : ""} />
          <span>เปิดใช้งาน</span>
        </label>
        <label class="staff-toggle">
          <input type="checkbox" data-staff-field="must_change_password" ${user.must_change_password ? "checked" : ""} ${updating ? "disabled" : ""} />
          <span>บังคับเปลี่ยนรหัส</span>
        </label>
      </div>
      ${updating ? '<div class="staff-admin-saving">กำลังบันทึก...</div>' : ""}
    </article>
  `;
}

function formatLatestStaffActivity(activity) {
  if (!activity?.at) return "ยังไม่มีข้อมูล";
  return `${formatJobTime(activity.at)}${activity.type ? ` · ${activity.type}` : ""}`;
}

async function handleStaffFieldChange(event) {
  const field = event.target.dataset.staffField;
  if (!field || field === "full_name") return;
  const card = event.target.closest("[data-user-id]");
  if (!card) return;

  const user = latestStaffUsers.find((item) => item.id === card.dataset.userId);
  if (!user) return;

  const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
  const confirmed = confirmStaffRiskyChange(user, field, value);
  if (!confirmed) {
    renderStaffUsers();
    return;
  }

  await updateStaffUser(user.id, { [field]: value });
}

async function handleStaffListClick(event) {
  const button = event.target.closest("[data-staff-action]");
  if (!button) return;

  const card = button.closest("[data-user-id]");
  if (!card) return;
  const userId = card.dataset.userId;
  const nameInput = card.querySelector('[data-staff-field="full_name"]');
  const user = latestStaffUsers.find((item) => item.id === userId);
  if (!user) return;

  if (button.dataset.staffAction === "reset-password") {
    openResetPasswordModal(user);
    return;
  }

  if (!nameInput) return;

  const fullName = nameInput.value.trim();
  if (fullName === (user.full_name || "")) return;
  await updateStaffUser(userId, { full_name: fullName });
}

function confirmStaffRiskyChange(user, field, value) {
  const label = user.email || user.full_name || "ผู้ใช้นี้";
  if (field === "is_active" && value === false) {
    return window.confirm(`ยืนยันปิดใช้งานบัญชี ${label}? ผู้ใช้นี้จะเข้าใช้งาน workflow ไม่ได้`);
  }
  if (field === "role" && user.role === "admin" && value === "staff") {
    return window.confirm(`ยืนยันเปลี่ยน ${label} จาก admin เป็น staff?`);
  }
  if (field === "role" && user.role !== "admin" && value === "admin") {
    return window.confirm(`ยืนยันให้สิทธิ์ admin กับ ${label}?`);
  }
  return true;
}

async function updateStaffUser(userId, patch) {
  if (staffUpdateInProgress.has(userId)) return;
  staffUpdateInProgress.add(userId);
  setStaffError("");
  renderStaffUsers();

  try {
    const response = await authFetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const data = await readJsonResponse(response, "อัปเดตผู้ใช้งานไม่สำเร็จ");
    if (!response.ok || !data.ok) throw new Error(data.error || "อัปเดตผู้ใช้งานไม่สำเร็จ");

    latestStaffUsers = latestStaffUsers.map((user) => (user.id === userId ? data.user : user));
    if (currentProfile?.id === userId) {
      currentProfile = { ...currentProfile, ...data.user };
      setAppState(appState.state, "staff-management:self-updated", { profile: currentProfile });
      applyRoleUi();
      if (!isAdmin()) navigateToPage("create");
    }
  } catch (error) {
    setStaffError(`อัปเดตผู้ใช้งานไม่สำเร็จ: ${getSafeAuthErrorMessage(error)}`);
    await refreshStaffUsers();
  } finally {
    staffUpdateInProgress.delete(userId);
    renderStaffUsers();
  }
}

function addHistoryItem(item) {
  localJobHistory.unshift({
    ...item,
    time: new Date().toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })
  });
  localJobHistory = localJobHistory.slice(0, 80);
  jobHistory = mergeJobHistory();
  saveJobHistory();
  renderHistory();
}

async function refreshJobHistory() {
  if (!isAppReady()) return;
  setProductionListLoading("jobs", true);
  try {
    const params = new URLSearchParams({
      range: selectedJobsRange,
      page: String(selectedJobsPage),
      pageSize: String(selectedJobsPageSize),
      status: els.historyStatusFilter.value,
      q: els.historySearch.value.trim()
    });
    const response = await authFetch(`/api/jobs?${params.toString()}`);
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Cannot load jobs");

    latestJobsData = data;
    selectedJobsPage = data.pagination?.page || selectedJobsPage;
    selectedJobsPageSize = data.pagination?.pageSize || selectedJobsPageSize;
    dbJobHistory = data.jobs || [];
    jobHistoryError = "";
    renderHistory();
  } catch (error) {
    latestJobsData = null;
    jobHistoryError = error.message;
    renderHistory();
  } finally {
    setProductionListLoading("jobs", false);
  }
}

async function refreshNextActions() {
  if (!isAppReady() || !els.nextActionsGrid) return;
  nextActionsLoading = true;
  nextActionsError = "";
  renderNextActions();
  try {
    const params = new URLSearchParams({
      range: "30d",
      page: "1",
      pageSize: "50",
      status: "",
      q: ""
    });
    const response = await authFetch(`/api/jobs?${params.toString()}`);
    const data = await readJsonResponse(response, "โหลดงานที่ต้องทำต่อไม่สำเร็จ");
    if (!response.ok || !data.ok) throw new Error(getApiErrorMessage(response, data, "โหลดงานที่ต้องทำต่อไม่สำเร็จ"));

    latestNextActionsData = data;
    nextActionsError = "";
  } catch (error) {
    latestNextActionsData = null;
    nextActionsError = getSafeAuthErrorMessage(error);
  } finally {
    nextActionsLoading = false;
    renderNextActions();
  }
}

function renderNextActions() {
  if (!els.nextActionsGrid) return;
  const jobs = latestNextActionsData?.jobs || [];
  const cards = buildNextActionCards(jobs);

  if (els.nextActionsLoadingState) els.nextActionsLoadingState.hidden = !nextActionsLoading;
  if (els.nextActionsErrorState) {
    els.nextActionsErrorState.hidden = !nextActionsError;
    els.nextActionsErrorState.innerHTML = nextActionsError
      ? `<strong>ยังโหลดงานไม่ได้</strong><span>ลองรีเฟรชอีกครั้ง ถ้ายังขึ้นซ้ำให้เปิดสุขภาพระบบเพื่อตรวจการเชื่อมต่อ</span>`
      : "";
  }
  if (els.nextActionsEmptyState) {
    els.nextActionsEmptyState.hidden = nextActionsLoading || Boolean(nextActionsError) || cards.length > 0;
    if (!els.nextActionsEmptyState.hidden) {
      els.nextActionsEmptyState.innerHTML = `
        <strong>ยังไม่มีงานค้างที่ต้องกดต่อ</strong>
        <span>เริ่มสร้างภาพใหม่ หรือเปิดงานทั้งหมดเพื่อตรวจงานที่ส่งออกแล้ว</span>
        <div class="empty-state-actions">
          <a class="primary-button compact" href="#create">เริ่มงานภาพใหม่</a>
          <a class="ghost-button compact" href="#jobs">ดูงานทั้งหมด</a>
        </div>
      `;
    }
  }

  els.nextActionsGrid.innerHTML = cards.length
    ? cards.map(renderNextActionCard).join("")
    : "";
  renderNextActionsAdminSummary(jobs);
}

function buildNextActionCards(jobs = []) {
  const buckets = getNextActionBuckets();
  const grouped = new Map(buckets.map((bucket) => [bucket.key, []]));

  jobs.forEach((job) => {
    const bucket = buckets.find((item) => item.match(job));
    if (!bucket) return;
    grouped.get(bucket.key).push(job);
  });

  return buckets
    .map((bucket) => {
      const bucketJobs = grouped.get(bucket.key) || [];
      if (!bucketJobs.length) return null;
      const firstJob = bucketJobs[0];
      return {
        ...bucket,
        count: bucketJobs.length,
        jobs: bucketJobs,
        href: getNextActionHref(firstJob, bucket)
      };
    })
    .filter(Boolean);
}

function getNextActionBuckets() {
  return [
    {
      key: "batch_review",
      tone: "info",
      label: "รอตรวจชุดงาน",
      helper: "ตรวจสินค้าที่ LINE ส่งมาก่อนเริ่มสร้างภาพหลัก",
      match: (job) => {
        const state = getBatchWorkflowState(job);
        const actionType = getWorkflowActionType(getBatchWorkflowNextAction(job));
        return ["draft_created", "waiting_batch_review", "ready_to_confirm"].includes(state) ||
          ["open_batch_review", "review_batch", "confirm_batch"].includes(actionType);
      }
    },
    {
      key: "hero_review",
      tone: "warning",
      label: "รอตรวจภาพหลัก",
      helper: "เปิดภาพหลักเพื่อตัดสินใจอนุมัติหรือสั่งสร้างใหม่",
      match: (job) => getItemWorkflowState(job) === "hero_waiting_review" || isHeroReviewReady(job)
    },
    {
      key: "support_generation",
      tone: "ok",
      label: "ภาพหลักผ่านแล้ว พร้อมทำภาพเสริม",
      helper: "งานถัดไปคือสร้างภาพเสริม",
      match: (job) => {
        const state = getItemWorkflowState(job);
        return ["hero_approved", "support_ready", "support_queued", "support_generating"].includes(state) ||
          isSupportGenerationWaiting(job);
      }
    },
    {
      key: "support_review",
      tone: "warning",
      label: "รอตรวจภาพเสริม",
      helper: "ตรวจชุดภาพเสริมก่อนอนุมัติและส่งออก",
      match: (job) => getItemWorkflowState(job) === "support_waiting_review" || isSupportReviewReady(job)
    },
    {
      key: "wordpress_ready",
      tone: "ok",
      label: "พร้อมเตรียมลง WordPress",
      helper: "ภาพผ่านแล้วและมีไฟล์ปลายทาง พร้อมใช้ทำ preflight/proposal โดยยังไม่เขียนขึ้นเว็บจริง",
      match: (job) => isWordPressPreparationReady(job)
    },
    {
      key: "export_problem",
      tone: "danger",
      label: "ส่งออกไฟล์ไม่สำเร็จ",
      helper: "มีงานที่ต้องตรวจ Drive หรือให้ผู้ดูแลลองส่งออกอีกครั้ง",
      match: isExportProblemJob
    },
    {
      key: "failed",
      tone: "danger",
      label: "งานไม่สำเร็จที่ต้องตรวจ",
      helper: "งานสร้างภาพหรือขั้นตอนงานหยุดกลางทาง ควรส่งต่อให้ผู้ดูแลตรวจ",
      match: isFailedNextActionJob
    }
  ];
}

function renderNextActionCard(card) {
  const firstJob = card.jobs[0] || {};
  const skuLabel = firstJob.sku ? `SKU ${firstJob.sku}` : `งาน ${firstJob.shortId || shortId(firstJob.id) || "-"}`;
  const productLabel = firstJob.productName || firstJob.product_name || firstJob.sku || "ยังไม่มีชื่อสินค้า";
  const previewJobs = card.jobs.slice(0, 3);
  const handoff = card.key === "wordpress_ready" ? getWordPressHandoffModel(firstJob) : null;
  return `
    <article class="next-action-card ${escapeHtml(card.tone)}">
      <div class="next-action-card-header">
        <div>
          <span class="next-action-label">${escapeHtml(card.label)}</span>
          <strong>${formatThaiNumber(card.count)} งาน</strong>
        </div>
        <span class="next-action-count">${formatThaiNumber(card.count)}</span>
      </div>
      <p>${escapeHtml(card.helper)}</p>
      <div class="next-action-meta">
        <span>${escapeHtml(productLabel)}</span>
        <span>${escapeHtml(skuLabel)}</span>
        ${firstJob.claimStatus ? renderSkuWorkClaimBadge(firstJob.claimStatus) : ""}
        <span>${escapeHtml(formatJobTime(firstJob.latestActivityAt || firstJob.updatedAt || firstJob.createdAt))}</span>
      </div>
      ${previewJobs.length ? `
        <ul class="next-action-preview-list">
          ${previewJobs.map((job) => `
            <li>
              <strong>${escapeHtml(job.productName || job.product_name || job.sku || "งานภาพ")}</strong>
              <span>${escapeHtml(job.sku ? `SKU ${job.sku}` : shortId(job.id) || "ยังไม่มีรหัส")}</span>
            </li>
          `).join("")}
        </ul>
      ` : ""}
      ${handoff ? renderWordPressHandoffCard(handoff, { compact: true }) : ""}
      <a class="primary-button compact next-action-button" href="${escapeHtml(card.href || "#jobs")}">ไปทำงานนี้</a>
    </article>
  `;
}

function renderSkuWorkClaimBadge(claimStatus = {}) {
  const status = claimStatus.status || "available";
  const label = status === "claimed_by_me"
    ? "claim โดยคุณ"
    : status === "claimed_by_other"
      ? `claim โดย ${claimStatus.locked_by_label || "ทีมอื่น"}`
      : "SKU ว่าง";
  const tone = status === "claimed_by_me" ? "ready" : status === "claimed_by_other" ? "blocked" : "available";
  return `<span class="claim-status-badge ${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
}

function renderNextActionsAdminSummary(jobs = []) {
  if (!els.nextActionsAdminSummary) return;
  if (!isAdmin()) {
    els.nextActionsAdminSummary.hidden = true;
    els.nextActionsAdminSummary.innerHTML = "";
    return;
  }
  const exportProblems = jobs.filter(isExportProblemJob).length;
  const failedJobs = jobs.filter(isFailedNextActionJob).length;
  const recoverableJobs = jobs.filter((job) => job.canRetryExport || job.canMarkFailed).length;
  const hasSummary = exportProblems || failedJobs || recoverableJobs;
  els.nextActionsAdminSummary.hidden = !hasSummary;
  els.nextActionsAdminSummary.innerHTML = hasSummary
    ? `
      <strong>สรุปสำหรับผู้ดูแล</strong>
      <span>ส่งออกไฟล์มีปัญหา ${formatThaiNumber(exportProblems)} งาน</span>
      <span>งานไม่สำเร็จ ${formatThaiNumber(failedJobs)} งาน</span>
      <span>กู้คืนได้ ${formatThaiNumber(recoverableJobs)} งาน</span>
    `
    : "";
}

function getItemWorkflowState(job = {}) {
  return String(job.workflow?.item?.state || job.workflowState || job.itemWorkflowState || "").toLowerCase();
}

function getBatchWorkflowState(job = {}) {
  return String(job.workflow?.batch?.state || job.batchWorkflowState || "").toLowerCase();
}

function getWorkflowNextAction(job = {}) {
  return job.workflow?.item?.next_action || job.workflowNextAction || job.next_action || null;
}

function getBatchWorkflowNextAction(job = {}) {
  return job.workflow?.batch?.next_action || job.batchWorkflowNextAction || null;
}

function getWorkflowActionType(action = {}) {
  return String(action?.type || "").toLowerCase();
}

function getNextActionHref(job = {}, bucket = {}) {
  const itemAction = getWorkflowNextAction(job);
  const batchAction = getBatchWorkflowNextAction(job);
  if (bucket.key === "batch_review") {
    const href = normalizeWorkflowHashHref(batchAction?.href || itemAction?.href || "");
    if (href) return href;
    const batchId = job.batchKey || job.batchId || job.batch_id || "";
    return batchId ? `#batch?batch_id=${encodeURIComponent(batchId)}` : "#jobs";
  }
  const workflowHref = normalizeWorkflowHashHref(itemAction?.href || "");
  if (workflowHref) return workflowHref;
  if (["hero_review", "support_generation", "support_review", "failed"].includes(bucket.key)) {
    return buildJobReviewHref(job) || "#jobs";
  }
  return "#jobs";
}

function isExportProblemJob(job = {}) {
  const exportStatus = String(job.exportStatus || job.export_status || "").toLowerCase();
  return Boolean(job.canRetryExport) || /failed|error|blocked/.test(exportStatus);
}

function isWordPressPreparationReady(job = {}) {
  if (isExportProblemJob(job) || isFailedNextActionJob(job)) return false;
  const exportStatus = String(job.exportStatus || job.export_status || "").toLowerCase();
  const preflightStatus = String(job.mediaPreflightStatus || job.media_preflight_status || job.wordpressPreflightStatus || "").toLowerCase();
  const hasDriveExport = Boolean(job.exportUrl || job.export_url) ||
    ["google_drive", "exported", "approved_export"].includes(exportStatus);
  return hasDriveExport ||
    isMediaPreflightReady(job) ||
    /ready|proposal|preflight|mapped|completed/.test(preflightStatus);
}

function getWordPressPublishedUrl(job = {}) {
  return safeUrlValue(
    job.wpPostUrl ||
    job.wp_post_url ||
    job.wordpressPostUrl ||
    job.wordpress_post_url ||
    job.postUrl ||
    job.post_url ||
    job.workflow?.item?.wordpress_post_url ||
    ""
  );
}

function getJobExportUrl(job = {}) {
  return safeUrlValue(job.exportUrl || job.export_url || "");
}

function safeUrlValue(value = "") {
  const text = String(value || "").trim();
  return /^https?:\/\//i.test(text) ? text : "";
}

function getWordPressHandoffModel(job = {}) {
  const publishedUrl = getWordPressPublishedUrl(job);
  const exportUrl = getJobExportUrl(job);
  const preflightStatus = String(job.mediaPreflightStatus || job.wordpressPreflightStatus || job.workflow?.item?.preflight_status || "").toLowerCase();
  const reviewHref = buildJobReviewHref(job);
  if (publishedUrl) {
    return {
      tone: "warning",
      title: "สินค้านี้เคยลง WordPress แล้ว",
      body: "ตรวจสินค้าปลายทางก่อนสร้างซ้ำ เพื่อไม่ให้ WooCommerce มีรายการซ้อน",
      links: [
        { href: publishedUrl, label: "เปิดสินค้าบน WordPress", external: true },
        exportUrl ? { href: exportUrl, label: "เปิดไฟล์ภาพปลายทาง", external: true } : null
      ].filter(Boolean)
    };
  }
  if (exportUrl) {
    return {
      tone: "ok",
      title: "ไฟล์ภาพพร้อมส่งต่อเว็บ",
      body: "เปิดไฟล์ปลายทางเพื่อตรวจชุดภาพ แล้วใช้เป็นข้อมูลสำหรับ WordPress preflight/proposal",
      links: [
        { href: exportUrl, label: "เปิดไฟล์ภาพปลายทาง", external: true },
        reviewHref ? { href: reviewHref, label: "กลับไปดูหน้าตรวจ", external: false } : null
      ].filter(Boolean)
    };
  }
  if (/ready|proposal|preflight|mapped|completed/.test(preflightStatus) || isMediaPreflightReady(job)) {
    return {
      tone: "info",
      title: "พร้อมทำ WordPress preflight",
      body: "ภาพผ่านครบแล้ว ขั้นถัดไปคือตรวจข้อมูลสินค้า/ไฟล์ภาพก่อนส่งเข้า WordPress",
      links: [
        reviewHref ? { href: reviewHref, label: "เปิดหน้าตรวจ", external: false } : null,
        { href: "#monitoring", label: "ดูสถานะ preflight", external: false }
      ].filter(Boolean)
    };
  }
  return {
    tone: "info",
    title: "รอข้อมูลก่อนส่งต่อเว็บ",
    body: "ตรวจภาพและไฟล์ปลายทางให้ครบก่อนเริ่ม WordPress handoff",
    links: reviewHref ? [{ href: reviewHref, label: "เปิดหน้าตรวจ", external: false }] : []
  };
}

function renderWordPressHandoffCard(handoff = {}, { compact = false } = {}) {
  return `
    <div class="wordpress-handoff-card ${escapeHtml(handoff.tone || "info")} ${compact ? "compact" : ""}">
      <strong>${escapeHtml(handoff.title || "WordPress handoff")}</strong>
      <span>${escapeHtml(handoff.body || "")}</span>
      ${handoff.links?.length ? `
        <div class="wordpress-handoff-links">
          ${handoff.links.map((link) => link.external
            ? `<a href="${escapeHtml(link.href)}" target="_blank" rel="noopener">${escapeHtml(link.label)}</a>`
            : `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`
          ).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function isFailedNextActionJob(job = {}) {
  const state = getItemWorkflowState(job);
  const statusText = [
    state,
    job.status,
    job.generationStatus,
    job.heroStatus,
    job.supportStatus,
    job.workflowState
  ].filter(Boolean).join(" ").toLowerCase();
  return ["hero_failed", "support_failed", "failed", "partially_failed"].includes(state) ||
    /\bfailed\b|ไม่สำเร็จ/.test(statusText);
}

function mergeJobHistory() {
  return [...dbJobHistory, ...localJobHistory].slice(0, 100);
}

function mapDbJobToHistoryItem(job) {
  return {
    id: job.id,
    name: job.product_name || job.sku || job.form_json?.productName || "Untitled product",
    type: job.image_type || job.form_json?.imageType || "-",
    category: job.category || job.form_json?.category || "-",
    status: formatJobStatus(job.status),
    rawStatus: job.status || "",
    time: formatJobTime(job.created_at),
    source: "database"
  };
}

function formatJobStatus(status) {
  const labels = {
    draft: "ฉบับร่าง",
    queued: "รอคิว",
    generating: "กำลังสร้างภาพ",
    hero_ready: "ภาพหลักพร้อมตรวจ",
    failed: "ไม่สำเร็จ"
  };
  return labels[status] || status || "-";
}

function formatJobTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return String(value);
  }
}

function renderHistory() {
  const items = latestJobsData?.jobs || [];
  renderJobSummary(items);
  renderProductionFlowBoard(items);
  renderProductionPagination("jobs", latestJobsData?.pagination);
  if (els.jobsErrorState) {
    els.jobsErrorState.hidden = !jobHistoryError;
    els.jobsErrorState.textContent = jobHistoryError ? `โหลดรายการงานไม่สำเร็จ: ${getSafeAuthErrorMessage(jobHistoryError)}` : "";
  }

  if (!items.length) {
    els.historyBody.innerHTML = `<tr><td colspan="5" class="empty-state">${escapeHtml(jobHistoryError ? "โหลดรายการงานไม่สำเร็จ" : "ยังไม่มีงานในช่วงเวลานี้")}</td></tr>`;
    return;
  }

  els.historyBody.innerHTML = items
    .map(renderProductionJobRow)
    .join("");
}

function renderJobSummary(items) {
  const approvedCount = items.filter((item) => item.approvalStatus === "approved").length;
  const exportedCount = items.filter((item) => item.exportUrl || ["google_drive", "exported"].includes(String(item.exportStatus || "").toLowerCase())).length;
  const reviewCount = items.filter((item) => isHeroReviewReady(item) || isSupportReviewReady(item)).length;
  els.jobSummary.innerHTML = `
    <span>${items.length.toLocaleString("th-TH")} งาน</span>
    <span>${reviewCount.toLocaleString("th-TH")} รอตรวจ</span>
    <span>${approvedCount.toLocaleString("th-TH")} อนุมัติแล้ว · ${exportedCount.toLocaleString("th-TH")} ส่งออกแล้ว</span>
  `;
}

function getProductionFlowStage(job = {}) {
  if (job.exportUrl || ["google_drive", "exported"].includes(String(job.exportStatus || "").toLowerCase())) return "wordpress";
  if (isMediaPreflightReady(job)) return "media_preflight";
  if (isSupportReviewReady(job)) return "support_review";
  if (isSupportGenerationWaiting(job)) return "support_generation";
  if (isHeroReviewReady(job)) return "hero_review";
  return "line_intake";
}

function renderProductionFlowBoard(items = []) {
  if (!els.productionFlowBoard) return;
  const stages = [
    { key: "line_intake", label: "รับชุดงาน", helper: "รับรายการสินค้าและเลือกรหัสที่ต้องทำ" },
    { key: "hero_review", label: "ตรวจภาพหลัก", helper: "อนุมัติหรือสั่งสร้างภาพหลักใหม่" },
    { key: "support_generation", label: "สร้างภาพเสริม", helper: "สร้างมุมเพิ่มเติมหลังภาพหลักผ่านแล้ว" },
    { key: "support_review", label: "ตรวจภาพเสริม", helper: "เลือกภาพที่พร้อมใช้ก่อนส่งออก" },
    { key: "media_preflight", label: "ตรวจไฟล์ก่อนส่งต่อ", helper: "เช็กไฟล์และรายการที่ยังติดอยู่" },
    { key: "wordpress", label: "พร้อมลง WordPress", helper: "พร้อมทำ preflight/proposal หรือมีไฟล์ปลายทางแล้ว" }
  ];
  const counts = stages.reduce((acc, stage) => ({ ...acc, [stage.key]: 0 }), {});
  items.forEach((item) => {
    const stage = getProductionFlowStage(item);
    counts[stage] = (counts[stage] || 0) + 1;
  });
  els.productionFlowBoard.innerHTML = stages.map((stage) => `
    <article class="production-flow-card ${counts[stage.key] ? "active" : ""}">
      <strong>${escapeHtml(stage.label)}</strong>
      <span>${formatThaiNumber(counts[stage.key] || 0)}</span>
      <small>${escapeHtml(stage.helper)}</small>
    </article>
  `).join("");
}

async function loadBatchReviewPage() {
  if (!els.batchReviewStatus) return;
  const params = getHashParams();
  const batchId = params.get("batch_id") || params.get("batchId") || "";
  latestBatchReviewData = null;
  batchReviewError = "";
  if (!batchId) {
    batchReviewError = "ลิงก์นี้ไม่มีรหัสชุดงาน";
    renderBatchReviewPage();
    return;
  }

  batchReviewLoading = true;
  renderBatchReviewPage();
  try {
    const response = await authFetch(`/api/automation/batches/${encodeURIComponent(batchId)}/review`);
    const data = await readJsonResponse(response, "โหลด Batch Review ไม่สำเร็จ");
    if (!response.ok || !data.ok) throw new Error(getApiErrorMessage(response, data, "โหลด Batch Review ไม่สำเร็จ"));
    latestBatchReviewData = data;
    batchReviewError = "";
  } catch (error) {
    latestBatchReviewData = null;
    batchReviewError = getSafeAuthErrorMessage(error);
  } finally {
    batchReviewLoading = false;
    renderBatchReviewPage();
  }
}

function renderBatchReviewPage() {
  if (!els.batchReviewTitle) return;
  const data = latestBatchReviewData;
  const batch = data?.batch || {};
  const itemCards = Array.isArray(data?.item_cards) ? data.item_cards : [];
  const stateLabel = data?.label_th || getBatchEmptyStateLabel();

  els.batchReviewLoadingState.hidden = !batchReviewLoading;
  els.batchReviewErrorState.hidden = !batchReviewError;
  els.batchReviewErrorState.textContent = getBatchErrorCopy(batchReviewError);
  els.batchReviewStatus.textContent = stateLabel;
  els.batchReviewTitle.textContent = data ? `Batch ${shortId(batch.batch_id || batch.id || "")}` : "ตรวจชุดงานจาก LINE";
  els.batchReviewRequest.textContent = data
    ? `ที่มา: ${formatBatchSource(batch.source)} · ข้อความที่รับมา: ${batch.raw_request_text || "-"}`
    : "ตรวจรายการสินค้าที่ส่งมาจาก LINE ก่อนเริ่มสร้างภาพหลัก";
  els.batchReviewNextAction.textContent = data?.next_action?.label_th || getBatchEmptyActionLabel();
  renderBatchPrimaryButton(data);
  renderBatchProgress(data);
  renderBatchBlockers(data?.blockers || []);
  renderBatchSkuCards(itemCards);
  renderBatchDebug(data);
}

function getBatchEmptyStateLabel() {
  if (batchReviewLoading) return "กำลังโหลด";
  if (batchReviewError) return batchReviewError.includes("ไม่มีสิทธิ์") ? "ไม่มีสิทธิ์" : "โหลดไม่สำเร็จ";
  return "รอข้อมูล";
}

function getBatchEmptyActionLabel() {
  if (batchReviewLoading) return "กำลังโหลดชุดงาน";
  if (batchReviewError) return "ตรวจลิงก์หรือสิทธิ์";
  return "รอข้อมูลชุดงาน";
}

function getBatchErrorCopy(message = "") {
  if (!message) return "";
  if (/not found|ไม่พบ|batch_not_found/i.test(message)) return "ไม่พบชุดงานนี้ กรุณาตรวจลิงก์จาก LINE อีกครั้ง";
  if (/permission|forbidden|ไม่มีสิทธิ์|401|403/i.test(message)) return "ไม่มีสิทธิ์ดูชุดงานนี้ กรุณาติดต่อผู้ดูแล";
  return message.includes("batch_id") || message.includes("รหัสชุดงาน") ? message : `ยังเตรียมสรุปสำหรับตรวจไม่ได้: ${message}`;
}

function renderBatchPrimaryButton(data) {
  if (!els.batchReviewPrimaryButton) return;
  const action = data?.next_action || {};
  const type = action.type || "";
  const enabledAction = getBatchPrimaryAction(type, data);
  els.batchReviewPrimaryButton.textContent = getBatchPrimaryLabel(type, action.label_th);
  els.batchReviewPrimaryButton.dataset.batchAction = enabledAction;
  els.batchReviewPrimaryButton.dataset.href = normalizeWorkflowHashHref(action.href || "");
  els.batchReviewPrimaryButton.dataset.batchId = data?.batch?.batch_id || data?.batch?.id || "";
  els.batchReviewPrimaryButton.disabled = batchReviewLoading || batchReviewActionInProgress || !enabledAction;
}

function getBatchPrimaryAction(type, data = {}) {
  if (type === "confirm_batch") return "confirm_batch";
  if (["open_review", "open_export_preflight", "resolve_reference"].includes(type)) return "navigate";
  if (type === "wait_system") return "";
  if (type === "none") return "";
  if (!data?.ok) return "";
  return "";
}

function getBatchPrimaryLabel(type, fallback = "") {
  const labels = {
    confirm_batch: "ตรวจรายการแล้วเริ่มสร้างภาพหลัก",
    open_review: fallback || "เปิดหน้าตรวจ",
    open_export_preflight: "เปิดไฟล์ export",
    resolve_reference: "เปิดคลังภาพอ้างอิง",
    wait_system: "รอคิวทำงาน",
    none: "ไม่ต้องทำอะไรต่อ"
  };
  return labels[type] || fallback || "รอข้อมูล";
}

function renderBatchProgress(data) {
  if (!els.batchProgressGrid) return;
  const cards = buildBatchProgressCards(data);
  els.batchProgressGrid.innerHTML = cards.map((card) => `
    <article class="batch-progress-card ${card.count ? "active" : ""}">
      <span>${escapeHtml(card.label)}</span>
      <strong>${formatThaiNumber(card.count)}</strong>
    </article>
  `).join("");
}

function buildBatchProgressCards(data = {}) {
  const items = Array.isArray(data?.item_cards) ? data.item_cards : [];
  const countState = (states) => items.filter((item) => states.includes(item.state)).length;
  const progress = data?.progress || {};
  return [
    { label: "เลือกแล้ว", count: Number(progress.selected_items || items.filter((item) => item.selected).length || 0) },
    { label: "ข้าม", count: Number(progress.skipped_items || countState(["skipped"])) },
    { label: "ภาพหลักสร้างแล้ว", count: countState(["hero_waiting_review", "hero_approved", "support_ready", "support_generating", "support_waiting_review", "support_approved", "exported"]) },
    { label: "รอตรวจภาพหลัก", count: countState(["hero_waiting_review"]) },
    { label: "ภาพหลักผ่านแล้ว", count: countState(["hero_approved", "support_ready", "support_generating", "support_waiting_review", "support_approved", "exported"]) },
    { label: "พร้อมทำภาพเสริม", count: countState(["support_ready", "support_generating"]) },
    { label: "ภาพเสริมสร้างแล้ว", count: countState(["support_waiting_review", "support_approved", "exported"]) },
    { label: "ภาพเสริมผ่านแล้ว", count: countState(["support_approved", "exported"]) },
    { label: "ไม่สำเร็จ", count: Number(progress.failed_items || countState(["hero_failed", "support_failed"])) }
  ];
}

function renderBatchBlockers(blockers = []) {
  if (!els.batchReviewBlockers) return;
  els.batchReviewBlockers.hidden = !blockers.length;
  els.batchReviewBlockers.innerHTML = blockers.length
    ? blockers.map((blocker) => `<span>${escapeHtml(blocker.label_th || blocker.code || "ติดเงื่อนไข")}</span>`).join("")
    : "";
}

function renderBatchSkuCards(items = []) {
  if (!els.batchSkuGrid) return;
  if (batchReviewLoading) {
    els.batchSkuGrid.innerHTML = '<p class="empty-state">กำลังโหลดรายการ SKU...</p>';
    return;
  }
  if (batchReviewError) {
    els.batchSkuGrid.innerHTML = `<p class="empty-state">${escapeHtml(getBatchErrorCopy(batchReviewError))}</p>`;
    return;
  }
  if (latestBatchReviewData?.state === "cancelled") {
    els.batchSkuGrid.innerHTML = '<p class="empty-state">Batch นี้ถูกยกเลิกแล้ว ไม่มีงานที่ต้องทำต่อ</p>';
    return;
  }
  if (!items.length) {
    els.batchSkuGrid.innerHTML = '<p class="empty-state">ยังไม่มี SKU ในชุดงานนี้</p>';
    return;
  }
  els.batchSkuGrid.innerHTML = items.map(renderBatchSkuCard).join("");
}

function renderBatchSkuCard(item = {}) {
  const blockers = Array.isArray(item.blockers) ? item.blockers : [];
  const itemActions = Array.isArray(item.allowed_actions) ? item.allowed_actions : [];
  return `
    <article class="batch-sku-card ${escapeHtml(item.state || "selected")}">
      <div class="batch-sku-card-main">
        <div>
          <span class="batch-sku-code">${escapeHtml(item.sku || "-")}</span>
          <strong>${escapeHtml(item.product_name || "ยังไม่มีชื่อสินค้า")}</strong>
          <small>${escapeHtml(formatBranchLabel(item))} · ${escapeHtml(item.product_type || "-")}${item.subcategory ? ` · ${escapeHtml(item.subcategory)}` : ""}</small>
        </div>
        <span class="batch-item-state">${escapeHtml(item.label_th || "-")}</span>
      </div>
      <div class="batch-sku-status-grid">
        ${renderBatchItemStatus("รูปอ้างอิง", getReferenceStatusLabel(item))}
        ${renderBatchItemStatus("ภาพหลัก", getHeroStatusLabel(item.state))}
        ${renderBatchItemStatus("ภาพเสริม", getSupportStatusLabel(item.state))}
      </div>
      ${blockers.length ? `<div class="batch-item-blockers">${blockers.map((blocker) => `<span>${escapeHtml(blocker.label_th || blocker.code || "ติดเงื่อนไข")}</span>`).join("")}</div>` : ""}
      ${itemActions.length ? `<div class="batch-item-actions">${itemActions.map((action) => renderBatchItemActionButton(action, item)).join("")}</div>` : ""}
    </article>
  `;
}

function renderBatchItemStatus(label, value) {
  return `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderBatchItemActionButton(action = {}, item = {}) {
  const type = action.type || "";
  if (!["skip_item", "retry_item"].includes(type)) return "";
  return `
    <button
      class="ghost-button compact"
      type="button"
      data-batch-item-action="${escapeHtml(type)}"
      data-item-id="${escapeHtml(item.id || "")}"
    >${escapeHtml(action.label_th || (type === "skip_item" ? "ข้าม SKU นี้" : "ลองสร้างใหม่"))}</button>
  `;
}

function getReferenceStatusLabel(item = {}) {
  if (item.reference?.has_reference) return "มีภาพอ้างอิง";
  if ((item.blockers || []).some((blocker) => blocker.code === "missing_reference_assets")) return "ไม่มีภาพอ้างอิง";
  return "รอตรวจภาพอ้างอิง";
}

function getHeroStatusLabel(state = "") {
  if (["hero_waiting_review"].includes(state)) return "รอตรวจภาพหลัก";
  if (["hero_approved", "support_ready", "support_generating", "support_waiting_review", "support_approved", "exported"].includes(state)) return "อนุมัติแล้ว";
  if (state === "hero_generating") return "กำลังสร้าง";
  if (state === "hero_failed") return "สร้างไม่สำเร็จ";
  if (state === "skipped") return "ข้าม";
  return "ยังไม่เริ่ม";
}

function getSupportStatusLabel(state = "") {
  if (state === "support_ready") return "พร้อมสร้าง";
  if (state === "support_generating") return "กำลังสร้าง";
  if (state === "support_waiting_review") return "รอตรวจภาพเสริม";
  if (["support_approved", "exported"].includes(state)) return "อนุมัติแล้ว";
  if (state === "support_failed") return "สร้างไม่สำเร็จ";
  if (state === "support_blocked_waiting_hero") return "รอภาพหลักผ่านก่อน";
  if (state === "skipped") return "ข้าม";
  return "ล็อกอยู่";
}

function formatBatchSource(source = "") {
  const normalized = String(source || "").toLowerCase();
  if (normalized.includes("line")) return "LINE";
  return source || "-";
}

function formatBranchLabel(item = {}) {
  return item.brand_label || item.target_site || item.brand_id || "-";
}

function renderBatchDebug(data = {}) {
  if (!els.batchDebugDrawer || !els.batchDebugContent) return;
  const debug = data?.debug || null;
  els.batchDebugDrawer.hidden = !debug;
  els.batchDebugContent.textContent = debug ? JSON.stringify(debug, null, 2) : "";
}

async function handleBatchPrimaryAction() {
  const button = els.batchReviewPrimaryButton;
  if (!button || button.disabled) return;
  const action = button.dataset.batchAction || "";
  if (action === "navigate") {
    navigateToWorkflowHref(button.dataset.href || "#jobs");
    return;
  }
  if (action !== "confirm_batch") return;
  await runBatchReviewAction({
    url: `/api/automation/batches/${encodeURIComponent(button.dataset.batchId || "")}/confirm`,
    message: "กำลังยืนยันชุด SKU..."
  });
}

async function handleBatchItemActionClick(event) {
  const button = event.target.closest("[data-batch-item-action]");
  if (!button || batchReviewActionInProgress) return;
  const itemId = button.dataset.itemId || "";
  const action = button.dataset.batchItemAction || "";
  if (!itemId || !["skip_item", "retry_item"].includes(action)) return;
  await runBatchReviewAction({
    url: `/api/automation/batch-items/${encodeURIComponent(itemId)}/${action === "skip_item" ? "skip" : "retry"}`,
    message: action === "skip_item" ? "กำลังข้าม SKU..." : "กำลังส่งคำขอลองใหม่..."
  });
}

async function runBatchReviewAction({ url = "", message = "" } = {}) {
  if (!url || batchReviewActionInProgress) return;
  batchReviewActionInProgress = true;
  batchReviewError = "";
  if (els.batchReviewNextAction) els.batchReviewNextAction.textContent = message || "กำลังดำเนินการ...";
  renderBatchPrimaryButton(latestBatchReviewData);
  try {
    const response = await authFetch(url, { method: "POST", headers: { "Content-Type": "application/json" } });
    const data = await readJsonResponse(response, "ดำเนินการไม่สำเร็จ");
    if (!response.ok || !data.ok) throw new Error(getApiErrorMessage(response, data, "ดำเนินการไม่สำเร็จ"));
    latestBatchReviewData = data;
    batchReviewError = "";
  } catch (error) {
    batchReviewError = getSafeAuthErrorMessage(error);
  } finally {
    batchReviewActionInProgress = false;
    renderBatchReviewPage();
  }
}

function normalizeWorkflowHashHref(href = "") {
  const value = String(href || "").trim();
  if (!value) return "";
  try {
    const url = new URL(value, window.location.origin);
    const hash = url.hash || value;
    if (hash.startsWith("#batch-review")) return hash.replace("#batch-review", "#batch");
    return hash.startsWith("#") ? hash : value;
  } catch {
    return value.startsWith("#batch-review") ? value.replace("#batch-review", "#batch") : value;
  }
}

function navigateToWorkflowHref(href = "") {
  const target = normalizeWorkflowHashHref(href) || "#jobs";
  if (target.startsWith("#")) {
    window.location.hash = target.slice(1);
    navigateToPage(getPageFromHash());
    return;
  }
  window.open(target, "_blank", "noopener");
}

async function refreshAssetLibrary() {
  if (!isAppReady()) return;
  setProductionListLoading("assets", true);
  try {
    const params = new URLSearchParams({
      range: selectedAssetsRange,
      page: String(selectedAssetsPage),
      pageSize: String(selectedAssetsPageSize),
      type: selectedAssetType,
      q: els.assetSearch.value.trim(),
      jobId: els.assetJobIdFilter.value.trim()
    });
    const response = await authFetch(`/api/assets?${params.toString()}`);
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Cannot load assets");

    latestAssetsData = data;
    selectedAssetsPage = data.pagination?.page || selectedAssetsPage;
    selectedAssetsPageSize = data.pagination?.pageSize || selectedAssetsPageSize;
    if (els.assetsErrorState) els.assetsErrorState.hidden = true;
    renderAssets();
  } catch (error) {
    latestAssetsData = null;
    if (els.assetsErrorState) {
      els.assetsErrorState.hidden = false;
      els.assetsErrorState.textContent = `โหลดคลังภาพไม่สำเร็จ: ${getSafeAuthErrorMessage(error)}`;
    }
    renderAssets();
  } finally {
    setProductionListLoading("assets", false);
  }
}

function renderProductionJobRow(job) {
  return `
    <tr class="production-job-row">
      <td>
        <strong>${escapeHtml(job.productName || job.sku || "Untitled product")}</strong>
        <div class="table-muted">งาน ${escapeHtml(job.shortId || shortId(job.id))}${job.sku ? ` · SKU ${escapeHtml(job.sku)}` : ""}</div>
        <div class="production-meta">${escapeHtml(job.brand || "-")} · ${escapeHtml(job.category || "-")} · ${escapeHtml(job.imageType || "-")}</div>
        <div class="production-meta">ผู้สร้าง: ${escapeHtml(job.createdBy?.name || job.createdBy?.email || "ระบบอัตโนมัติ")}</div>
        ${job.claimStatus ? renderSkuWorkClaimBadge(job.claimStatus) : ""}
      </td>
      <td>
        <div class="production-status-stack">
          ${renderStatusBadge(job.status, "งาน")}
          ${renderStatusBadge(job.generationStatus || "no_generation", "สร้างภาพ")}
          ${renderStatusBadge(job.heroStatus || "no_hero", "ภาพหลัก")}
          ${renderStatusBadge(job.supportStatus || "no_support", "ภาพเสริม")}
          ${hasGeneratedSupport(job) ? renderStatusBadge(job.supportReviewStatus || "pending", "ตรวจภาพเสริม") : ""}
          ${job.mediaPreflightStatus ? renderStatusBadge(job.mediaPreflightStatus, "ตรวจส่งออก") : ""}
          ${renderStatusBadge(job.approvalStatus || "pending", "อนุมัติ")}
        </div>
      </td>
      <td>${renderJobNextAction(job)}</td>
      <td>
        ${renderStatusBadge(job.exportStatus || "not_exported", "ส่งออก")}
        ${renderJobExportAction(job)}
      </td>
      <td>
        <strong>${escapeHtml(formatJobTime(job.latestActivityAt || job.updatedAt || job.createdAt))}</strong>
        <div class="table-muted">สร้าง ${formatThaiNumber(job.generationCount || 0)} ครั้ง · มีภาพ ${formatThaiNumber(job.assetCount || 0)} ไฟล์</div>
        ${isAdmin() ? renderRecoveryActions(job, "jobs") : ""}
      </td>
    </tr>
  `;
}

function isHeroReviewReady(job = {}) {
  if (job.approvalStatus === "approved") return false;
  const statusText = [job.status, job.generationStatus, job.heroStatus].filter(Boolean).join(" ").toLowerCase();
  return Boolean(job.latestGenerationId) && /hero_ready|completed|ready|succeeded/.test(statusText);
}

function hasGeneratedSupport(job = {}) {
  return Number(job.supportCount || 0) > 0 || Boolean(job.supportStatus && job.supportStatus !== "no_support");
}

function isSupportGenerationWaiting(job = {}) {
  return job.approvalStatus === "approved" && !hasGeneratedSupport(job);
}

function isSupportReviewApproved(job = {}) {
  const reviewStatus = String(job.supportReviewStatus || "").toLowerCase();
  return reviewStatus === "approved" ||
    reviewStatus === "candidate_manifest_ready" ||
    Boolean(job.candidateManifestStatus);
}

function isSupportReviewReady(job = {}) {
  return job.approvalStatus === "approved" && hasGeneratedSupport(job) && !isSupportReviewApproved(job);
}

function isMediaPreflightReady(job = {}) {
  return job.approvalStatus === "approved" &&
    hasGeneratedSupport(job) &&
    isSupportReviewApproved(job) &&
    !job.exportUrl;
}

function getJobNextAction(job = {}) {
  if (String(job.status || "").toLowerCase().includes("failed")) {
    return { tone: "danger", label: "ตรวจงานที่ไม่สำเร็จ", helper: "งานนี้มีปัญหา กดตรวจรายละเอียดหรือสั่งลองใหม่" };
  }
  if (job.approvalStatus === "approved" && job.exportUrl) {
    return { tone: "ok", label: "พร้อมเตรียมลง WordPress", helper: "ภาพผ่านแล้วและมีไฟล์ปลายทาง พร้อมใช้ทำ preflight/proposal" };
  }
  if (isMediaPreflightReady(job)) {
    const gate = job.mediaPreflightStatus ? getProductionStatusText(job.mediaPreflightStatus) : "ตรวจภาพเสริมครบแล้ว";
    return { tone: "ok", label: "ตรวจไฟล์ก่อนส่งต่อ", helper: `${gate} · ขั้นถัดไปคือเตรียมข้อมูลลง WordPress` };
  }
  if (isSupportReviewReady(job)) {
    const count = Number(job.supportCount || 0);
    return { tone: "warning", label: "ตรวจภาพเสริม", helper: `มีภาพเสริม ${formatThaiNumber(count)} ภาพแล้ว ต้องอนุมัติหรือสั่งสร้างใหม่ก่อนส่งออก` };
  }
  if (isSupportGenerationWaiting(job)) {
    return { tone: "info", label: "รอสร้างภาพเสริม", helper: "ภาพหลักผ่านแล้ว ขั้นถัดไปคือสร้างภาพเสริม" };
  }
  if (isHeroReviewReady(job)) {
    if (job.supportStatus && job.supportStatus !== "no_support") {
      return { tone: "warning", label: "ตรวจชุดภาพ", helper: "ตรวจภาพหลักและภาพเสริมในหน้าเดียว" };
    }
    return { tone: "warning", label: "ตรวจภาพหลัก", helper: "เปิดหน้าตรวจเพื่ออนุมัติ หรือสั่งสร้างภาพหลักใหม่" };
  }
  if (/generating|queued|running/i.test([job.status, job.generationStatus].join(" "))) {
    return { tone: "info", label: "กำลังสร้างภาพ", helper: "กำลังทำงานหรือรอคิว" };
  }
  return { tone: "muted", label: "รอข้อมูล", helper: "ยังไม่มีภาพหลักพร้อมให้ตรวจ" };
}

function buildJobReviewHref(job = {}) {
  if (!job.latestGenerationId) return "";
  const params = new URLSearchParams();
  params.set("generation_id", job.latestGenerationId);
  if (job.batchKey || job.batchId) params.set("batch_id", job.batchKey || job.batchId);
  if (job.sku) params.set("sku", job.sku);
  return `#review?${params.toString()}`;
}

function renderJobNextAction(job = {}) {
  const action = getJobNextAction(job);
  const reviewHref = isHeroReviewReady(job) || isSupportReviewReady(job) || isMediaPreflightReady(job)
    ? buildJobReviewHref(job)
    : "";
  const handoff = isWordPressPreparationReady(job) ? getWordPressHandoffModel(job) : null;
  return `
    <div class="job-next-action ${escapeHtml(action.tone)}">
      <strong>${escapeHtml(action.label)}</strong>
      <span>${escapeHtml(action.helper)}</span>
      ${reviewHref ? `<a class="ghost-button compact" href="${escapeHtml(reviewHref)}">เปิดหน้าตรวจ</a>` : ""}
      ${handoff ? renderWordPressHandoffCard(handoff, { compact: true }) : ""}
    </div>
  `;
}

function renderJobExportAction(job) {
  if (job.exportUrl) {
    return `<a class="asset-link" href="${escapeHtml(job.exportUrl)}" target="_blank" rel="noopener">เปิดไฟล์ปลายทาง</a>`;
  }
  if (isAdmin() && job.canRetryExport && job.id) {
    return `
      <div class="export-recovery-action">
        ${renderRecoveryButton("retry-export", job.exportActionLabel || "ส่งออกอีกครั้ง", job.id || job.jobId || "", job.latestGenerationId || "", "jobs-export")}
      </div>
    `;
  }
  return '<div class="table-muted">ยังไม่มีไฟล์ปลายทาง</div>';
}

function renderProductionAssetCard(asset) {
  const preview = asset.previewUrl
    ? `<img src="${escapeHtml(asset.previewUrl)}" alt="${escapeHtml(asset.fileName || asset.type || "asset")}">`
    : '<div class="asset-placeholder">ไม่มี preview</div>';
  const jobShort = asset.jobShortId || shortId(asset.jobId);
  const generationShort = asset.generationShortId || shortId(asset.generationId);
  return `
    <article class="asset-card production-asset-card">
      ${preview}
      <div>
        <strong>${escapeHtml(asset.fileName || asset.productName || asset.type || "asset")}</strong>
        <span>${escapeHtml(formatAssetTypeLabel(asset.typeGroup, asset.type))}</span>
        ${renderAssetStatusBadges(asset)}
        <span>${escapeHtml(asset.sku || asset.productName || "-")} · Job ${escapeHtml(jobShort || "-")}</span>
        <span>${escapeHtml(formatJobTime(asset.createdAt))}</span>
        <span>${escapeHtml(asset.createdBy?.email || asset.createdBy?.name || "ไม่ระบุผู้ใช้งาน")}</span>
        ${asset.previewWarning ? `<small class="asset-warning">${escapeHtml(asset.previewWarning)}</small>` : ""}
        ${asset.storagePath ? `<small>${escapeHtml(asset.bucket || "storage")} · ${escapeHtml(asset.storagePath)}</small>` : ""}
      </div>
      <div class="asset-primary-actions">
        ${asset.imageUrl ? `<a class="ghost-button compact" href="${escapeHtml(asset.imageUrl)}" target="_blank" rel="noopener">เปิดรูป</a>` : ""}
        ${asset.googleDriveLink ? `<a class="ghost-button compact" href="${escapeHtml(asset.googleDriveLink)}" target="_blank" rel="noopener">เปิด Drive</a>` : ""}
      </div>
      <div class="asset-debug-meta">
        ${asset.jobId ? `<span>งาน: ${escapeHtml(jobShort)} <button type="button" data-copy-value="${escapeHtml(asset.jobId)}" title="คัดลอกเลขงาน">คัดลอก</button></span>` : ""}
        ${asset.generationId ? `<span>ภาพ: ${escapeHtml(generationShort)} <button type="button" data-copy-value="${escapeHtml(asset.generationId)}" title="คัดลอกเลขภาพ">คัดลอก</button></span>` : ""}
      </div>
    </article>
  `;
}

function renderAssetStatusBadges(asset) {
  const badges = Array.isArray(asset.statusBadges) && asset.statusBadges.length
    ? asset.statusBadges
    : [asset.status || "-"];
  return `
    <div class="asset-status-stack">
      ${badges.map((badge) => renderStatusBadge(badge)).join("")}
    </div>
  `;
}

function normalizeAssetTypeFilter(value) {
  const type = String(value || "outputs").trim().toLowerCase();
  if (["outputs", "hero", "support", "approved", "references", "all"].includes(type)) return type;
  return "outputs";
}

function updateAssetLibraryHelper() {
  if (!els.assetLibraryHelper) return;
  els.assetLibraryHelper.textContent = selectedAssetType === "references"
    ? "ภาพอ้างอิงคือภาพจริงที่ใช้ประกอบการสร้างงาน เช่น ภาพสินค้าและภาพโมเดล"
    : "คลังภาพสำหรับดูผลงานที่สร้างไว้ เช่น ภาพหลัก ภาพเสริม และภาพที่อนุมัติหรือส่งออกแล้ว";
}

function renderRecoveryActions(item, source) {
  if (!isAdmin()) return "";
  const jobId = item.jobId || item.id || "";
  const generationId = item.generationId || item.latestGenerationId || "";
  const buttons = [];
  if (item.retryable && (jobId || generationId)) {
    buttons.push(renderRecoveryButton("retry", "ลองใหม่", jobId, generationId, source));
  }
  if (source !== "jobs" && item.canRetryExport && jobId) {
    buttons.push(renderRecoveryButton("retry-export", "ส่งออกอีกครั้ง", jobId, generationId, source));
  }
  if (item.canMarkFailed && jobId) {
    buttons.push(renderRecoveryButton("mark-failed", "ทำเครื่องหมายว่าไม่สำเร็จ", jobId, generationId, source));
  }
  if (!buttons.length) return "";
  return `<div class="recovery-actions">${buttons.join("")}</div>`;
}

function renderRecoveryButton(action, label, jobId, generationId, source) {
  const key = `${action}:${jobId || "-"}:${generationId || "-"}`;
  const loading = recoveryActionsInProgress.has(key);
  return `
    <button
      class="ghost-button compact recovery-button"
      type="button"
      data-recovery-action="${escapeHtml(action)}"
      data-recovery-source="${escapeHtml(source)}"
      data-job-id="${escapeHtml(jobId || "")}"
      data-generation-id="${escapeHtml(generationId || "")}"
      ${loading ? "disabled" : ""}
    >${loading ? "กำลังทำงาน..." : escapeHtml(label)}</button>
  `;
}

async function handleRecoveryActionClick(event) {
  const button = event.target.closest("[data-recovery-action]");
  if (!button) return;
  event.preventDefault();
  if (!isAdmin()) return;

  const action = button.dataset.recoveryAction;
  const jobId = button.dataset.jobId || "";
  const generationId = button.dataset.generationId || "";
  const key = `${action}:${jobId || "-"}:${generationId || "-"}`;
  if (recoveryActionsInProgress.has(key)) return;
  if (action === "mark-failed" && !window.confirm("ยืนยัน mark งานนี้เป็น failed?")) return;

  recoveryActionsInProgress.add(key);
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "กำลังทำงาน...";
  try {
    const response = await authFetch(getRecoveryEndpoint(action, jobId, generationId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generationId, reason: "Marked failed by admin from Monitoring/Jobs" })
    });
    const data = await readJsonResponse(response, "Recovery action ไม่สำเร็จ");
    if (!response.ok || !data.ok) throw new Error(data.error || "Recovery action ไม่สำเร็จ");
    showRecoveryMessage(data.message || "ดำเนินการสำเร็จ", false);
    await refreshRecoveryViews();
  } catch (error) {
    showRecoveryMessage(`ดำเนินการไม่สำเร็จ: ${getSafeAuthErrorMessage(error)}`, true);
  } finally {
    recoveryActionsInProgress.delete(key);
    button.disabled = false;
    button.textContent = originalText;
  }
}

function getRecoveryEndpoint(action, jobId, generationId) {
  if (action === "retry") {
    if (generationId) return `/api/admin/generations/${encodeURIComponent(generationId)}/retry`;
    return `/api/admin/jobs/${encodeURIComponent(jobId)}/retry`;
  }
  if (action === "retry-export") return `/api/admin/jobs/${encodeURIComponent(jobId)}/retry-export`;
  if (action === "mark-failed") return `/api/admin/jobs/${encodeURIComponent(jobId)}/mark-failed`;
  return "/api/admin/jobs/unknown/retry";
}

async function refreshRecoveryViews() {
  const page = getPageFromHash();
  if (page === "monitoring") await refreshMonitoring();
  if (page === "jobs") await refreshJobHistory();
}

function showRecoveryMessage(message, isError) {
  if (els.systemStatus) {
    els.systemStatus.textContent = message;
    els.systemStatus.classList.toggle("danger", isError);
    window.setTimeout(() => {
      els.systemStatus.classList.remove("danger");
      refreshSystemStatus();
    }, 3500);
  }
  if (isError) console.warn(message);
}

function getProductionStatusText(status) {
  const normalized = String(status || "unknown").toLowerCase();
  const labels = {
    approved: "อนุมัติแล้ว",
    awaiting_support_review: "รอตรวจภาพเสริม",
    candidate_manifest_ready: "ชุดภาพพร้อมส่งออก",
    completed: "เสร็จแล้ว",
    done: "เสร็จแล้ว",
    draft: "ฉบับร่าง",
    exported: "ส่งออกแล้ว",
    export_failed: "ส่งออกไม่สำเร็จ",
    failed: "ไม่สำเร็จ",
    generating: "กำลังสร้าง",
    google_drive: "ส่งเข้า Google Drive แล้ว",
    hero_ready: "ภาพหลักพร้อมตรวจ",
    no_generation: "ยังไม่สร้าง",
    no_hero: "ยังไม่มีภาพหลัก",
    no_support: "ยังไม่มีภาพเสริม",
    not_exported: "ยังไม่ส่งออก",
    not_started: "ยังไม่เริ่ม",
    pending: "รอดำเนินการ",
    queued: "รอคิว",
    ready: "พร้อม",
    regenerate_requested: "ขอสร้างใหม่",
    running: "กำลังทำงาน",
    succeeded: "เสร็จแล้ว",
    support_ready_for_review: "ภาพเสริมพร้อมตรวจ"
  };
  return labels[normalized] || String(status || "ไม่ทราบสถานะ").replace(/_/g, " ");
}

function renderStatusBadge(status, label = "") {
  const normalized = String(status || "unknown").toLowerCase();
  const state = normalized.includes("failed") ? "danger" : normalized.includes("pending") || normalized.includes("queued") || normalized.includes("no_") || normalized.includes("not_") ? "warning" : "ok";
  const statusText = getProductionStatusText(status);
  return `<span class="production-badge ${state}">${escapeHtml(label ? `${label}: ${statusText}` : statusText)}</span>`;
}

function formatAssetTypeLabel(typeGroup, rawType) {
  const labels = {
    reference: "ภาพอ้างอิง",
    hero: "ภาพหลัก",
    support: "ภาพเสริม",
    approved: "ภาพที่อนุมัติหรือส่งออกแล้ว",
    other: rawType || "ไฟล์ภาพ"
  };
  return labels[typeGroup] || rawType || "ไฟล์ภาพ";
}

function setProductionListLoading(kind, isLoading) {
  if (kind === "jobs") {
    if (els.jobsLoadingState) els.jobsLoadingState.hidden = !isLoading;
    if (els.refreshJobsButton) els.refreshJobsButton.disabled = isLoading;
    if (els.jobsPageSize) els.jobsPageSize.disabled = isLoading;
    if (els.jobsPrevPage) els.jobsPrevPage.disabled = isLoading || !(latestJobsData?.pagination?.hasPrev);
    if (els.jobsNextPage) els.jobsNextPage.disabled = isLoading || !(latestJobsData?.pagination?.hasNext);
  }
  if (kind === "assets") {
    if (els.assetsLoadingState) els.assetsLoadingState.hidden = !isLoading;
    if (els.assetsPageSize) els.assetsPageSize.disabled = isLoading;
    if (els.assetsPrevPage) els.assetsPrevPage.disabled = isLoading || !(latestAssetsData?.pagination?.hasPrev);
    if (els.assetsNextPage) els.assetsNextPage.disabled = isLoading || !(latestAssetsData?.pagination?.hasNext);
  }
}

function normalizeProductionPageSize(value) {
  const size = Number.parseInt(String(value || "10"), 10);
  return [10, 50, 100].includes(size) ? size : 10;
}

function renderProductionPagination(kind, pagination) {
  const isJobs = kind === "jobs";
  const page = pagination?.page || (isJobs ? selectedJobsPage : selectedAssetsPage) || 1;
  const pageSize = pagination?.pageSize || (isJobs ? selectedJobsPageSize : selectedAssetsPageSize) || 10;
  const totalItems = pagination?.totalItems || 0;
  const totalPages = pagination?.totalPages || 1;
  if (isJobs) {
    selectedJobsPage = page;
    selectedJobsPageSize = pageSize;
    if (els.jobsPageSize) els.jobsPageSize.value = String(pageSize);
    if (els.jobsPageInfo) els.jobsPageInfo.textContent = `หน้า ${formatThaiNumber(page)} / ${formatThaiNumber(totalPages)} · ${formatThaiNumber(totalItems)} รายการ`;
    if (els.jobsPrevPage) els.jobsPrevPage.disabled = !pagination?.hasPrev;
    if (els.jobsNextPage) els.jobsNextPage.disabled = !pagination?.hasNext;
    return;
  }
  selectedAssetsPage = page;
  selectedAssetsPageSize = pageSize;
  if (els.assetsPageSize) els.assetsPageSize.value = String(pageSize);
  if (els.assetsPageInfo) els.assetsPageInfo.textContent = `หน้า ${formatThaiNumber(page)} / ${formatThaiNumber(totalPages)} · ${formatThaiNumber(totalItems)} รายการ`;
  if (els.assetsPrevPage) els.assetsPrevPage.disabled = !pagination?.hasPrev;
  if (els.assetsNextPage) els.assetsNextPage.disabled = !pagination?.hasNext;
}

async function refreshMetrics() {
  if (!els.kpiCards || !isAppReady()) return;

  try {
    setKpiLoading(true);
    const response = await authFetch(`/api/kpi/summary?range=${encodeURIComponent(selectedKpiRange)}`);
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Cannot load KPI Dashboard");

    latestMetricData = data;
    renderMetricsFromCache();
  } catch (error) {
    renderKpiError(error);
  } finally {
    setKpiLoading(false);
  }
}

function renderMetricsFromCache() {
  if (!latestMetricData) return;

  const summary = latestMetricData.summary || {};
  const hasData = Boolean(summary.totalJobs || summary.generated || summary.approved || summary.failed);
  els.kpiErrorState.hidden = true;
  els.kpiEmptyState.hidden = hasData;
  els.kpiExecutiveSummary.textContent = latestMetricData.executiveSummary || "ยังไม่มีข้อมูลในช่วงเวลานี้";
  els.kpiUpdatedAt.textContent = latestMetricData.generatedAt
    ? `อัปเดต ${formatDateTime(latestMetricData.generatedAt)}`
    : "รอข้อมูลล่าสุด";

  renderKpiWarnings(latestMetricData.warnings || []);
  renderKpiCards(summary);
  renderTrendChart(latestMetricData.trends || []);
  renderWorkflowFunnel(latestMetricData.funnel || []);
  renderStatusBreakdown(latestMetricData.statusBreakdown || []);
  renderStaffPerformance(latestMetricData.staffPerformance || []);
  renderRecentActivity(latestMetricData.recentActivity || []);
}

function setKpiLoading(isLoading) {
  if (els.kpiLoadingState) els.kpiLoadingState.hidden = !isLoading;
  if (els.refreshMetricsButton) els.refreshMetricsButton.disabled = isLoading;
}

function renderKpiError(error) {
  latestMetricData = null;
  els.kpiErrorState.hidden = false;
  els.kpiErrorState.textContent = `โหลด KPI Dashboard ไม่สำเร็จ: ${getSafeAuthErrorMessage(error) || "กรุณาลองใหม่อีกครั้ง"}`;
  els.kpiEmptyState.hidden = true;
  els.kpiExecutiveSummary.textContent = "ระบบยังโหลด KPI ไม่สำเร็จ แต่หน้าอื่นยังใช้งานได้ตามปกติ";
  els.kpiUpdatedAt.textContent = "โหลดไม่สำเร็จ";
  [els.kpiWarnings, els.kpiCards, els.kpiTrendChart, els.kpiFunnel, els.kpiStatusBreakdown, els.kpiStaffPerformance, els.kpiRecentActivity].forEach((target) => {
    if (target) target.innerHTML = "";
  });
}

function renderKpiWarnings(warnings) {
  if (!warnings.length) {
    els.kpiWarnings.innerHTML = '<div class="warning-item ok">ระบบไม่พบ warning สำคัญในช่วงเวลานี้</div>';
    return;
  }
  els.kpiWarnings.innerHTML = warnings
    .map((warning) => `<div class="warning-item">${escapeHtml(warning.message || "มี warning ที่ต้องตรวจสอบ")}</div>`)
    .join("");
}

function renderKpiCards(summary) {
  const cards = [
    ["งานทั้งหมด", summary.totalJobs, "จำนวนงานทั้งหมดในช่วงเวลาที่เลือก"],
    ["สร้างภาพสำเร็จ", summary.generated, "จำนวนงานที่สร้างภาพสำเร็จ"],
    ["อนุมัติแล้ว", summary.approved, "จำนวนงานที่ผ่านการอนุมัติแล้ว"],
    ["รออนุมัติ", summary.pendingApproval, "งานที่สร้างภาพแล้วแต่ยังไม่อนุมัติ"],
    ["ไม่สำเร็จ", summary.failed, "งานหรือการสร้างภาพที่ไม่สำเร็จ"],
    ["อัตราอนุมัติ", formatPercent(summary.approvalRate), "งานที่อนุมัติเทียบกับงานที่สร้างภาพสำเร็จ"],
    ["อัตราผ่านตรวจ", formatPercent(summary.qcPassRate), "งานที่ผ่านการตรวจเทียบกับงานที่ตรวจแล้ว"],
    ["เวลาเฉลี่ยต่อรอบ", formatMinutes(summary.averageTurnaroundMinutes), "เวลาจากสร้างงานถึงอนุมัติหรือส่งออก"],
    ["ผู้ใช้งานที่ทำงาน", summary.activeStaff, "จำนวนพนักงานที่มี activity ในช่วงเวลานี้"]
  ];

  els.kpiCards.innerHTML = cards
    .map(([label, value, helper]) => `
      <section class="kpi-card">
        <strong>${escapeHtml(label)}</strong>
        <div class="kpi-number">${escapeHtml(formatKpiValue(value))}</div>
        <p>${escapeHtml(helper)}</p>
      </section>
    `)
    .join("");
}

function renderTrendChart(trends) {
  if (!trends.length) {
    els.kpiTrendChart.innerHTML = '<div class="empty-state">ยังไม่มีข้อมูลในช่วงเวลานี้</div>';
    return;
  }

  const maxValue = Math.max(1, ...trends.flatMap((item) => [item.jobs, item.generated, item.approved, item.exported, item.failed].map(Number)));
  els.kpiTrendChart.innerHTML = `
    <div class="trend-legend">
      <span class="jobs">งานทั้งหมด</span>
      <span class="generated">สร้างสำเร็จ</span>
      <span class="approved">อนุมัติแล้ว</span>
      <span class="failed">ไม่สำเร็จ</span>
    </div>
    <div class="trend-bars">
      ${trends
        .map((item) => {
          const label = String(item.date || "").slice(5);
          return `
            <div class="trend-day">
              <div class="trend-stack" title="${escapeHtml(item.date || "")}">
                ${renderTrendBar("jobs", item.jobs, maxValue)}
                ${renderTrendBar("generated", item.generated, maxValue)}
                ${renderTrendBar("approved", item.approved + item.exported, maxValue)}
                ${renderTrendBar("failed", item.failed, maxValue)}
              </div>
              <span>${escapeHtml(label)}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderTrendBar(className, value, maxValue) {
  const height = Math.max(Number(value || 0) ? 8 : 0, Math.round((Number(value || 0) / maxValue) * 120));
  return `<i class="${className}" style="height:${height}px"></i>`;
}

function renderWorkflowFunnel(funnel) {
  if (!funnel.length) {
    els.kpiFunnel.innerHTML = '<div class="empty-state">ยังไม่มีข้อมูลในช่วงเวลานี้</div>';
    return;
  }

  const maxValue = Math.max(1, ...funnel.map((stage) => Number(stage.value || 0)));
  els.kpiFunnel.innerHTML = funnel
    .map((stage) => {
      const percent = stage.percentOfCreated === null || stage.percentOfCreated === undefined ? "ยังไม่มีข้อมูลเพียงพอ" : `${stage.percentOfCreated}% of created`;
      const width = Math.max(4, Math.round((Number(stage.value || 0) / maxValue) * 100));
      return `
        <div class="funnel-row">
          <div>
            <strong>${escapeHtml(stage.label)}</strong>
            <span>${stage.calculable ? escapeHtml(percent) : "ยังไม่มีข้อมูลเพียงพอ"}</span>
          </div>
          <div class="funnel-meter"><span style="width:${width}%"></span></div>
          <b>${formatThaiNumber(stage.value)}</b>
        </div>
      `;
    })
    .join("");
}

function renderStatusBreakdown(items) {
  if (!items.length) {
    els.kpiStatusBreakdown.innerHTML = '<div class="empty-state">ยังไม่มีข้อมูลในช่วงเวลานี้</div>';
    return;
  }

  els.kpiStatusBreakdown.innerHTML = `
    <div class="status-list">
      ${items
        .map((item) => `
          <div class="status-row">
            <strong>${escapeHtml(item.status)}</strong>
            <span>${formatThaiNumber(item.total)} รวม</span>
            <small>${formatThaiNumber(item.jobs)} jobs / ${formatThaiNumber(item.generations)} generations</small>
          </div>
        `)
        .join("")}
    </div>
  `;
}

function renderStaffPerformance(items) {
  if (!items.length) {
    els.kpiStaffPerformance.innerHTML = '<div class="empty-state">ยังไม่มีข้อมูลเพียงพอ</div>';
    return;
  }

  els.kpiStaffPerformance.innerHTML = `
    <div class="staff-list">
      ${items
        .map((item) => `
          <div class="staff-row">
            <div>
              <strong>${escapeHtml(item.name || item.email || "ไม่ระบุผู้ใช้งาน")}</strong>
              <span>${escapeHtml(item.email || item.role || "")}</span>
            </div>
            <div class="staff-metrics">
              <span>${formatThaiNumber(item.jobsCreated)} jobs</span>
              <span>${formatThaiNumber(item.generationsCreated)} gen</span>
              <span>${formatThaiNumber(item.approvalsCompleted)} approve</span>
              <span>${formatThaiNumber(item.successCount)} success / ${formatThaiNumber(item.failCount)} fail</span>
            </div>
            <small>${item.latestActivity ? formatDateTime(item.latestActivity) : "ยังไม่มีข้อมูลล่าสุด"}</small>
          </div>
        `)
        .join("")}
    </div>
  `;
}

function renderRecentActivity(items) {
  if (!items.length) {
    els.kpiRecentActivity.innerHTML = '<div class="empty-state">ยังไม่มีข้อมูลในช่วงเวลานี้</div>';
    return;
  }

  els.kpiRecentActivity.innerHTML = `
    <div class="activity-list">
      ${items
        .map((item) => `
          <div class="activity-row">
            <time>${formatDateTime(item.timestamp)}</time>
            <strong>${escapeHtml(item.user || "ไม่ระบุผู้ใช้งาน")}</strong>
            <span>${escapeHtml(item.action || "activity")}</span>
            <small>${escapeHtml(item.status || "recorded")}${item.jobId ? ` · Job ${escapeHtml(shortId(item.jobId))}` : ""}${item.generationId ? ` · Gen ${escapeHtml(shortId(item.generationId))}` : ""}</small>
          </div>
        `)
        .join("")}
    </div>
  `;
}

async function refreshCosts() {
  if (!isAppReady() || !isAdmin() || !els.costKpiCards) return;
  setCostLoading(true);
  try {
    const params = new URLSearchParams({
      range: selectedCostRange,
      page: String(selectedCostPage),
      pageSize: String(selectedCostPageSize)
    });
    const response = await authFetch(`/api/admin/costs?${params.toString()}`);
    const data = await readCostApiJson(response);
    if (!response.ok || !data.ok) {
      throw new Error(getApiErrorMessage(response, data, "โหลด Cost / Usage Tracking ไม่สำเร็จ"));
    }
    latestCostData = data;
    selectedCostPage = data.pagination?.page || selectedCostPage;
    selectedCostPageSize = data.pagination?.pageSize || selectedCostPageSize;
    renderCostsFromCache();
  } catch (error) {
    renderCostError(error);
  } finally {
    setCostLoading(false);
  }
}

async function readCostApiJson(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    await response.text().catch(() => "");
    throw new Error("Cost API ไม่ได้ส่ง JSON กลับมา กรุณาตรวจสอบ endpoint /api/admin/costs");
  }
  return response.json();
}

function renderCostsFromCache() {
  if (!latestCostData) return;
  const summary = latestCostData.summary || {};
  const hasData = Boolean(summary.totalGenerations || summary.estimatedTotalCost);

  els.costErrorState.hidden = true;
  els.costEmptyState.hidden = hasData;
  els.costExecutiveSummary.textContent = latestCostData.executiveSummary || "ยังไม่มีข้อมูลต้นทุนในช่วงเวลานี้";
  els.costUpdatedAt.textContent = latestCostData.generatedAt
    ? `อัปเดต ${formatDateTime(latestCostData.generatedAt)}`
    : "รอข้อมูลล่าสุด";

  renderCostNotes(latestCostData.notes || []);
  renderCostKpiCards(summary);
  renderCostTrendChart(latestCostData.trends || [], summary.currency || latestCostData.costModel?.currency || "USD");
  renderCostWasteSummary(summary);
  renderCostStaffUsage(latestCostData.staffUsage || [], summary.currency || "USD");
  renderCostJobList(latestCostData.jobCosts || [], summary.currency || "USD");
  renderCostRecentEvents(latestCostData.recentCostEvents || []);
  renderCostPagination(latestCostData.pagination);
}

function setCostLoading(isLoading) {
  if (els.costLoadingState) els.costLoadingState.hidden = !isLoading;
  if (els.refreshCostsButton) els.refreshCostsButton.disabled = isLoading;
  if (els.costPageSize) els.costPageSize.disabled = isLoading;
  if (els.costPrevPage) els.costPrevPage.disabled = isLoading || !(latestCostData?.pagination?.hasPrev);
  if (els.costNextPage) els.costNextPage.disabled = isLoading || !(latestCostData?.pagination?.hasNext);
}

function renderCostError(error) {
  latestCostData = null;
  els.costErrorState.hidden = false;
  els.costErrorState.textContent = `โหลด Cost / Usage Tracking ไม่สำเร็จ: ${getSafeAuthErrorMessage(error) || "กรุณาลองใหม่อีกครั้ง"}`;
  els.costEmptyState.hidden = true;
  els.costExecutiveSummary.textContent = "ระบบยังโหลด Cost / Usage ไม่สำเร็จ แต่หน้าอื่นยังใช้งานได้ตามปกติ";
  els.costUpdatedAt.textContent = "โหลดไม่สำเร็จ";
  [els.costNotes, els.costKpiCards, els.costTrendChart, els.costWasteSummary, els.costStaffUsage, els.costJobList, els.costRecentEvents].forEach((target) => {
    if (target) target.innerHTML = "";
  });
  renderCostPagination(null);
}

function renderCostPagination(pagination) {
  const page = pagination?.page || selectedCostPage || 1;
  const pageSize = pagination?.pageSize || selectedCostPageSize || 10;
  const totalItems = pagination?.totalItems || 0;
  const totalPages = pagination?.totalPages || 1;
  selectedCostPage = page;
  selectedCostPageSize = pageSize;
  if (els.costPageSize) els.costPageSize.value = String(pageSize);
  if (els.costPageInfo) {
    els.costPageInfo.textContent = `หน้า ${formatThaiNumber(page)} / ${formatThaiNumber(totalPages)} · ${formatThaiNumber(totalItems)} รายการ`;
  }
  if (els.costPrevPage) els.costPrevPage.disabled = !pagination?.hasPrev;
  if (els.costNextPage) els.costNextPage.disabled = !pagination?.hasNext;
}

function renderCostNotes(notes) {
  const safeNotes = notes.length ? notes : ["ตัวเลขนี้เป็น estimated cost จากจำนวน generation และราคาที่ตั้งค่าไว้ในระบบ ไม่ใช่ invoice จริง"];
  els.costNotes.innerHTML = safeNotes
    .slice(0, 4)
    .map((note, index) => `<div class="warning-item ${index === 0 ? "ok" : ""}">${escapeHtml(note)}</div>`)
    .join("");
}

function renderCostKpiCards(summary) {
  const currency = summary.currency || "USD";
  const cards = [
    ["ต้นทุนโดยประมาณทั้งหมด", formatEstimatedCost(summary.estimatedTotalCost, currency), "ต้นทุนโดยประมาณทั้งหมด ไม่ใช่ invoice จริง"],
    ["จำนวนครั้งที่สร้างภาพ", summary.totalGenerations, "จำนวน generation request ในช่วงเวลานี้"],
    ["สร้างภาพสำเร็จ", summary.successfulGenerations, "จำนวน generation ที่สำเร็จ"],
    ["สร้างภาพไม่สำเร็จ", summary.failedGenerations, "จำนวน generation ที่ไม่สำเร็จหรือมี error"],
    ["ลองใหม่", summary.retryGenerations, "จำนวน generation ที่มาจาก retry/recovery"],
    ["ต้นทุนจากการลองใหม่", formatEstimatedCost(summary.estimatedRetryCost, currency), "ต้นทุนโดยประมาณจาก retry"],
    ["ต้นทุนงานไม่สำเร็จ", formatEstimatedCost(summary.estimatedFailedCost, currency), "ต้นทุนโดยประมาณจาก generation ที่ไม่สำเร็จ"],
    ["ภาพที่อนุมัติแล้ว", summary.approvedOutputs, "ภาพที่อนุมัติหรือส่งออกแล้ว"],
    ["ต้นทุนเฉลี่ยต่อภาพอนุมัติ", summary.averageCostPerApprovedOutput === null ? null : formatEstimatedCost(summary.averageCostPerApprovedOutput, currency), "ต้นทุนโดยประมาณต่อภาพที่อนุมัติแล้ว"],
    ["ต้นทุนเฉลี่ยต่องาน", summary.averageCostPerJob === null ? null : formatEstimatedCost(summary.averageCostPerJob, currency), "ต้นทุนโดยประมาณต่องานที่มีการสร้างภาพ"]
  ];

  els.costKpiCards.innerHTML = cards
    .map(([label, value, helper]) => `
      <section class="kpi-card">
        <strong>${escapeHtml(label)}</strong>
        <div class="kpi-number">${escapeHtml(formatKpiValue(value))}</div>
        <p>${escapeHtml(helper)}</p>
      </section>
    `)
    .join("");
}

function renderCostTrendChart(trends, currency) {
  if (!trends.length) {
    els.costTrendChart.innerHTML = '<div class="empty-state">ยังไม่มีข้อมูลต้นทุนในช่วงเวลานี้</div>';
    return;
  }

  const maxValue = Math.max(1, ...trends.flatMap((item) => [item.generations, item.failed, item.retry, item.estimatedCost].map(Number)));
  els.costTrendChart.innerHTML = `
    <div class="trend-legend cost-trend-legend">
      <span class="generated">สร้างภาพ</span>
      <span class="failed">ไม่สำเร็จ</span>
      <span class="retry">ลองใหม่</span>
      <span class="cost">ต้นทุนประมาณ</span>
    </div>
    <div class="trend-bars">
      ${trends
        .map((item) => `
          <div class="trend-day">
            <div class="trend-stack" title="${escapeHtml(`${item.date} · ${formatEstimatedCost(item.estimatedCost, currency)}`)}">
              ${renderTrendBar("generated", item.generations, maxValue)}
              ${renderTrendBar("failed", item.failed, maxValue)}
              ${renderTrendBar("retry", item.retry, maxValue)}
              ${renderTrendBar("cost", item.estimatedCost, maxValue)}
            </div>
            <span>${escapeHtml(String(item.date || "").slice(5))}</span>
          </div>
        `)
        .join("")}
    </div>
  `;
}

function renderCostWasteSummary(summary) {
  const currency = summary.currency || "USD";
  const retryShare = summary.estimatedTotalCost ? Math.round((Number(summary.estimatedRetryCost || 0) / summary.estimatedTotalCost) * 1000) / 10 : null;
  const failedShare = summary.estimatedTotalCost ? Math.round((Number(summary.estimatedFailedCost || 0) / summary.estimatedTotalCost) * 1000) / 10 : null;
  els.costWasteSummary.innerHTML = `
    <div class="status-list">
      <div class="status-row danger-row">
        <strong>ต้นทุนงานไม่สำเร็จ</strong>
        <span>${escapeHtml(formatEstimatedCost(summary.estimatedFailedCost, currency))}</span>
        <small>${failedShare === null ? "ยังไม่มีข้อมูลเพียงพอสำหรับคำนวณต้นทุนจริง" : `${failedShare}% ของต้นทุนประมาณทั้งหมด`}</small>
      </div>
      <div class="status-row warning-row">
        <strong>ต้นทุนจากการลองใหม่</strong>
        <span>${escapeHtml(formatEstimatedCost(summary.estimatedRetryCost, currency))}</span>
        <small>${retryShare === null ? "ยังไม่มีข้อมูลเพียงพอสำหรับคำนวณผลกระทบจากการลองใหม่" : `${retryShare}% ของต้นทุนประมาณทั้งหมด`}</small>
      </div>
      <div class="status-row">
        <strong>ต้นทุนเฉลี่ยต่อภาพที่อนุมัติ</strong>
        <span>${summary.averageCostPerApprovedOutput === null ? "ยังไม่มีข้อมูลเพียงพอ" : escapeHtml(formatEstimatedCost(summary.averageCostPerApprovedOutput, currency))}</span>
        <small>ต้นทุนโดยประมาณต่อภาพที่อนุมัติแล้ว</small>
      </div>
    </div>
  `;
}

function renderCostStaffUsage(items, currency) {
  if (!items.length) {
    els.costStaffUsage.innerHTML = '<div class="empty-state">ยังไม่มีข้อมูลต้นทุนในช่วงเวลานี้</div>';
    return;
  }
  els.costStaffUsage.innerHTML = `
    <div class="staff-list">
      ${items
        .map((item) => `
          <div class="staff-row">
            <div>
              <strong>${escapeHtml(item.name || item.email || "ไม่ระบุผู้ใช้งาน")}</strong>
              <span>${escapeHtml(item.email || "")}</span>
            </div>
            <div class="staff-metrics">
              <span>สร้าง ${formatThaiNumber(item.generations)} ครั้ง</span>
              <span>สำเร็จ ${formatThaiNumber(item.successful)}</span>
              <span>ไม่สำเร็จ ${formatThaiNumber(item.failed)}</span>
              <span>ลองใหม่ ${formatThaiNumber(item.retryCount)}</span>
              <span>อนุมัติ ${formatThaiNumber(item.approvedOutputs)}</span>
              <span>${escapeHtml(formatEstimatedCost(item.estimatedCost, currency))}</span>
            </div>
            <small>${item.latestActivity ? formatDateTime(item.latestActivity) : "ยังไม่มีข้อมูลล่าสุด"}</small>
          </div>
        `)
        .join("")}
    </div>
  `;
}

function renderCostJobList(items, currency) {
  if (!items.length) {
    els.costJobList.innerHTML = '<div class="empty-state">ยังไม่มีข้อมูลต้นทุนในช่วงเวลานี้</div>';
    return;
  }
  els.costJobList.innerHTML = `
    <div class="cost-job-list">
      ${items
        .map((job) => `
          <article class="cost-job-card">
            <div>
              <strong>${escapeHtml(job.sku || job.productName || "Untitled product")}</strong>
              <span>งาน ${escapeHtml(job.jobShortId || "-")} · ${escapeHtml(getProductionStatusText(job.status || "unknown"))}</span>
              <small>${escapeHtml(job.createdBy?.name || job.createdBy?.email || "ไม่ระบุผู้ใช้งาน")}</small>
            </div>
            <div class="staff-metrics">
              <span>สร้าง ${formatThaiNumber(job.generationCount)} ครั้ง</span>
              <span>ลองใหม่ ${formatThaiNumber(job.retryCount)}</span>
              <span>ไม่สำเร็จ ${formatThaiNumber(job.failed)}</span>
              <span>ภาพอนุมัติ ${formatThaiNumber(job.approvedOutputs)}</span>
              <span>${escapeHtml(getProductionStatusText(job.exportStatus || "not_exported"))}</span>
            </div>
            <div class="cost-job-total">
              <strong>${escapeHtml(formatEstimatedCost(job.estimatedCost, currency))}</strong>
              <span>${job.averageCostPerOutput === null ? "เฉลี่ยต่อภาพ: ยังไม่มีข้อมูล" : `เฉลี่ยต่อภาพ: ${escapeHtml(formatEstimatedCost(job.averageCostPerOutput, currency))}`}</span>
            </div>
          </article>
        `)
        .join("")}
    </div>
  `;
}

function renderCostRecentEvents(items) {
  if (!items.length) {
    els.costRecentEvents.innerHTML = '<div class="empty-state">ยังไม่มีข้อมูลต้นทุนในช่วงเวลานี้</div>';
    return;
  }
  els.costRecentEvents.innerHTML = `
    <div class="monitoring-list compact">
      ${items
        .map((item) => `
          <article class="monitoring-row ${item.failure ? "danger" : item.retry ? "warning" : "neutral"}">
            <div class="monitoring-row-main">
              <time>${escapeHtml(formatDateTime(item.time))}</time>
              <strong>${escapeHtml(item.eventType || "usage")} · ${escapeHtml(item.status || "recorded")}</strong>
              <span>${escapeHtml(item.user || item.email || "ไม่ระบุผู้ใช้งาน")}</span>
            </div>
            <div class="monitoring-row-detail">
              <span>${item.jobId ? `Job ${escapeHtml(item.jobShortId || shortId(item.jobId))}` : "Job -"}</span>
              <span>${item.generationId ? `Gen ${escapeHtml(item.generationShortId || shortId(item.generationId))}` : "Gen -"}</span>
              <span>${escapeHtml(formatEstimatedCost(item.estimatedCost, item.currency || "USD"))}</span>
              <span>${escapeHtml(item.provider || "-")} / ${escapeHtml(item.model || "-")}</span>
            </div>
          </article>
        `)
        .join("")}
    </div>
  `;
}

async function refreshMonitoring() {
  if (!isAppReady() || !isAdmin()) return;
  setMonitoringLoading(true);
  try {
    const params = new URLSearchParams({
      range: selectedMonitoringRange,
      page: String(selectedMonitoringPage),
      pageSize: String(selectedMonitoringPageSize)
    });
    const response = await authFetch(`/api/admin/monitoring?${params.toString()}`);
    const data = await readMonitoringApiJson(response);
    if (!response.ok || !data.ok) {
      throw new Error(getApiErrorMessage(response, data, "โหลด Monitoring ไม่สำเร็จ"));
    }
    latestMonitoringData = data;
    selectedMonitoringPage = data.pagination?.page || selectedMonitoringPage;
    selectedMonitoringPageSize = data.pagination?.pageSize || selectedMonitoringPageSize;
    renderMonitoringFromCache();
  } catch (error) {
    renderMonitoringError(error);
  } finally {
    setMonitoringLoading(false);
  }
}

async function readMonitoringApiJson(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    await response.text().catch(() => "");
    throw new Error("Monitoring API ไม่ได้ส่ง JSON กลับมา กรุณาตรวจสอบ endpoint /api/admin/monitoring");
  }
  return response.json();
}

function normalizeMonitoringPageSize(value) {
  const size = Number.parseInt(String(value || "10"), 10);
  return [10, 50, 100].includes(size) ? size : 10;
}

function renderMonitoringFromCache() {
  if (!latestMonitoringData) return;

  const summary = latestMonitoringData.summary || {};
  const warnings = latestMonitoringData.warnings || [];
  const actionableWarnings = warnings.filter((warning) => warning.code !== "no_recent_activity");
  const hasProblem = Boolean(
    summary.totalErrors ||
    summary.failedJobs ||
    summary.failedGenerations ||
    summary.failedExports ||
    summary.stuckJobs ||
    summary.storageFailures ||
    summary.approvalFailures ||
    actionableWarnings.length
  );

  els.monitoringErrorState.hidden = true;
  els.monitoringEmptyState.hidden = hasProblem;
  els.monitoringHealthSummary.textContent = buildMonitoringHealthSummary(latestMonitoringData);
  els.monitoringUpdatedAt.textContent = latestMonitoringData.generatedAt
    ? `อัปเดต ${formatDateTime(latestMonitoringData.generatedAt)}`
    : "รอข้อมูลล่าสุด";

  renderMonitoringWarnings(warnings);
  renderMonitoringSummaryCards(latestMonitoringData);
  renderMonitoringPagination(latestMonitoringData.pagination);
  renderMonitoringIntegrationHealth(latestMonitoringData.integrationHealth?.googleDrive);
  renderMonitoringStuckJobs(latestMonitoringData.stuckJobs || []);
  renderMonitoringFailedItems(latestMonitoringData.failedItems || []);
  renderMonitoringWordPressPreflights(latestMonitoringData.wordpressPreflights || []);
  renderMonitoringRecentEvents(latestMonitoringData.recentSystemEvents || []);
}

function setMonitoringLoading(isLoading) {
  if (els.monitoringLoadingState) els.monitoringLoadingState.hidden = !isLoading;
  if (els.refreshMonitoringButton) els.refreshMonitoringButton.disabled = isLoading;
  if (els.monitoringPageSize) els.monitoringPageSize.disabled = isLoading;
  if (els.monitoringPrevPage) els.monitoringPrevPage.disabled = isLoading || !(latestMonitoringData?.pagination?.hasPrev);
  if (els.monitoringNextPage) els.monitoringNextPage.disabled = isLoading || !(latestMonitoringData?.pagination?.hasNext);
}

function renderMonitoringError(error) {
  latestMonitoringData = null;
  els.monitoringErrorState.hidden = false;
  els.monitoringErrorState.textContent = `โหลดสถานะระบบไม่สำเร็จ: ${getSafeAuthErrorMessage(error) || "กรุณาลองใหม่อีกครั้ง"}`;
  els.monitoringEmptyState.hidden = true;
  els.monitoringHealthSummary.textContent = "ระบบยังโหลดสถานะระบบไม่สำเร็จ แต่หน้าอื่นยังใช้งานได้ตามปกติ";
  els.monitoringUpdatedAt.textContent = "โหลดไม่สำเร็จ";
  [
    els.monitoringWarnings,
    els.monitoringSummaryCards,
    els.monitoringIntegrationHealth,
    els.monitoringStuckJobs,
    els.monitoringFailedItems,
    els.monitoringWordPressPreflights,
    els.monitoringRecentEvents
  ].forEach((target) => {
    if (target) target.innerHTML = "";
  });
  renderMonitoringPagination(null);
}

function renderMonitoringPagination(pagination) {
  const page = pagination?.page || selectedMonitoringPage || 1;
  const pageSize = pagination?.pageSize || selectedMonitoringPageSize || 10;
  const totalItems = pagination?.totalItems || 0;
  const totalPages = pagination?.totalPages || 1;
  selectedMonitoringPage = page;
  selectedMonitoringPageSize = pageSize;
  if (els.monitoringPageSize) els.monitoringPageSize.value = String(pageSize);
  if (els.monitoringPageInfo) {
    els.monitoringPageInfo.textContent = `หน้า ${formatThaiNumber(page)} / ${formatThaiNumber(totalPages)} · ${formatThaiNumber(totalItems)} รายการ`;
  }
  if (els.monitoringPrevPage) els.monitoringPrevPage.disabled = !pagination?.hasPrev;
  if (els.monitoringNextPage) els.monitoringNextPage.disabled = !pagination?.hasNext;
}

function buildMonitoringHealthSummary(data) {
  const summary = data.summary || {};
  const driveConnected = data.integrationHealth?.googleDrive?.connected === true;
  if (summary.totalErrors || summary.stuckJobs) {
    return `พบปัญหาที่ต้องตรวจสอบ ${formatThaiNumber(summary.totalErrors || 0)} รายการ และงานค้าง ${formatThaiNumber(summary.stuckJobs || 0)} รายการ`;
  }
  if (summary.storageWarnings) {
    return `มี Supabase Storage warning ${formatThaiNumber(summary.storageWarnings)} รายการ แต่ Google Drive export สำเร็จแล้ว`;
  }
  if (!driveConnected) return "Google Drive ยังไม่ได้เชื่อมต่อ กรุณาให้ Admin เชื่อมต่อก่อน";
  if (summary.pendingApprovals) return `ระบบทำงานได้ แต่มีงานรออนุมัติ ${formatThaiNumber(summary.pendingApprovals)} รายการ`;
  return "ยังไม่พบปัญหาในช่วงเวลานี้";
}

function renderMonitoringWarnings(warnings) {
  const visibleWarnings = warnings.filter((warning) => warning.code !== "no_recent_activity");
  if (!visibleWarnings.length) {
    els.monitoringWarnings.innerHTML = '<div class="warning-item ok">ยังไม่พบปัญหาในช่วงเวลานี้</div>';
    return;
  }
  els.monitoringWarnings.innerHTML = visibleWarnings
    .map((warning) => `<div class="warning-item ${monitoringWarningClass(warning.code)}">${escapeHtml(warning.message || "มี warning ที่ต้องตรวจสอบ")}</div>`)
    .join("");
}

function monitoringWarningClass(code) {
  const value = String(code || "");
  if (value.includes("storage_resolved")) return "warning";
  if (value.includes("failed") || value.includes("failure") || value.includes("storage") || value.includes("stuck")) return "danger";
  return "";
}

function renderMonitoringSummaryCards(data) {
  const summary = data.summary || {};
  const drive = data.integrationHealth?.googleDrive || {};
  const cards = [
    ["คำเตือน / ข้อผิดพลาด", summary.warningsCount, "จำนวน warning และ error ที่ต้องตรวจสอบ", summary.warningsCount ? "warning" : "ok"],
    ["งานไม่สำเร็จ", summary.failedJobs, "งานที่สถานะไม่สำเร็จ", summary.failedJobs ? "danger" : "ok"],
    ["สร้างภาพไม่สำเร็จ", summary.failedGenerations, "generation ที่ไม่สำเร็จหรือมี error_message", summary.failedGenerations ? "danger" : "ok"],
    ["ส่งออกไม่สำเร็จ", summary.failedExports, "Google Drive/export failure จาก audit events", summary.failedExports ? "danger" : "ok"],
    ["คำเตือน Storage", summary.storageWarnings, "Supabase Storage ไม่สำเร็จ แต่ Google Drive export สำเร็จแล้ว", summary.storageWarnings ? "warning" : "ok"],
    ["งานค้าง", summary.stuckJobs, "งานที่รอคิวหรือกำลังสร้างเกิน 30 นาที", summary.stuckJobs ? "warning" : "ok"],
    ["รออนุมัติ", summary.pendingApprovals, "สร้างภาพสำเร็จแต่ยังไม่อนุมัติ", summary.pendingApprovals ? "warning" : "ok"],
    ["ด่านตรวจก่อนส่งออก", summary.wordpressPreflights, "WordPress product/media preflight ที่รอหรือเสร็จในช่วงนี้", summary.wordpressPreflights ? "warning" : "ok"],
    ["Google Drive", drive.connected ? "เชื่อมต่อแล้ว" : "ยังไม่เชื่อมต่อ", drive.updatedAt ? `อัปเดตล่าสุด ${formatDateTime(drive.updatedAt)}` : "ยังไม่มีเวลาอัปเดตล่าสุด", drive.connected ? "ok" : "warning"],
    ["ข้อผิดพลาดล่าสุด", summary.latestErrorTime ? formatDateTime(summary.latestErrorTime) : "ไม่มี", "เวลาของ failure ล่าสุดในช่วงนี้", summary.latestErrorTime ? "danger" : "ok"]
  ];

  els.monitoringSummaryCards.innerHTML = cards
    .map(([label, value, helper, state]) => `
      <section class="kpi-card monitoring-card ${escapeHtml(state)}">
        <strong>${escapeHtml(label)}</strong>
        <div class="kpi-number">${escapeHtml(formatKpiValue(value))}</div>
        <p>${escapeHtml(helper)}</p>
      </section>
    `)
    .join("");
}

function renderMonitoringIntegrationHealth(googleDrive) {
  const connected = googleDrive?.connected === true;
  els.monitoringIntegrationHealth.innerHTML = `
    <div class="integration-health ${connected ? "ok" : "warning"}">
      <div>
        <strong>${connected ? "Google Drive connected" : "Google Drive disconnected"}</strong>
        <span>${connected ? "พร้อม export ไฟล์ approve ไปยัง Google Drive" : "Google Drive ยังไม่ได้เชื่อมต่อ กรุณาให้ Admin เชื่อมต่อก่อน"}</span>
      </div>
      <div class="monitoring-meta-list">
        <span>Mode: ${escapeHtml(googleDrive?.mode || "-")}</span>
        <span>Configured: ${googleDrive?.configured ? "yes" : "no"}</span>
        <span>Latest update: ${googleDrive?.updatedAt ? escapeHtml(formatDateTime(googleDrive.updatedAt)) : "-"}</span>
      </div>
    </div>
  `;
}

function renderMonitoringStuckJobs(items) {
  if (!items.length) {
    els.monitoringStuckJobs.innerHTML = '<div class="empty-state">ยังไม่มีรายการในช่วงเวลานี้</div>';
    return;
  }
  els.monitoringStuckJobs.innerHTML = `<div class="monitoring-list">${items.map(renderMonitoringStuckRow).join("")}</div>`;
}

function renderMonitoringStuckRow(item) {
  return `
    <article class="monitoring-row warning">
      <div class="monitoring-row-main">
        <time>${escapeHtml(formatDateTime(item.updatedAt || item.createdAt))}</time>
        <strong>${escapeHtml(item.type || "job")} · ${escapeHtml(item.status || "unknown")}</strong>
        <span>${escapeHtml(item.user || "ไม่ระบุผู้ใช้งาน")}</span>
      </div>
      <div class="monitoring-row-detail">
        <span>${item.jobId ? `Job ${escapeHtml(shortId(item.jobId))}` : "Job -"}</span>
        <span>${item.generationId ? `Gen ${escapeHtml(shortId(item.generationId))}` : "Gen -"}</span>
        <span>ค้างประมาณ ${escapeHtml(formatDurationMinutes(item.ageMinutes))}</span>
      </div>
      <p>${escapeHtml(item.recommendedAction || "ตรวจสอบ queue และ retry ถ้าจำเป็น")}</p>
      ${renderRecoveryActions(item, "monitoring")}
    </article>
  `;
}

function renderMonitoringFailedItems(items) {
  if (!items.length) {
    els.monitoringFailedItems.innerHTML = '<div class="empty-state">ยังไม่มีรายการในช่วงเวลานี้</div>';
    return;
  }
  els.monitoringFailedItems.innerHTML = `<div class="monitoring-list">${items.map(renderMonitoringFailureRow).join("")}</div>`;
}

function renderMonitoringFailureRow(item) {
  return `
    <article class="monitoring-row danger">
      <div class="monitoring-row-main">
        <time>${escapeHtml(formatDateTime(item.time))}</time>
        <strong>${escapeHtml(formatMonitoringType(item.type))} · ${escapeHtml(item.status || "failed")}</strong>
        <span>${escapeHtml(item.user || "ไม่ระบุผู้ใช้งาน")}</span>
      </div>
      <div class="monitoring-row-detail">
        <span>${item.jobId ? `Job ${escapeHtml(shortId(item.jobId))}` : "Job -"}</span>
        <span>${item.generationId ? `Gen ${escapeHtml(shortId(item.generationId))}` : "Gen -"}</span>
        <span>${escapeHtml(item.detail || "ไม่มีรายละเอียดเพิ่มเติม")}</span>
      </div>
      <p>${escapeHtml(item.recommendedAction || "ตรวจสอบรายการนี้และ retry ถ้าจำเป็น")}</p>
      ${renderRecoveryActions(item, "monitoring")}
    </article>
  `;
}

function renderMonitoringWordPressPreflights(items) {
  if (!els.monitoringWordPressPreflights) return;
  if (!items.length) {
    els.monitoringWordPressPreflights.innerHTML = '<div class="empty-state">ยังไม่มี preflight ในช่วงเวลานี้</div>';
    return;
  }
  els.monitoringWordPressPreflights.innerHTML = `<div class="monitoring-list">${items.map(renderMonitoringWordPressPreflightRow).join("")}</div>`;
}

function renderMonitoringWordPressPreflightRow(item) {
  const isMedia = item.phase === "media_mapping";
  const isMediaAttachConfirmation = item.phase === "media_attach_confirmation";
  const isMediaAttachExecutionPlan = item.phase === "media_attach_execution_plan";
  const isMediaRemoteRefetch = item.phase === "media_remote_refetch";
  const summary = item.summary || {};
  const firstItem = item.items?.[0] || {};
  const tone = item.liveWriteAllowed
    ? "danger"
    : item.mediaAttachAllowed || item.executionAllowed || summary.blocked || summary.awaitingMediaAssets || summary.missingHeroMedia || summary.missingSupportMedia || summary.duplicateIdempotencyKeys
      ? "warning"
      : "neutral";
  let headline = `${formatThaiNumber(summary.readyForProposal || 0)} รายการพร้อมเสนอ · ${formatThaiNumber(summary.blocked || 0)} รายการติดเงื่อนไข`;
  let detail = [
    `${formatThaiNumber(summary.createDraftProduct || 0)} ร่างสินค้า`,
    `${formatThaiNumber(summary.skipExistingSku || 0)} ข้าม SKU ที่มีอยู่แล้ว`,
    `${formatThaiNumber(summary.remoteChecked || 0)} ตรวจข้อมูลปลายทาง`,
    summary.remoteErrors ? `${formatThaiNumber(summary.remoteErrors)} ข้อผิดพลาดปลายทาง` : ""
  ];
  if (isMedia) {
    headline = `${formatThaiNumber(summary.readyForMediaProposal || 0)} รายการพร้อมเสนอไฟล์ภาพ · ${formatThaiNumber(summary.mediaAssetsMatched || 0)} ภาพที่จับคู่ได้`;
    detail = [
      `${formatThaiNumber(summary.proposedMainImages || 0)} ภาพหลัก`,
      `${formatThaiNumber(summary.proposedGalleryImages || 0)} ภาพแกลเลอรี`,
      summary.awaitingMediaAssets ? `${formatThaiNumber(summary.awaitingMediaAssets)} รอไฟล์ภาพ` : "",
      summary.productPreflightBlocked ? `${formatThaiNumber(summary.productPreflightBlocked)} สินค้าติดเงื่อนไข` : ""
    ];
  }
  if (isMediaAttachConfirmation) {
    headline = `${formatThaiNumber(summary.readyForConfirmation || 0)} รายการรอยืนยัน · ${formatThaiNumber(summary.proposedOperations || 0)} คำสั่งที่เสนอ`;
    detail = [
      `${formatThaiNumber(summary.proposedMainImages || 0)} ภาพหลัก`,
      `${formatThaiNumber(summary.proposedGalleryImages || 0)} ภาพแกลเลอรี`,
      item.gateStatus || "",
      item.mediaAttachAllowed ? "อนุญาตให้แนบภาพ" : "ยังไม่แนบภาพ"
    ];
  }
  if (isMediaAttachExecutionPlan) {
    headline = `${formatThaiNumber(summary.readyForLiveWritePhase || 0)} รายการพร้อมสำหรับ live phase · ${formatThaiNumber(summary.proposedOperations || 0)} คำสั่งที่เสนอ`;
    detail = [
      item.planStatus || "",
      item.requiresRemoteRefetch ? "ต้องดึงข้อมูลปลายทางใหม่" : "",
      summary.awaitingFinalConfirmation ? `${formatThaiNumber(summary.awaitingFinalConfirmation)} รอยืนยันสุดท้าย` : "",
      summary.duplicateIdempotencyKeys ? `${formatThaiNumber(summary.duplicateIdempotencyKeys)} key ซ้ำ` : ""
    ];
  }
  if (isMediaRemoteRefetch) {
    headline = `${formatThaiNumber(summary.remoteProductsFound || 0)} สินค้าที่พบ · ตรวจแล้ว ${formatThaiNumber(summary.operationCount || 0)} คำสั่ง`;
    detail = [
      item.preflightStatus || "",
      `${formatThaiNumber(summary.currentGalleryImages || 0)} ภาพแกลเลอรีปัจจุบัน`,
      `${formatThaiNumber(summary.remoteMediaMatches || 0)} ภาพที่จับคู่ได้`,
      summary.remoteProductsMissing ? `${formatThaiNumber(summary.remoteProductsMissing)} สินค้าหาไม่เจอ` : ""
    ];
  }
  return `
    <article class="monitoring-row ${tone}">
      <div class="monitoring-row-main">
        <time>${escapeHtml(formatDateTime(item.completedAt))}</time>
        <strong>${escapeHtml(item.phaseLabel || item.phase || "WordPress preflight")}</strong>
        <span>${escapeHtml(headline)}</span>
      </div>
      <div class="monitoring-row-detail">
        <span>Batch ${escapeHtml(shortId(item.batchId))}</span>
        <span>Task ${escapeHtml(shortId(item.taskId))}</span>
        <span>${escapeHtml(detail.filter(Boolean).join(" / "))}</span>
      </div>
      <p>${escapeHtml(getWordPressPreflightNextStep({ item, firstItem, isMedia }))}</p>
    </article>
  `;
}

function getWordPressPreflightNextStep({ item, firstItem, isMedia }) {
  if (item.liveWriteAllowed) return "หยุดตรวจสอบทันที: live write flag เปิดอยู่ ทั้ง phase นี้ควรเป็น preflight เท่านั้น";
  if (item.phase === "media_remote_refetch") {
    if (item.executionAllowed || item.mediaAttachAllowed) return "หยุดตรวจสอบทันที: execution/media attach flag เปิดอยู่ใน remote refetch preflight";
    if (firstItem?.remoteRefetchStatus === "ready_for_live_write_phase_review") {
      return "อ่านสถานะ remote ล่าสุดแล้ว; ยังไม่มี upload/attach/publish และรอ live-write phase แยกต่างหาก";
    }
    if (firstItem?.blockers?.length) return `รอแก้ remote refetch: ${firstItem.blockers.join(", ")}`;
    return "รอผล remote refetch หรือ review blocker ก่อนเข้า live media attach phase";
  }
  if (item.phase === "media_attach_execution_plan") {
    if (item.executionAllowed || item.mediaAttachAllowed) return "หยุดตรวจสอบทันที: execution/media attach flag เปิดอยู่ก่อน live-write phase";
    if (firstItem?.operationStatus === "ready_for_live_write_phase") {
      return "พร้อมเป็น execution plan สำหรับเฟส live-write ในอนาคต; ยังต้อง refetch remote และยังไม่มี upload/attach/publish";
    }
    if (firstItem?.blockers?.length) return `รอแก้ execution plan: ${firstItem.blockers.join(", ")}`;
    return "รอ final confirmation และ remote refetch ก่อน live media attach phase";
  }
  if (item.phase === "media_attach_confirmation") {
    if (item.mediaAttachAllowed) return "หยุดตรวจสอบทันที: media attach flag เปิดอยู่ก่อน final confirmation";
    if (firstItem?.confirmationStatus === "ready_for_final_confirmation") {
      return "พร้อมเป็น final confirmation package สำหรับ media attach ในเฟสถัดไป; ยังไม่มี upload/attach/publish ในขั้นนี้";
    }
    if (firstItem?.blockers?.length) return `รอแก้ confirmation gate: ${firstItem.blockers.join(", ")}`;
    return "รอ final confirmation ก่อน media attach execution phase";
  }
  if (isMedia) {
    if (firstItem?.mediaStatus === "ready_for_media_proposal") {
      return "พร้อมทำ media attach proposal หลัง final confirmation; ยังไม่มี upload/attach/publish ในขั้นนี้";
    }
    if (firstItem?.blockers?.length) return `รอแก้ media gate: ${firstItem.blockers.join(", ")}`;
    return "รอ media assets จาก support approval หรือ media export preflight gate";
  }
  if (firstItem?.preflightStatus === "ready_for_proposal") {
    return "พร้อมใช้เป็น product proposal input สำหรับ media mapping preflight; ยังไม่สร้างสินค้า WordPress";
  }
  if (firstItem?.blockers?.length) return `รอแก้ product preflight: ${firstItem.blockers.join(", ")}`;
  return item.requiresFinalConfirmation ? "รอ final confirmation ก่อน live WordPress action" : "ตรวจสอบ guardrail ก่อนดำเนินการต่อ";
}

function renderMonitoringRecentEvents(items) {
  if (!items.length) {
    els.monitoringRecentEvents.innerHTML = '<div class="empty-state">ยังไม่มีรายการในช่วงเวลานี้</div>';
    return;
  }
  els.monitoringRecentEvents.innerHTML = `<div class="monitoring-list compact">${items.map(renderMonitoringEventRow).join("")}</div>`;
}

function renderMonitoringEventRow(item) {
  const rowClass = item.status === "failed" ? "danger" : item.status === "resolved_by_drive" ? "warning" : "neutral";
  return `
    <article class="monitoring-row ${rowClass}">
      <div class="monitoring-row-main">
        <time>${escapeHtml(formatDateTime(item.time))}</time>
        <strong>${escapeHtml(item.eventType || "activity")}</strong>
        <span>${escapeHtml(item.user || "ไม่ระบุผู้ใช้งาน")}</span>
      </div>
      <div class="monitoring-row-detail">
        <span>${escapeHtml(item.status || "recorded")}</span>
        <span>${item.jobId ? `Job ${escapeHtml(shortId(item.jobId))}` : "Job -"}</span>
        <span>${item.generationId ? `Gen ${escapeHtml(shortId(item.generationId))}` : "Gen -"}</span>
        ${item.detail ? `<span>${escapeHtml(item.detail)}</span>` : ""}
      </div>
    </article>
  `;
}

function formatMonitoringType(type) {
  const labels = {
    generate: "Generate",
    approve: "Approve",
    export: "Export",
    storage: "Storage",
    system: "System"
  };
  return labels[type] || type || "System";
}

function formatDurationMinutes(value) {
  const minutes = Number(value || 0);
  if (minutes < 60) return `${formatThaiNumber(minutes)} นาที`;
  return `${formatThaiNumber(Math.round((minutes / 60) * 10) / 10)} ชม.`;
}

function formatKpiValue(value) {
  if (value === null || value === undefined || value === "") return "ยังไม่มีข้อมูลเพียงพอ";
  if (typeof value === "number") return formatThaiNumber(value);
  return value;
}

function formatEstimatedCost(value, currency = "USD") {
  if (value === null || value === undefined || value === "") return "ยังไม่มีข้อมูลเพียงพอ";
  const amount = Number(value || 0);
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: amount && Math.abs(amount) < 1 ? 4 : 2,
    maximumFractionDigits: 4
  });
  return `${formatted} ${currency || "USD"} estimated`;
}

function formatPercent(value) {
  return value === null || value === undefined ? null : `${value}%`;
}

function formatMinutes(value) {
  if (value === null || value === undefined) return null;
  if (value < 60) return `${formatThaiNumber(value)} นาที`;
  return `${formatThaiNumber(Math.round((value / 60) * 10) / 10)} ชม.`;
}

function formatThaiNumber(value) {
  return Number(value || 0).toLocaleString("th-TH");
}

function formatDateTime(value) {
  try {
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    return "-";
  }
}

function shortId(value) {
  return String(value || "").slice(0, 8);
}

function loadJobHistory() {
  try {
    const raw = localStorage.getItem("winter-image-desk-history");
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveJobHistory() {
  localStorage.setItem("winter-image-desk-history", JSON.stringify(localJobHistory));
}

function getTodayInputDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function renderFilePreview(input, target, maxCount) {
  const files = Array.from(input.files || []);
  if (!files.length) {
    target.innerHTML = '<span class="thumb-empty">ยังไม่ได้เลือกภาพ</span>';
    return;
  }

  target.innerHTML = files
    .slice(0, maxCount)
    .map((file, index) => {
      const url = URL.createObjectURL(file);
      const label = index === 0 ? "ภาพหลัก" : `Ref ${index + 1}`;
      return `
        <figure class="thumb">
          <img src="${url}" alt="${escapeHtml(file.name)}">
          <figcaption>${escapeHtml(label)}</figcaption>
        </figure>
      `;
    })
    .join("");
}

function renderQc() {
  els.qcList.innerHTML = qcItems
    .map(
      ([title, helper], index) => `
        <label class="check-item">
          <input type="checkbox" data-qc="${index}">
          <div>
            <strong>${title}</strong>
            <span>${helper}</span>
          </div>
        </label>
      `
    )
    .join("");

  els.qcList.addEventListener("change", updateQcState);
  updateQcState();
}

function updateQcState() {
  const checked = els.qcList.querySelectorAll("input:checked").length;
  els.qcScore.textContent = `${checked}/${qcItems.length}`;
  updateWorkflowGate();
  if (checked === qcItems.length) {
    submitQcCheck();
  }
}

function isQcComplete() {
  return els.qcList.querySelectorAll("input:checked").length === qcItems.length;
}

function resetQc() {
  lastSubmittedQcKey = "";
  els.qcList.querySelectorAll("input").forEach((input) => {
    input.checked = false;
  });
  updateQcState();
}

function buildQcChecklistJson() {
  const checkedInputs = new Set(
    Array.from(els.qcList.querySelectorAll("input:checked")).map((input) => Number(input.dataset.qc))
  );
  return {
    items: qcItems.map(([title, helper], index) => ({
      id: index,
      title,
      helper,
      checked: checkedInputs.has(index)
    })),
    total: qcItems.length,
    checked: checkedInputs.size
  };
}

function getQcSubmissionKey(checklistJson, score, passed) {
  const checkedMask = checklistJson.items.map((item) => (item.checked ? "1" : "0")).join("");
  return `${currentHeroGenerationId}:${score}:${passed ? "1" : "0"}:${checkedMask}`;
}

async function loadHeroReviewPage() {
  if (!els.heroReviewStatus) return;
  const params = getHashParams();
  const generationId = params.get("generation_id") || params.get("generationId") || "";
  const assetId = params.get("asset_id") || params.get("assetId") || "";
  const sku = params.get("sku") || "";
  if (!generationId && !assetId) {
    setHeroReviewMessage("ลิงก์นี้ไม่มีรหัสภาพ จึงยังอนุมัติจากหน้านี้ไม่ได้", "danger");
    els.heroReviewStatus.textContent = "ไม่พบรหัสภาพ";
    return;
  }

  els.heroReviewStatus.textContent = "กำลังโหลด";
  setHeroReviewMessage("", "");
  try {
    const response = await authFetch(`/api/review/hero?${params.toString()}`);
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "โหลดหน้าตรวจภาพไม่สำเร็จ");
    renderHeroReviewPage(data.review || {}, { generationId, sku });
  } catch (error) {
    els.heroReviewStatus.textContent = "โหลดไม่สำเร็จ";
    setHeroReviewMessage(error.message, "danger");
  }
}

function getSupportAssetKey(asset = {}) {
  return String(
    asset.asset_key ||
    asset.asset_id ||
    asset.id ||
    asset.generation_id ||
    asset.request_id ||
    asset.public_url ||
    asset.source_url ||
    asset.url ||
    ""
  ).trim();
}

function getSupportDecisionMap(review = {}) {
  const stateAssets = Array.isArray(review.support_review_decision_state?.assets)
    ? review.support_review_decision_state.assets
    : [];
  const legacyAssets = Array.isArray(review.support_review_decisions) ? review.support_review_decisions : [];
  return new Map([...legacyAssets, ...stateAssets].map((item) => [getSupportAssetKey(item), item]));
}

function renderHeroReviewProductSummary(review = {}, { sku = "" } = {}) {
  if (!els.heroReviewProductSummary) return;
  const job = review.job || {};
  const rows = [
    ["SKU", sku || review.sku || job.sku || "-"],
    ["สินค้า", job.product_name || review.product_name || "-"],
    ["หมวด", job.product_type || job.category || review.category || "-"],
    ["ขั้นตอน", review.review_stage === "support_review" ? "ตรวจภาพเสริม" : "ตรวจภาพหลัก"],
    ["ภาพหลัก", review.hero_approved === true || review.approved === true ? "ผ่านแล้ว" : "รอตรวจ"]
  ];
  els.heroReviewProductSummary.innerHTML = `
    <strong>สรุปสินค้าที่ตรวจ</strong>
    <dl>
      ${rows.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}
    </dl>
  `;
}

function renderHeroReviewReferenceSummary(review = {}, refs = []) {
  if (!els.heroReviewReferenceSummary) return;
  const summary = review.reference_summary || {};
  const driveUrl = summary.drive_folder_url || summary.drive_url || summary.reference_url || "";
  const source = summary.source || summary.source_label || (driveUrl ? "Google Drive" : "งานนี้");
  const foundFiles = Number(summary.found_files ?? summary.reference_count ?? refs.length ?? 0);
  const stageableImages = Number(summary.stageable_images ?? summary.stageable_reference_count ?? refs.length ?? 0);
  const blockedFiles = Number(summary.blocked_files ?? summary.blocked_reference_count ?? 0);
  els.heroReviewReferenceSummary.innerHTML = `
    <strong>สรุปรูปอ้างอิง</strong>
    <dl>
      <dt>ที่มา</dt><dd>${escapeHtml(source || "-")}</dd>
      <dt>ไฟล์ที่พบ</dt><dd>${foundFiles}</dd>
      <dt>รูปพร้อมใช้</dt><dd>${stageableImages}</dd>
      <dt>ไฟล์ที่ใช้ไม่ได้</dt><dd>${blockedFiles}</dd>
    </dl>
    ${driveUrl ? `<a href="${escapeHtml(driveUrl)}" target="_blank" rel="noreferrer">เปิดโฟลเดอร์ Google Drive</a>` : ""}
  `;
}

function renderHeroReviewPage(review = {}, fallback = {}) {
  const job = review.job || {};
  const heroAsset = review.hero_asset || {};
  const refs = Array.isArray(review.reference_assets) ? review.reference_assets : [];
  const supportAssets = Array.isArray(review.support_assets) ? review.support_assets : [];
  const generationId = review.generation_id || fallback.generationId || "";
  const sku = review.sku || fallback.sku || job.sku || heroAsset.sku || "-";
  const heroUrl = heroAsset.public_url || heroAsset.url || heroAsset.source_url || "";
  const approvedHeroAnchor = review.approved_hero_anchor || null;
  const heroApproved = review.hero_approved === true || review.approved === true || Boolean(approvedHeroAnchor?.approved);
  const supportReviewReady = review.review_stage === "support_review" || review.support_review_ready === true;
  const hasSupportAssets = heroApproved && supportReviewReady && supportAssets.length > 0;
  const supportDecisionMap = getSupportDecisionMap(review);
  const supportCandidateManifest = review.support_candidate_manifest || null;
  const mediaExportPreflightGate = review.media_export_preflight_gate || null;
  const batchId = review.batch_id || getHashParams().get("batch_id") || "";

  els.heroReviewTitle.textContent = hasSupportAssets ? `ตรวจชุดภาพ / ${sku}` : `ตรวจภาพหลัก / ${sku}`;
  els.heroReviewStatus.textContent = hasSupportAssets ? "ภาพเสริมพร้อมตรวจ" : heroApproved ? "อนุมัติแล้ว" : "พร้อมตรวจ";
  if (getPageFromHash() === "review") {
    els.topbarEyebrow.textContent = hasSupportAssets ? "ตรวจภาพเสริม" : "ตรวจภาพหลัก";
    els.topbarTitle.textContent = hasSupportAssets ? "ตรวจภาพเสริมก่อนส่งออก" : "ตรวจภาพหลักก่อนสร้างภาพเสริม";
  }
  els.heroReviewMeta.textContent = [
    job.product_name,
    job.product_type,
    getProductionStatusText(job.status),
    hasSupportAssets ? `${supportAssets.length} ภาพเสริม · ตรวจก่อนส่งออก` : "ภาพเสริมจะเปิดหลังภาพหลักผ่านแล้ว"
  ].filter(Boolean).join(" · ") || "เทียบรูปอ้างอิงกับภาพหลักที่สร้างไว้";
  renderHeroReviewProductSummary({ ...review, hero_approved: heroApproved }, { sku });
  renderHeroReviewReferenceSummary(review, refs);
  els.heroReviewGenerationId.textContent = generationId ? shortId(generationId) : "-";
  els.heroReviewRefCount.textContent = `${refs.length} ภาพ`;
  els.heroReviewApproveButton.dataset.generationId = generationId;
  els.heroReviewApproveButton.dataset.batchId = batchId;
  els.heroReviewApproveButton.dataset.sku = sku;
  els.heroReviewRegenerateButton.dataset.generationId = generationId;
  els.heroReviewRegenerateButton.dataset.batchId = batchId;
  els.heroReviewRegenerateButton.dataset.sku = sku;
  els.heroReviewApproveButton.disabled = Boolean(heroApproved);
  els.heroReviewApproveButton.hidden = hasSupportAssets;
  els.heroReviewRegenerateButton.hidden = hasSupportAssets;
  if (els.heroReviewDecisionDock) els.heroReviewDecisionDock.hidden = hasSupportAssets;
  els.heroReviewApproveButton.textContent = "อนุมัติภาพหลัก";
  if (els.supportReviewSaveButton) {
    els.supportReviewSaveButton.dataset.batchId = batchId;
    els.supportReviewSaveButton.dataset.sku = sku;
    els.supportReviewSaveButton.dataset.generationId = generationId;
    els.supportReviewSaveButton.hidden = !hasSupportAssets;
  }
  if (els.heroReviewApprovedAnchor) {
    els.heroReviewApprovedAnchor.textContent = heroApproved
      ? `ภาพหลักที่อนุมัติ: ${shortId(approvedHeroAnchor?.generation_id || generationId || "")}`
      : "ภาพเสริมจะเปิดหลังภาพหลักผ่านแล้ว";
  }
  if (els.heroReviewRegenerateReason) els.heroReviewRegenerateReason.value = "";

  els.heroReviewHero.innerHTML = heroUrl
    ? `<a href="${escapeHtml(heroUrl)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(heroUrl)}" alt="ภาพหลัก ${escapeHtml(sku)}" /></a>`
    : `<p class="empty-state">ไม่พบภาพหลัก</p>`;

  if (!refs.length) {
    els.heroReviewRefs.innerHTML = `<p class="empty-state">ไม่พบภาพอ้างอิงในงานนี้</p>`;
  } else {
    els.heroReviewRefs.innerHTML = refs.map((asset, index) => {
      const url = asset.public_url || asset.url || asset.thumbnailLink || "";
      const label = asset.file_name || asset.name || asset.source_name || `ภาพอ้างอิง ${index + 1}`;
      return `
        <figure class="review-image-tile">
          ${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(url)}" alt="${escapeHtml(label)}" /></a>` : `<p class="empty-state">ไม่มี URL</p>`}
          <figcaption>${escapeHtml(label)}</figcaption>
        </figure>
      `;
    }).join("");
  }

  if (els.heroReviewSupportSet && els.heroReviewSupportAssets && els.heroReviewSupportCount) {
    els.heroReviewSupportSet.hidden = !hasSupportAssets;
    els.heroReviewSupportCount.textContent = `${supportAssets.length} ภาพ`;
    els.heroReviewSupportAssets.innerHTML = hasSupportAssets
      ? supportAssets.map((asset, index) => {
        const url = asset.public_url || asset.url || asset.source_url || "";
        const label = asset.slot || asset.file_name || `ภาพเสริม ${index + 1}`;
        const assetKey = getSupportAssetKey(asset) || `${sku}:support:${index + 1}`;
        const decisionRecord = supportDecisionMap.get(assetKey) || {};
        const decision = decisionRecord.decision || "pending_support_qc";
        const reason = decisionRecord.reason || "";
        const statusLabel = decision === "approve_support" ? "ผ่านแล้ว" :
          decision === "regenerate_support" ? "ขอสร้างใหม่" :
            decision === "reject_support" ? "ไม่ใช้ภาพนี้" :
              decision === "needs_manual_review" ? "ต้องตรวจเพิ่ม" : "รอตรวจ";
        return `
          <figure class="review-image-tile support-shot-card" data-shot-role="${escapeHtml(asset.slot || asset.shot_key || label)}">
            ${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(url)}" alt="${escapeHtml(label)}" /></a>` : `<p class="empty-state">ไม่มี URL</p>`}
            <figcaption>
              <strong>${escapeHtml(label)}</strong>
              <span class="review-state-pill">${escapeHtml(statusLabel)}</span>
            </figcaption>
            <label class="support-decision-control">
              <span>ผลตรวจ</span>
              <select
                data-support-decision
                data-asset-key="${escapeHtml(assetKey)}"
                data-asset-id="${escapeHtml(asset.asset_id || asset.id || "")}"
                data-generation-id="${escapeHtml(asset.generation_id || "")}"
                data-request-id="${escapeHtml(asset.request_id || "")}"
                data-public-url="${escapeHtml(url)}"
                data-slot="${escapeHtml(asset.slot || asset.shot_key || label)}"
              >
                <option value="pending_support_qc"${decision === "pending_support_qc" ? " selected" : ""}>รอตรวจ</option>
                <option value="approve_support"${decision === "approve_support" ? " selected" : ""}>อนุมัติภาพนี้</option>
                <option value="regenerate_support"${decision === "regenerate_support" ? " selected" : ""}>สร้างใหม่</option>
                <option value="reject_support"${decision === "reject_support" ? " selected" : ""}>ไม่ใช้ภาพนี้</option>
                <option value="needs_manual_review"${decision === "needs_manual_review" ? " selected" : ""}>ต้องตรวจเพิ่ม</option>
              </select>
            </label>
            <label class="support-decision-control">
              <span>เหตุผลหรือสิ่งที่ต้องแก้</span>
              <textarea data-support-reason data-asset-key="${escapeHtml(assetKey)}" rows="2" placeholder="เช่น โลโก้เพี้ยน / สีไม่ตรง / มุมภาพซ้ำ">${escapeHtml(reason)}</textarea>
            </label>
          </figure>
        `;
      }).join("")
      : `<p class="empty-state">ยังไม่มีภาพเสริมในชุดงานนี้</p>`;
  }

  const reviewMessage = mediaExportPreflightGate?.gate_status
    ? `ตรวจไฟล์ก่อนส่งออก: ${getProductionStatusText(mediaExportPreflightGate.gate_status)}`
    : supportCandidateManifest?.manifest_status
      ? `ชุดภาพพร้อมส่งออก: ${getProductionStatusText(supportCandidateManifest.manifest_status)}`
      : hasSupportAssets
        ? "ภาพเสริมพร้อมให้ตรวจแล้ว"
        : review.approved
          ? "ภาพหลักนี้อนุมัติแล้ว"
          : "";
  setHeroReviewMessage(
    reviewMessage,
    mediaExportPreflightGate?.gate_status || supportCandidateManifest?.manifest_status || hasSupportAssets || review.approved ? "success" : ""
  );
}

async function approveHeroFromReviewPage() {
  const generationId = els.heroReviewApproveButton?.dataset.generationId || "";
  if (!generationId) return setHeroReviewMessage("ไม่มีรหัสภาพสำหรับอนุมัติภาพหลัก", "danger");
  els.heroReviewApproveButton.disabled = true;
  setHeroReviewMessage("กำลังบันทึกการอนุมัติภาพหลัก...", "");
  try {
    const response = await authFetch("/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generation_id: generationId,
        batch_id: els.heroReviewApproveButton.dataset.batchId || "",
        sku: els.heroReviewApproveButton.dataset.sku || "",
        note: "Hero approved from web review page"
      })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "บันทึกการอนุมัติไม่สำเร็จ");
    els.heroReviewStatus.textContent = "อนุมัติแล้ว";
    setHeroReviewMessage("อนุมัติภาพหลักแล้ว ขั้นถัดไปคือสร้างภาพเสริม", "success");
  } catch (error) {
    els.heroReviewApproveButton.disabled = false;
    setHeroReviewMessage(error.message, "danger");
  }
}

async function regenerateHeroFromReviewPage() {
  const generationId = els.heroReviewRegenerateButton?.dataset.generationId || "";
  if (!generationId) return setHeroReviewMessage("ไม่มีรหัสภาพสำหรับสร้างภาพหลักใหม่", "danger");
  const reason = els.heroReviewRegenerateReason.value.trim();
  if (!reason) return setHeroReviewMessage("กรุณาระบุเหตุผลก่อนส่งคำขอสร้างภาพหลักใหม่", "danger");
  els.heroReviewRegenerateButton.disabled = true;
  setHeroReviewMessage("กำลังส่งคำขอสร้างภาพหลักใหม่...", "");
  try {
    const response = await authFetch("/api/review/hero/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generation_id: generationId,
        batch_id: els.heroReviewRegenerateButton.dataset.batchId || "",
        sku: els.heroReviewRegenerateButton.dataset.sku || "",
        reason: els.heroReviewRegenerateReason.value.trim()
      })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "บันทึกคำขอสร้างใหม่ไม่สำเร็จ");
    els.heroReviewStatus.textContent = "รอสร้างใหม่";
    setHeroReviewMessage("รับคำขอสร้างภาพหลักใหม่แล้ว งานจะเริ่มตามคิว", "success");
  } catch (error) {
    els.heroReviewRegenerateButton.disabled = false;
    setHeroReviewMessage(error.message, "danger");
  }
}

async function saveSupportReviewDecisions() {
  const batchId = els.supportReviewSaveButton?.dataset.batchId || getHashParams().get("batch_id") || "";
  const sku = els.supportReviewSaveButton?.dataset.sku || getHashParams().get("sku") || "";
  const generationId = els.supportReviewSaveButton?.dataset.generationId || getHashParams().get("generation_id") || "";
  const decisionInputs = Array.from(els.heroReviewSupportAssets?.querySelectorAll("[data-support-decision]") || []);
  const reasonInputs = new Map(
    Array.from(els.heroReviewSupportAssets?.querySelectorAll("[data-support-reason]") || [])
      .map((input) => [input.dataset.assetKey || "", input])
  );
  if (!batchId || !sku) return setHeroReviewMessage("ไม่มีรหัสชุดงานหรือ SKU สำหรับบันทึกผลตรวจภาพเสริม", "danger");
  if (!decisionInputs.length) return setHeroReviewMessage("ยังไม่มีภาพเสริมให้บันทึก", "danger");

  const decisions = decisionInputs.map((input) => {
    const reasonInput = reasonInputs.get(input.dataset.assetKey || "");
    return {
      asset_key: input.dataset.assetKey || "",
      asset_id: input.dataset.assetId || "",
      generation_id: input.dataset.generationId || "",
      request_id: input.dataset.requestId || "",
      public_url: input.dataset.publicUrl || "",
      slot: input.dataset.slot || "",
      decision: input.value || "pending_support_qc",
      reason: reasonInput?.value.trim() || ""
    };
  });

  els.supportReviewSaveButton.disabled = true;
  setHeroReviewMessage("กำลังบันทึกผลตรวจภาพเสริม...", "");
  try {
    const response = await authFetch("/api/review/support-decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batch_id: batchId, sku, generation_id: generationId, decisions })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "บันทึกผลตรวจภาพเสริมไม่สำเร็จ");
    const state = result.decision_state || {};
    els.heroReviewStatus.textContent = state.review_status || "support review saved";
    if (state.candidate_manifest_ready) {
      const manifestStatus = result.candidate_manifest?.manifest_status || "candidate_manifest_ready";
      const mediaGateStatus = result.media_export_preflight_gate?.gate_status || "";
      setHeroReviewMessage(
        mediaGateStatus
          ? `ตรวจภาพเสริมครบแล้ว: ${getProductionStatusText(mediaGateStatus)}`
          : `ตรวจภาพเสริมครบแล้ว: ${getProductionStatusText(manifestStatus)}`,
        "success"
      );
    } else if (state.review_status === "support_regeneration_requested") {
      setHeroReviewMessage("รับคำขอสร้างภาพเสริมใหม่แล้ว งานนี้จะยังไม่ไปขั้นส่งออก", "success");
    } else {
      setHeroReviewMessage("บันทึกผลตรวจภาพเสริมแล้ว", "success");
    }
  } catch (error) {
    setHeroReviewMessage(error.message, "danger");
  } finally {
    els.supportReviewSaveButton.disabled = false;
  }
}

function setHeroReviewMessage(message, tone = "") {
  if (!els.heroReviewMessage) return;
  els.heroReviewMessage.textContent = message || "";
  els.heroReviewMessage.classList.toggle("is-success", tone === "success");
  els.heroReviewMessage.classList.toggle("danger", tone === "danger");
}

async function submitQcCheck() {
  if (!currentHeroGenerationId) return;
  const checklistJson = buildQcChecklistJson();
  const score = checklistJson.checked;
  const passed = score === qcItems.length;
  const submissionKey = getQcSubmissionKey(checklistJson, score, passed);
  if (submissionKey === lastSubmittedQcKey) return;
  lastSubmittedQcKey = submissionKey;

  try {
    const response = await authFetch("/api/qc-checks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generation_id: currentHeroGenerationId,
        checklist_json: checklistJson,
        score,
        passed
      })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      console.warn(data.error || "QC check was not recorded.");
    }
  } catch (error) {
    console.warn(error.message);
  }
}

function getApprovalExportPath(data) {
  if (data.googleDriveFile?.webViewLink) return data.googleDriveFile.webViewLink;
  if (data.googleDriveFile?.id) return data.googleDriveFile.id;
  return data.drivePath || data.approvedPath || data.browserUrl || null;
}

async function recordApproval(data) {
  if (!currentHeroGenerationId || lastRecordedApprovalGenerationId === currentHeroGenerationId) return;
  lastRecordedApprovalGenerationId = currentHeroGenerationId;

  try {
    const response = await authFetch("/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generation_id: currentHeroGenerationId,
        export_path: getApprovalExportPath(data),
        note: "Hero approved from Approve + Save"
      })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      console.warn(result.error || "Approval was not recorded.");
    }
  } catch (error) {
    console.warn(error.message);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init();
