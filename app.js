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

const imageTypes = {
  "สินค้าเดี่ยวบนพื้นขาว": {
    mode: "Off-model",
    prompt: "Create a clean e-commerce catalog hero image on a warm white background. No model. The product must be centered, premium, evenly lit, and ready for a rental and retail website."
  },
  "ใส่กับโมเดล": {
    mode: "On-model",
    prompt: "Create a clean on-model e-commerce catalog hero image with a modern Thai influencer feel. Use one attractive, approachable Thai model with bright cheerful facial expression, lively eyes, natural confident smile, fresh makeup, neat hair styling, and friendly social-commerce energy. The product is still the hero and must be worn naturally, but the model should feel aspirational, stylish, and warm rather than plain."
  },
  "Close-up จุดเด่น": {
    mode: "Support",
    prompt: "Create a close-up detail image focused only on the product feature. Keep the same exact product identity and show the feature clearly for customer decision-making."
  },
  "มุมด้านหลัง": {
    mode: "Support",
    prompt: "Create a back view support image. Change only the shot type. Keep the same product, same background, same lighting, and same catalog style."
  },
  "มุมด้านข้าง": {
    mode: "Support",
    prompt: "Create a side view support image. Change only the shot type. Keep the same product, same background, same lighting, and same catalog style."
  },
  "เปิดให้เห็นด้านใน": {
    mode: "Support",
    prompt: "Create an interior or open-view support image. Show the inside lining or hidden construction clearly while preserving the exact product identity."
  }
};

const brandProfiles = {
  "go-mall": {
    label: "GO Mall - พื้นขาว + โมเดล",
    shortName: "GO Mall",
    forceOffModel: false,
    backgroundRule: "Brand CI background: clean bright white studio background, not gray and not cream. Keep it crisp, commercial, and web-catalog friendly.",
    modelRule: "Model casting: friendly social-commerce energy.",
    styleRule: "Visual style: clean white e-commerce catalog, clear retail readability, modern Thai shopping feel, product-forward and easy to compare."
  },
  "winterra": {
    label: "Winterra - พื้นครีม + โมเดล",
    shortName: "Winterra",
    forceOffModel: false,
    backgroundRule: "Brand CI background: warm cream studio background, soft ivory-beige tone, not pure white and not gray. Keep the cream tone subtle, premium, and consistent.",
    modelRule: "Model casting: slightly more premium, calm, refined, and aspirational.",
    styleRule: "Visual style: warm cream premium e-commerce catalog, softer and more refined than bright white retail catalog, modern winter travel retail, product-forward and polished."
  },
  "rent-a-coat": {
    label: "Rent A Coat - พื้นเทาอ่อน + ไม่มีโมเดล",
    shortName: "Rent A Coat",
    forceOffModel: true,
    backgroundRule: "Brand CI background: light neutral gray studio background, soft gray tone, not pure white and not cream. Keep product edges clean and shadow subtle.",
    modelRule: "Model casting: no human model for this brand profile. Product-only images only, including hero and support shots.",
    styleRule: "Visual style: light gray product-only rental catalog, practical, clear, comparison-friendly, no model, no face, no lifestyle scene."
  },
  custom: {
    label: "Custom / ไม่ล็อก CI",
    shortName: "Custom",
    forceOffModel: false,
    backgroundRule: "Brand CI background: warm white e-commerce catalog background.",
    modelRule: "Model casting: use a modern Thai influencer feel where visible, cheerful and radiant expression when the face is shown.",
    styleRule: "Custom style: warm white e-commerce catalog, soft studio lighting, clean premium winter retail look."
  }
};

const modelProfiles = [
  "ระบบเลือกโมเดลให้เหมาะกับสินค้า",
  "ผู้หญิงไทยวัยทำงาน ลุค influencer สดใส",
  "ผู้ชายไทยวัยทำงาน ลุค influencer ดูดี",
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
  "ภาพหลัก Hero - เห็นสินค้าชัดที่สุด",
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
  ["พื้นหลังและแสงไปทางเดียวกัน", "ใช้ warm white catalog style เป็นแกน"],
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
  approveButton: document.getElementById("approveButton"),
  resultCard: document.getElementById("resultCard"),
  generationState: document.getElementById("generationState"),
  generationTitle: document.getElementById("generationTitle"),
  generationHint: document.getElementById("generationHint"),
  resultImage: document.getElementById("resultImage"),
  resultStatus: document.getElementById("resultStatus"),
  emptyHero: document.getElementById("emptyHero"),
  heroStatus: document.getElementById("heroStatus"),
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
  historySearch: document.getElementById("historySearch"),
  historyStatusFilter: document.getElementById("historyStatusFilter"),
  historyCategoryFilter: document.getElementById("historyCategoryFilter"),
  jobSummary: document.getElementById("jobSummary"),
  assetGallery: document.getElementById("assetGallery"),
  assetStatus: document.getElementById("assetStatus"),
  refreshMetricsButton: document.getElementById("refreshMetricsButton"),
  metricDate: document.getElementById("metricDate"),
  metricOperatorFilter: document.getElementById("metricOperatorFilter"),
  metricFreeTextFilter: document.getElementById("metricFreeTextFilter"),
  approveRate: document.getElementById("approveRate"),
  approveRateBar: document.getElementById("approveRateBar"),
  supportSignal: document.getElementById("supportSignal"),
  historyBody: document.getElementById("historyBody"),
  metricsSummary: document.getElementById("metricsSummary"),
  metricsBody: document.getElementById("metricsBody"),
  qcList: document.getElementById("qcList"),
  qcScore: document.getElementById("qcScore"),
  brandSettingsPreview: document.getElementById("brandSettingsPreview"),
  promptSettingsPreview: document.getElementById("promptSettingsPreview"),
  googleDriveIntegrationSection: document.getElementById("googleDriveIntegrationSection"),
  googleDriveStatusPill: document.getElementById("googleDriveStatusPill"),
  googleDriveStatusText: document.getElementById("googleDriveStatusText"),
  googleDriveConnectButton: document.getElementById("googleDriveConnectButton")
};

let currentPrompt = "";
let currentGeneratedImageUrl = "";
let approvedHeroImageUrl = "";
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
let latestMetricData = null;
let supabaseClient = null;
let currentSession = null;
let currentProfile = null;
let passwordSetupRequired = false;
let passwordChangeInProgress = false;
let authFlowInProgress = false;
const authGateStates = ["auth-loading", "logged-out", "blocked", "password-required", "app-ready"];

const pageMeta = {
  create: { eyebrow: "Prompt Tools", title: "สร้างภาพสินค้า" },
  jobs: { eyebrow: "Production Control", title: "งานทั้งหมด" },
  assets: { eyebrow: "Asset Library", title: "คลังภาพ" },
  kpi: { eyebrow: "Team Performance", title: "KPI Dashboard" },
  settings: { eyebrow: "Admin", title: "ตั้งค่าระบบภาพ" }
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
  fillSelect(els.historyCategoryFilter, [{ label: "ทุกหมวด", value: "" }, ...Object.keys(categories).map((category) => ({ label: category, value: category }))]);
  if (els.metricDate) els.metricDate.value = getTodayInputDate();
  renderQc();
  renderSupportShots();
  renderFilePreview(els.productImages, els.productPreview, 10);
  renderFilePreview(els.modelImages, els.modelPreview, 5);
  renderHistory();
  renderAssets();
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

    const { data } = await supabaseClient.auth.getSession();
    currentSession = data.session || null;
    await resolveAuthGate();

    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      currentSession = session || null;
      if (passwordChangeInProgress || authFlowInProgress) return;
      if (event === "SIGNED_OUT") {
        clearFrontendAuthState();
        window.history.replaceState({}, document.title, `${window.location.pathname}#create`);
        showAuthGate("logged-out");
        return;
      }
      if (event === "TOKEN_REFRESHED") {
        updateAuthUi(currentSession);
        return;
      }
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED") {
        await resolveAuthGate();
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

async function resolveAuthGate() {
  if (currentSession?.user) {
    await refreshCurrentSession();
  }

  if (!currentSession?.user) {
    resetProfileState();
    showAuthGate("logged-out");
    return;
  }

  try {
    currentProfile = await loadCurrentProfile();
  } catch (error) {
    resetProfileState();
    showBlocked(getProfileErrorMessage(error));
    return;
  }

  if (!currentProfile?.profile_exists) {
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
  applyRoleUi();

  if (passwordSetupRequired) {
    updateAuthUi(currentSession);
    showAuthGate("password-required");
    return;
  }

  showAuthGate("app-ready");
  updateAuthUi(currentSession);
  refreshJobHistory();
  refreshMetrics();
  updateWorkflowGate();
  navigateToPage(getPageFromHash());
}

async function refreshCurrentSession() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;
  currentSession = data.session || null;
  return currentSession;
}

async function refreshSessionProfileAndAppState() {
  await refreshCurrentSession();
  if (!currentSession?.access_token) {
    throw new Error("Session หมดอายุ กรุณา login ใหม่");
  }

  currentProfile = await loadCurrentProfileWithToken(currentSession.access_token);
  passwordSetupRequired = currentProfile.must_change_password === true;
  applyRoleUi();

  if (passwordSetupRequired) {
    updateAuthUi(currentSession);
    showAuthGate("password-required");
    return currentProfile;
  }

  showAuthGate("app-ready");
  updateAuthUi(currentSession);
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
  if (!data.profile_exists) {
    throw new Error("บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
  }
  if (!data.is_active) {
    throw new Error("บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
  }
  return data;
}

async function getLatestAccessToken() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;
  currentSession = data.session || null;
  const token = currentSession?.access_token;
  if (!token) throw new Error("Session หมดอายุ กรุณา login ใหม่");
  return token;
}

function resetProfileState() {
  currentProfile = null;
  passwordSetupRequired = false;
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
  dbJobHistory = [];
  jobHistoryError = "";
  latestMetricData = null;
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
  currentJobId = "";
  currentHeroGenerationId = "";
  lastSubmittedQcKey = "";
  lastRecordedApprovalGenerationId = "";
  supportResults = [];
  customSupportShots = [];
  setHeroLoading(false);
  els.generateButton.disabled = true;
  els.approveButton.disabled = true;
  els.generateSupportButton.disabled = true;
  els.approveSupportButton.disabled = true;
  els.generateButton.textContent = "Generate Hero";
  els.approveButton.textContent = "Approve + Save";
  els.generateSupportButton.textContent = "Generate Support Set";
  els.approveSupportButton.textContent = "Approve Support Set";
  els.resultImage.hidden = true;
  els.resultImage.removeAttribute("src");
  els.resultStatus.textContent = "";
  els.emptyHero.hidden = false;
  resetQc();
  renderSupportShots();
  renderSupportGallery();
  renderAssets();
}

function showAuthGate(state) {
  authGateStates.forEach((gateState) => document.body.classList.remove(gateState));
  document.body.classList.add(state);
  els.authLoadingView.hidden = state !== "auth-loading";
  els.authLoginView.hidden = state !== "logged-out";
  els.authBlockedView.hidden = state !== "blocked";
  els.authPasswordView.hidden = state !== "password-required";

  if (state === "logged-out") {
    els.gateLoginMessage.textContent = "";
    els.gateLoginMessage.classList.remove("is-success");
    setTimeout(() => els.gateLoginEmail.focus(), 0);
  }
  if (state === "password-required") {
    setPasswordSetupMessage("");
    setTimeout(() => els.passwordSetupNew.focus(), 0);
  }
}

function showBlocked(message) {
  els.authBlockedMessage.textContent = message;
  els.authBlockedLogoutButton.hidden = !currentSession;
  showAuthGate("blocked");
}

function isAppReady() {
  return document.body.classList.contains("app-ready") && Boolean(currentSession?.access_token) && !passwordSetupRequired && currentProfile?.is_active;
}

function isAdmin() {
  return currentProfile?.role === "admin";
}

function applyRoleUi() {
  const settingsLink = els.pageNav.querySelector('[data-page-link="settings"]');
  if (settingsLink) settingsLink.hidden = !isAdmin();
  if (els.googleDriveIntegrationSection) els.googleDriveIntegrationSection.hidden = !isAdmin();
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
  const isLoggedIn = Boolean(session?.user);
  const canUseApp = isAppReady();
  const email = currentProfile?.email || session?.user?.email || "";
  const roleLabel = currentProfile?.role ? ` · ${currentProfile.role}` : "";
  els.authCard.classList.toggle("is-logged-in", isLoggedIn);
  els.loginForm.hidden = isLoggedIn;
  els.logoutButton.hidden = !isLoggedIn;
  els.generateButton.disabled = !canUseApp;
  els.generateSupportButton.disabled = !canUseApp || !isQcComplete() || !approvedHeroImageUrl;

  els.authState.innerHTML = isLoggedIn
    ? `<strong>${passwordSetupRequired ? "ต้องตั้งรหัสผ่าน" : "เข้าสู่ระบบแล้ว"}</strong><span>${escapeHtml(message || `${email}${roleLabel}`)}</span>`
    : `<strong>ยังไม่ได้เข้าสู่ระบบ</strong><span>${escapeHtml(message || "Login ก่อน Generate / KPI / Ops")}</span>`;
}

async function getAccessToken({ allowPasswordRequired = false } = {}) {
  if (!supabaseClient) throw new Error("Supabase client is not ready.");
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;
  currentSession = data.session || null;
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
  const { allowPasswordRequired = false, ...fetchOptions } = options;
  const token = await getAccessToken({ allowPasswordRequired });
  const headers = new Headers(fetchOptions.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...fetchOptions, headers });
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
  return fetchWithTimeout((signal) => authFetch(url, { ...options, signal }), timeoutMs, timeoutMessage);
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
  return data?.error || fallback;
}

async function refreshSystemStatus() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    const pending = data.queue?.pending || 0;
    const active = data.queue?.active || 0;
    const drive = data.googleDriveApiConfigured ? "Google Drive ready" : data.driveOutputConfigured ? "Drive ready" : "Local save";
    els.systemStatus.textContent = active || pending ? `Queue ${active}/${pending}` : `Ready · ${drive}`;
  } catch {
    els.systemStatus.textContent = "Offline";
  }
}

function getPageFromHash() {
  const page = window.location.hash.replace("#", "").trim();
  return pageMeta[page] ? page : "create";
}

function navigateToPage(page) {
  let targetPage = pageMeta[page] ? page : "create";
  if (targetPage === "settings" && !isAdmin()) {
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

  if (targetPage === "jobs") {
    renderHistory();
    if (isAppReady()) refreshJobHistory();
  }
  if (targetPage === "assets") renderAssets();
  if (targetPage === "kpi") renderMetricsFromCache();
  if (targetPage === "settings") {
    renderSettingsPreview();
    refreshGoogleDriveStatus();
  }
}

function bindEvents() {
  els.gateLoginForm.addEventListener("submit", handleLogin);
  els.loginForm.addEventListener("submit", handleLogin);
  els.logoutButton.addEventListener("click", handleLogout);
  els.authBlockedLogoutButton.addEventListener("click", handleLogout);
  els.passwordSetupForm.addEventListener("submit", handlePasswordSetup);

  window.addEventListener("hashchange", () => navigateToPage(getPageFromHash()));
  els.pageNav.addEventListener("click", (event) => {
    const link = event.target.closest("[data-page-link]");
    if (!link) return;
    event.preventDefault();
    const page = link.dataset.pageLink;
    window.location.hash = page;
    navigateToPage(page);
  });

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    buildPrompt();
  });

  els.copyButton.addEventListener("click", async () => {
    if (!currentPrompt) buildPrompt();
    await navigator.clipboard.writeText(currentPrompt);
    els.copyButton.textContent = "คัดลอกแล้ว";
    setTimeout(() => (els.copyButton.textContent = "คัดลอก"), 1200);
  });

  els.generateButton.addEventListener("click", generateImage);
  els.approveButton.addEventListener("click", approveImage);
  els.googleDriveConnectButton.addEventListener("click", connectGoogleDrive);
  els.refreshMetricsButton.addEventListener("click", refreshMetrics);
  els.metricDate.addEventListener("change", refreshMetrics);
  els.metricOperatorFilter.addEventListener("input", renderMetricsFromCache);
  els.metricFreeTextFilter.addEventListener("input", renderMetricsFromCache);
  els.historySearch.addEventListener("input", renderHistory);
  els.historyStatusFilter.addEventListener("change", renderHistory);
  els.historyCategoryFilter.addEventListener("change", renderHistory);
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
  els.supportGallery.addEventListener("click", (event) => {
    const rerunButton = event.target.closest("[data-rerun-support]");
    if (!rerunButton) return;
    rerunSupportImage(Number(rerunButton.dataset.rerunSupport));
  });
  els.productImages.addEventListener("change", () => renderFilePreview(els.productImages, els.productPreview, 10));
  els.modelImages.addEventListener("change", () => renderFilePreview(els.modelImages, els.modelPreview, 5));
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
    currentJobId = "";
    currentHeroGenerationId = "";
    lastSubmittedQcKey = "";
    lastRecordedApprovalGenerationId = "";
    supportResults = [];
    customSupportShots = [];
    resetQc();
    els.promptOutput.textContent = "กรอกข้อมูลงาน แล้วกด “สร้าง Prompt”";
    els.resultCard.hidden = true;
    els.emptyHero.hidden = false;
    setHeroLoading(false);
    els.resultImage.removeAttribute("src");
    els.resultStatus.textContent = "";
    renderFilePreview(els.productImages, els.productPreview, 10);
    renderFilePreview(els.modelImages, els.modelPreview, 5);
    updateHeroStatus();
    renderSupportShots();
    renderSupportGallery();
    renderAssets();
    updateMeta("-", "-", "waiting");
    applyBrandProfileUiHints();
  });

  els.clearHistoryButton.addEventListener("click", () => {
    localJobHistory = [];
    jobHistory = mergeJobHistory();
    saveJobHistory();
    renderHistory();
  });
}

async function handleLogin(event) {
  event.preventDefault();
  if (!supabaseClient) {
    els.gateLoginMessage.textContent = "Supabase ยังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบ";
    return;
  }

  const isGateLogin = event.currentTarget === els.gateLoginForm;
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
    const message = `Login ไม่สำเร็จ: ${getSafeAuthErrorMessage(error)}`;
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

  try {
    authFlowInProgress = true;
    const { error } = await promiseWithTimeout(
      supabaseClient.auth.signOut(),
      10000,
      "ออกจากระบบใช้เวลานานผิดปกติ กรุณาลองใหม่อีกครั้ง"
    );
    if (error) throw error;

    clearFrontendAuthState();
    window.history.replaceState({}, document.title, `${window.location.pathname}#create`);
    showAuthGate("logged-out");
  } catch (error) {
    const message = `ออกจากระบบไม่สำเร็จ: ${getSafeAuthErrorMessage(error)}`;
    try {
      const { data } = await supabaseClient.auth.getSession();
      currentSession = data.session || null;
      if (!currentSession) {
        clearFrontendAuthState();
        window.history.replaceState({}, document.title, `${window.location.pathname}#create`);
        showAuthGate("logged-out");
        els.gateLoginMessage.textContent = "ออกจากระบบแล้ว";
        els.gateLoginMessage.classList.add("is-success");
        return;
      }
    } catch {
      currentSession = null;
    }

    if (!currentSession) {
      clearFrontendAuthState();
      showBlocked(message);
      return;
    }

    updateAuthUi(currentSession, message);
    if (!document.body.classList.contains("app-ready")) {
      showBlocked(message);
    }
  }
  finally {
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
  if (!isAppReady()) {
    els.resultCard.hidden = false;
    els.emptyHero.hidden = false;
    els.resultStatus.textContent = "กรุณาเข้าสู่ระบบและตรวจสอบสิทธิ์ให้เรียบร้อยก่อน Generate";
    updateAuthUi(currentSession);
    return;
  }

  buildPrompt();

  const validationMessage = validateInputFiles();
  if (validationMessage) {
    els.resultCard.hidden = false;
    els.resultStatus.textContent = validationMessage;
    return;
  }

  els.resultCard.hidden = false;
  els.emptyHero.hidden = true;
  els.resultImage.hidden = true;
  els.resultImage.removeAttribute("src");
  setHeroLoading(true, "กำลังสร้างภาพ Hero", "ระบบกำลังอัปโหลด reference และส่งงานเข้า AI queue");
  els.resultStatus.textContent = "กำลังเริ่มงาน generate...";
  els.generateButton.disabled = true;
  els.approveButton.disabled = true;
  els.generateButton.textContent = "Generating...";

  try {
    const formData = buildGenerateFormData(currentPrompt, [], { jobKind: "hero", shot: "Hero" });
    const data = await startGenerationJob(formData, (job) => {
      setHeroLoading(true, getJobTitle(job), job.message || "กำลังทำงาน");
      els.resultStatus.textContent = `${getJobTitle(job)} · ${job.message || ""}`;
    });

    currentJobId = data.jobId || currentJobId;
    currentHeroGenerationId = data.generationId || "";
    currentGeneratedImageUrl = data.images[0].url;
    approvedHeroImageUrl = "";
    lastSubmittedQcKey = "";
    lastRecordedApprovalGenerationId = "";
    supportResults = [];
    resetQc();
    els.emptyHero.hidden = true;
    setHeroLoading(false);
    els.resultImage.hidden = false;
    els.resultImage.src = currentGeneratedImageUrl;
    els.resultStatus.textContent = `Generate สำเร็จ Request ID: ${data.requestId || "-"}`;
    updateHeroStatus();
    updateWorkflowGate();
    renderSupportGallery();
    renderAssets();
    refreshMetrics();
    refreshJobHistory();
  } catch (error) {
    setHeroLoading(false);
    els.emptyHero.hidden = false;
    els.resultStatus.textContent = `Generate ไม่สำเร็จ: ${getSafeAuthErrorMessage(error) || "ส่งงาน generate ไม่สำเร็จ"}`;
  } finally {
    els.generateButton.disabled = !isAppReady();
    els.approveButton.disabled = !currentGeneratedImageUrl;
    els.generateButton.textContent = "Generate Hero";
  }
}

function setHeroLoading(isLoading, title = "", hint = "") {
  els.generationState.hidden = !isLoading;
  els.resultCard.classList.toggle("is-generating", isLoading);
  if (title) els.generationTitle.textContent = title;
  if (hint) els.generationHint.textContent = hint;
}

async function approveImage() {
  if (!currentGeneratedImageUrl) {
    els.resultStatus.textContent = "ยังไม่มีภาพ generated สำหรับ approve";
    return;
  }

  els.approveButton.disabled = true;
  els.approveButton.textContent = "Saving...";

  try {
    const response = await authFetchWithTimeout("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl: currentGeneratedImageUrl,
        jobName: getJobBaseName("approved-product"),
        generationId: currentHeroGenerationId,
        ...getRequestMetadata({ jobKind: "hero", shot: "Hero", jobId: currentJobId })
      })
    }, 90000, "Approve + Save ใช้เวลานานผิดปกติ กรุณาลองใหม่อีกครั้ง");
    const data = await readJsonResponse(response, "Approve + Save ไม่สำเร็จ: server ส่งข้อมูลกลับมาไม่ถูกต้อง");

    if (!response.ok || !data.ok) {
      throw new Error(getApiErrorMessage(response, data, "Approve + Save ไม่สำเร็จ"));
    }

    els.resultStatus.textContent = getApprovalMessage(data);
    await recordApproval(data);
    approvedHeroImageUrl = currentGeneratedImageUrl;
    updateHeroStatus();
    updateWorkflowGate();
    renderAssets();

    addHistoryItem({
      name: getJobBaseName("Approved product"),
      type: els.imageType.value,
      category: els.category.value,
      status: "Hero Approved"
    });
    refreshMetrics();
  } catch (error) {
    els.resultStatus.textContent = `Approve ไม่สำเร็จ: ${getSafeAuthErrorMessage(error)}`;
  } finally {
    els.approveButton.disabled = false;
    els.approveButton.textContent = "Approve + Save";
  }
}

async function generateSupportSet() {
  const heroUrl = approvedHeroImageUrl || currentGeneratedImageUrl;
  const selectedShots = getSelectedSupportShots();
  const validationMessage = validateInputFiles();

  if (!heroUrl) {
    renderSupportMessage("ต้อง Generate และ Approve Hero ก่อน หรืออย่างน้อยต้องมีภาพ Hero ที่ generate สำเร็จ");
    return;
  }

  if (!approvedHeroImageUrl) {
    renderSupportMessage("แนะนำให้กด Approve Hero ก่อน เพื่อใช้ภาพที่ผ่าน QC แล้วเป็น anchor");
    return;
  }

  if (!isQcComplete()) {
    renderSupportMessage("ต้อง QC ให้ครบ 7/7 ก่อน Generate Support Set เพื่อยืนยันว่า Hero พร้อมใช้เป็น anchor");
    return;
  }

  if (validationMessage) {
    renderSupportMessage(validationMessage);
    return;
  }

  if (!selectedShots.length) {
    renderSupportMessage("เลือกช็อตรองอย่างน้อย 1 ช็อตก่อน Generate Support Set");
    return;
  }

  supportResults = selectedShots.map((shot) => ({ shot, status: "waiting", imageUrl: "" }));
  renderSupportGallery();
  els.generateSupportButton.disabled = true;
  els.generateSupportButton.textContent = "Generating set...";

  for (let index = 0; index < selectedShots.length; index += 1) {
    const shot = selectedShots[index];
    supportResults[index].status = "generating";
    renderSupportGallery();

    try {
      const prompt = buildSupportPrompt(shot, index + 1, selectedShots.length);
      const data = await startGenerationJob(buildGenerateFormData(prompt, [approvedHeroImageUrl], { jobKind: "support", shot, jobId: currentJobId }), (job) => {
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
  els.generateSupportButton.textContent = "Generate Support Set";
}

async function approveSupportSet() {
  const readyItems = supportResults.filter((item) => item.imageUrl && item.status === "done");
  if (!readyItems.length) {
    renderSupportMessage("ยังไม่มีภาพ support ที่พร้อม approve");
    return;
  }

  els.approveSupportButton.disabled = true;
  els.approveSupportButton.textContent = "Saving set...";

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
        }, 90000, "Approve + Save ใช้เวลานานผิดปกติ กรุณาลองใหม่อีกครั้ง");
        const data = await readJsonResponse(response, "Approve + Save ไม่สำเร็จ: server ส่งข้อมูลกลับมาไม่ถูกต้อง");
        if (!response.ok || !data.ok) throw new Error(getApiErrorMessage(response, data, "Approve + Save ไม่สำเร็จ"));
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
      name: `${getJobBaseName("Support set")} (${savedCount} ภาพ)`,
      type: "Support Set",
      category: els.category.value,
      status: savedCount === readyItems.length ? "Approved" : "Partial"
    });

    updateWorkflowGate();
    refreshMetrics();
  } finally {
    els.approveSupportButton.disabled = false;
    els.approveSupportButton.textContent = "Approve Support Set";
  }
}

async function rerunSupportImage(index) {
  const item = supportResults[index];
  if (!item) return;

  if (!approvedHeroImageUrl) {
    supportResults[index] = { ...item, status: "rerun blocked: ต้องมี Hero ที่ Approve แล้วก่อน" };
    renderSupportGallery();
    return;
  }

  if (!isQcComplete()) {
    supportResults[index] = { ...item, status: "rerun blocked: ต้อง QC ให้ครบ 7/7 ก่อน" };
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
    status: "rerun: preparing",
    imageUrl: previousImageUrl,
    requestId: "",
    savedPath: ""
  };
  renderSupportGallery();

  try {
    const prompt = `${buildSupportPrompt(item.shot, index + 1, supportResults.length || 1)}
Rerun correction: regenerate only this support shot from the approved hero anchor. Pay extra attention to preserving every visible product detail from the hero, including logo patches, labels, zipper pulls, stitching, fur/lining, material texture, color, shape, and proportions. If a logo or detail exists on the hero/reference product, keep it visible and consistent in this support shot.`;

    const data = await startGenerationJob(buildGenerateFormData(prompt, [approvedHeroImageUrl], { jobKind: "support-rerun", shot: item.shot, jobId: currentJobId }), (job) => {
      supportResults[index] = {
        ...supportResults[index],
        status: `rerun: ${getJobTitle(job)}${job.message ? ` · ${job.message}` : ""}`,
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
      status: `rerun error: ${error.message}`,
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
  return formData;
}

function getRequestMetadata(overrides = {}) {
  const subtype = getSelectedSubtype();
  return {
    operatorName: els.operatorName.value.trim() || "ไม่ระบุผู้ใช้งาน",
    sku: els.productSku.value.trim(),
    productName: getJobBaseName("Untitled product"),
    brand: els.brandName.value.trim(),
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
  const response = await authFetchWithTimeout("/api/generate/start", {
    method: "POST",
    body: formData
  }, 90000, "ระบบใช้เวลานานผิดปกติ กรุณาลองใหม่อีกครั้ง");
  const startData = await readJsonResponse(response, "เริ่มงาน Generate ไม่สำเร็จ: server ส่งข้อมูลกลับมาไม่ถูกต้อง");

  if (!response.ok || !startData.ok) {
    throw new Error(getApiErrorMessage(response, startData, "ส่งงาน generate ไม่สำเร็จ"));
  }

  onProgress(startData.job);
  const data = await pollGenerationJob(startData.jobId, onProgress);
  return {
    ...data,
    jobId: startData.databaseJobId || startData.jobId,
    generationId: startData.generationId || data.generationId || ""
  };
}

async function pollGenerationJob(jobId, onProgress) {
  let failedPolls = 0;
  const startedAt = Date.now();
  const maxWaitMs = 12 * 60 * 1000;
  for (;;) {
    if (Date.now() - startedAt > maxWaitMs) {
      throw new Error("ระบบใช้เวลานานผิดปกติ กรุณาลองใหม่อีกครั้ง");
    }
    await delay(1800);
    try {
      const response = await fetch(`/api/generate/jobs/${encodeURIComponent(jobId)}`);
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
        throw new Error(job.error || job.message || "Generation failed");
      }

      failedPolls = 0;
    } catch (error) {
      failedPolls += 1;
      if (failedPolls >= 8) {
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
    uploading: "กำลังอัปโหลด reference",
    generating: "กำลังสร้างภาพ",
    reconnecting: "กำลังเชื่อมต่อใหม่",
    done: "Generate สำเร็จ",
    error: "Generate ไม่สำเร็จ"
  };
  return titles[job.status] || "กำลังทำงาน";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validateInputFiles() {
  const productFiles = Array.from(els.productImages.files || []);
  const modelFiles = getSelectedBrandProfile().forceOffModel ? [] : Array.from(els.modelImages.files || []);
  if (!productFiles.length) return "กรุณาอัปโหลดภาพสินค้าอย่างน้อย 1 รูป";
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

function getCiSafetyRule() {
  return "CI safety rule: the selected visual profile is only for background color, lighting, casting, crop, and mood. Do not add any store/business brand name, store/business logo, watermark, hangtag, packaging, sign, advertising text, or graphic badge to the image. Preserve real product logos, product labels, product patches, and product text only when they already exist on the attached product reference or approved hero. If the product has no real brand mark in the reference and no product brand is provided, keep the product completely unbranded.";
}

function applyBrandProfileUiHints() {
  const brandProfile = getSelectedBrandProfile();
  if (brandProfile.forceOffModel && els.imageType.value === "ใส่กับโมเดล") {
    els.imageType.value = "สินค้าเดี่ยวบนพื้นขาว";
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
  const selectedType = imageTypes[els.imageType.value];
  const selectedCategory = categories[els.category.value];
  const selectedSubtype = getSelectedSubtype();
  const brandProfile = getSelectedBrandProfile();
  const effectiveMode = getEffectiveMode(selectedType, brandProfile);
  const isOnModel = effectiveMode === "On-model";
  const categoryModule = isOnModel ? selectedCategory.on : selectedCategory.off;
  const brand = els.brandName.value.trim();
  const keyFeature = els.keyFeature.value.trim() || "key product details visible in the reference image";
  const color = els.color.value.trim() || "the exact product color from the image reference";
  const shotType = els.shotType.value === "ระบบเลือกให้อัตโนมัติ" ? "the most suitable catalog angle" : els.shotType.value;
  const imageRef = els.imageReference.value.trim() || "[attached image reference]";
  const productCount = els.productImages.files?.length || 0;
  const modelCount = brandProfile.forceOffModel ? 0 : els.modelImages.files?.length || 0;
  const notes = els.notes.value.trim();
  const model = els.modelProfile.value;

  const brandRule = brand
    ? `Preserve the authentic ${brand} branding, logo patches, labels, and recognizable design details exactly. Do not invent or alter branding.`
    : "Product mark rule: if the reference product visibly has a real logo, label, patch, badge, woven tag, or printed product text, preserve it exactly as a product detail. If no such mark exists in the reference, do not add any fake logos, patches, labels, or brand marks.";

  const modelRule = isOnModel
    ? `Model profile: ${model === "ระบบเลือกโมเดลให้เหมาะกับสินค้า" ? getAutoModelDirection(els.category.value) : model}. ${getCropDirection(els.category.value)} ${brandProfile.modelRule} Keep the model aspirational but not over-posed, and keep the product as the main selling focus.`
    : brandProfile.forceOffModel ? brandProfile.modelRule : "No human model. Product-only catalog image.";

  const heroRule = getHeroRule(els.category.value, effectiveMode);

  currentPrompt = [
    `Use ${imageRef} as the exact product identity reference.`,
    getBrandImagePrompt(selectedType, brandProfile, effectiveMode),
    "",
    getCiSafetyRule(),
    `Category: ${els.category.value}`,
    `Product subtype: ${selectedSubtype.label}`,
    `Color: ${color}`,
    `Key feature: ${keyFeature}`,
    `Requested shot: ${shotType}`,
    `Attached product reference images: ${productCount || "none yet"} image(s). Product references are the strict source of truth for product identity, color, logo, silhouette, materials, construction, and details.`,
    `Attached model reference images: ${modelCount || "none"} image(s). Model references are used only for model face, expression, styling direction, body proportion, and pose consistency when on-model output is requested.`,
    "",
    categoryModule,
    getSubtypePromptRule(),
    modelRule,
    brandRule,
    getCiSafetyRule(),
    heroRule,
    getLayeringRule(els.category.value, effectiveMode),
    getStylingVariationRule(els.category.value, effectiveMode),
    "",
    `Global style rules: ${brandProfile.backgroundRule} ${brandProfile.styleRule} Soft studio lighting, realistic material texture, centered composition, sharp product details, no extra objects unless requested.`,
    "Product preservation rules: keep the same silhouette, proportions, construction, fabric, seams, pockets, zipper, outsole, lining, labels, color, and all visible details from the reference. Do not redesign the product.",
    "Output rules: image must be web-ready, high detail, clean edges, no warped product, no incorrect text, no fake branding, no duplicate products, no distorted anatomy.",
    notes ? `Additional staff note: ${notes}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  els.promptOutput.textContent = currentPrompt;
  updateMeta(effectiveMode, els.category.value, getRisk(brand, keyFeature));
  return currentPrompt;
}

function buildSupportPrompt(shot, shotIndex, totalShots) {
  const selectedType = imageTypes[els.imageType.value];
  const selectedCategory = categories[els.category.value];
  const selectedSubtype = getSelectedSubtype();
  const brandProfile = getSelectedBrandProfile();
  const baseMode = getEffectiveMode(selectedType, brandProfile);
  const isOnModel = baseMode === "On-model";
  const brand = els.brandName.value.trim();
  const keyFeature = els.keyFeature.value.trim() || "the product's most important visible detail";
  const color = els.color.value.trim() || "the exact product color from the reference";
  const notes = els.notes.value.trim();
  const categoryModule = isOnModel ? selectedCategory.on : selectedCategory.off;

  const brandRule = brand
    ? `Preserve the authentic ${brand} branding, logo patches, labels, and recognizable design details exactly.`
    : "Product mark rule: preserve any real logo, label, patch, badge, woven tag, or printed product text that is visible on the approved hero or product references. Do not add fake logos or new brand marks that are not in the references.";

  return [
    `Create support image ${shotIndex} of ${totalShots} for the same product page.`,
    "The first reference image is the approved hero image. Treat it as the primary identity and style anchor for this support set.",
    isOnModel
      ? "Hero identity lock: preserve the same model/person from the approved hero image whenever a person is visible. Keep the same face identity, age range, skin tone, body proportion, hair impression, styling energy, and overall look. Do not create a different model, different face, different ethnicity, or different person."
      : "Hero identity lock: preserve the same product-only presentation from the approved hero image. Do not add a human model, face, body part, mannequin, or lifestyle scene unless the requested shot explicitly requires minimal wearing context.",
    "Use the attached real product reference images as the strict source of truth for product identity. If the hero image and product reference conflict, follow the real product reference.",
    "",
    getCiSafetyRule(),
    `Category: ${els.category.value}`,
    `Product subtype: ${selectedSubtype.label}`,
    `Color: ${color}`,
    `Key feature: ${keyFeature}`,
    `Support shot requested: ${shot}`,
    "",
    brandProfile.backgroundRule,
    brandProfile.styleRule,
    getCiSafetyRule(),
    categoryModule,
    getSubtypePromptRule(),
    getSupportShotInstruction(els.category.value, shot),
    getSupportCropRule(els.category.value, shot),
    isOnModel
      ? `Model direction: keep the same person from the approved hero. ${getCropDirection(els.category.value)} ${brandProfile.modelRule} Keep the same influencer-level freshness and believable winter layering as the hero.`
      : brandProfile.forceOffModel
        ? "No human model for this brand profile. Product-only support images only."
        : "No human model unless the requested shot specifically needs body context to explain scale or wearing position.",
    brandRule,
    getLayeringRule(els.category.value, baseMode),
    getStylingVariationRule(els.category.value, baseMode),
    "",
    "Consistency lock: keep the same product identity, product color, material texture, proportions, real product logos/labels/patches when visible in the hero/reference, approved hero model identity when present, and selected visual CI catalog style across the whole set.",
    "Change only the requested shot/crop/angle/detail. Do not redesign the product, do not change the person from the hero, do not add unrelated props, do not invent text, and do not create fake branding.",
    notes ? `Additional staff note: ${notes}` : ""
  ]
    .filter(Boolean)
    .join("\n");
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
  if (shot === "เปิดให้เห็นด้านใน / ซับใน" || /(ซับใน|ซับขน|บุด้านใน|lining|interior)/i.test(shot)) {
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
  els.promptMode.textContent = `Mode: ${mode}`;
  els.promptCategory.textContent = `Category: ${category}`;
  els.promptRisk.textContent = `Risk: ${risk}`;
}

function updateHeroStatus() {
  if (approvedHeroImageUrl) {
    els.heroStatus.textContent = isQcComplete() ? "Hero approved + QC 7/7" : "Hero approved · รอ QC";
    els.heroStatus.classList.toggle("ready", isQcComplete());
    return;
  }
  if (currentGeneratedImageUrl) {
    els.heroStatus.textContent = "รอ Approve Hero";
    els.heroStatus.classList.remove("ready");
    return;
  }
  els.heroStatus.textContent = "ยังไม่มี Hero";
  els.heroStatus.classList.remove("ready");
}

function canGenerateSupport() {
  return Boolean(approvedHeroImageUrl) && isQcComplete();
}

function updateWorkflowGate() {
  const ready = canGenerateSupport();
  const hasSession = Boolean(currentSession?.access_token);
  const isLoggedIn = isAppReady();
  els.generateSupportButton.disabled = !ready || !isLoggedIn;
  els.approveSupportButton.disabled = !supportResults.some((item) => item.imageUrl && item.status === "done");
  els.supportStatus.textContent = ready ? "พร้อมทำช็อตรอง" : "ล็อกอยู่";
  els.supportStatus.classList.toggle("ready", ready);
  els.generateSupportButton.title = ready
    ? isLoggedIn
      ? "พร้อม Generate Support Set"
      : hasSession
        ? "กรุณาตั้งรหัสผ่านใหม่ก่อน Generate Support Set"
        : "กรุณา Login ก่อน Generate Support Set"
    : "ต้อง Approve Hero และ QC ครบ 7/7 ก่อน";
  updateHeroStatus();
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
    els.supportGallery.innerHTML = '<p class="empty-state">ยังไม่มีภาพ support</p>';
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
    return `Approve แล้ว และอัปโหลดเข้า Google Drive API${data.googleDriveFile.skuMatched ? " ตามโฟลเดอร์ SKU" : ""}: ${data.googleDriveFile.webViewLink}`;
  }
  if (data.drivePath) {
    return `Approve แล้ว และบันทึกเข้า Drive sync folder${data.skuMatched ? " ตามโฟลเดอร์ SKU" : ""}: ${data.drivePath}`;
  }
  if (data.localDeleted) {
    return "Approve แล้ว และลบไฟล์ local หลังส่งออกสำเร็จ";
  }
  return `Approve แล้ว บันทึกที่: ${data.approvedPath}`;
}

function renderSupportMessage(message) {
  els.supportGallery.innerHTML = `<p class="empty-state">${escapeHtml(message)}</p>`;
}

function renderAssets() {
  const assets = [];
  if (currentGeneratedImageUrl) {
    assets.push({
      label: approvedHeroImageUrl ? "Hero approved" : "Hero draft",
      title: getJobBaseName("Hero image"),
      imageUrl: currentGeneratedImageUrl,
      status: approvedHeroImageUrl ? "พร้อมใช้เป็น anchor" : "รอ approve"
    });
  }

  supportResults.forEach((item) => {
    if (!item.imageUrl) return;
    assets.push({
      label: "Support",
      title: item.shot,
      imageUrl: item.imageUrl,
      status: item.savedPath ? "uploaded" : item.status
    });
  });

  els.assetStatus.textContent = assets.length ? `${assets.length} ภาพ` : "รอภาพ";
  els.assetStatus.classList.toggle("ready", assets.length > 0);

  if (!assets.length) {
    els.assetGallery.innerHTML = '<p class="empty-state">ยังไม่มีภาพใน workflow นี้</p>';
    return;
  }

  els.assetGallery.innerHTML = assets
    .map(
      (asset) => `
        <article class="asset-card">
          <img src="${escapeHtml(asset.imageUrl)}" alt="${escapeHtml(asset.title)}">
          <div>
            <strong>${escapeHtml(asset.title)}</strong>
            <span>${escapeHtml(asset.label)} · ${escapeHtml(asset.status || "-")}</span>
          </div>
        </article>
      `
    )
    .join("");
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
    const response = await fetch("/api/google/oauth/status");
    const data = await response.json();
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
      els.googleDriveStatusText.textContent = "Google Drive ยังไม่ได้เชื่อมต่อ กรุณาให้ Admin เชื่อมต่อก่อน";
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
  if (!currentSession) return;
  try {
    const response = await authFetch("/api/jobs?limit=80");
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Cannot load jobs");

    dbJobHistory = (data.jobs || []).map(mapDbJobToHistoryItem);
    jobHistoryError = "";
    jobHistory = mergeJobHistory();
    renderHistory();
  } catch (error) {
    jobHistoryError = error.message;
    jobHistory = mergeJobHistory();
    renderHistory();
  }
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
    draft: "Draft",
    queued: "Queued",
    generating: "Generating",
    hero_ready: "Hero Ready",
    failed: "Failed"
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
  const query = els.historySearch.value.trim().toLowerCase();
  const status = els.historyStatusFilter.value;
  const category = els.historyCategoryFilter.value;
  const filteredItems = jobHistory.filter((item) => {
    const haystack = `${item.name || ""} ${item.type || ""} ${item.category || ""} ${item.status || ""} ${item.time || ""}`.toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (status && item.status !== status) return false;
    if (category && item.category !== category) return false;
    return true;
  });

  renderJobSummary(filteredItems);

  if (!filteredItems.length) {
    els.historyBody.innerHTML = `<tr><td colspan="4" class="empty-state">${escapeHtml(jobHistoryError ? `โหลด jobs จาก database ไม่สำเร็จ: ${jobHistoryError}` : "ยังไม่มีประวัติงาน")}</td></tr>`;
    return;
  }

  els.historyBody.innerHTML = filteredItems
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)}<br><span class="table-muted">${escapeHtml(item.time || "-")}</span></td>
          <td>${escapeHtml(item.type)}</td>
          <td>${escapeHtml(item.category)}</td>
          <td>${escapeHtml(item.status)}</td>
        </tr>
      `
    )
    .join("");
}

function renderJobSummary(items) {
  const approvedCount = items.filter((item) => /(approved|hero ready|hero_ready)/i.test(`${item.status || ""} ${item.rawStatus || ""}`)).length;
  const categoryCount = new Set(items.map((item) => item.category).filter(Boolean)).size;
  els.jobSummary.innerHTML = `
    <span>${items.length.toLocaleString("th-TH")} งาน</span>
    <span>${approvedCount.toLocaleString("th-TH")} งาน approved</span>
    <span>${categoryCount.toLocaleString("th-TH")} หมวดสินค้า</span>
  `;
}

async function refreshMetrics() {
  if (!els.metricsBody || !els.metricsSummary) return;

  try {
    const date = els.metricDate.value || getTodayInputDate();
    const response = await authFetch(`/api/metrics?date=${encodeURIComponent(date)}`);
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Cannot load metrics");

    latestMetricData = data;
    renderMetricsFromCache();
  } catch (error) {
    els.metricsSummary.innerHTML = `<span>โหลด KPI ไม่สำเร็จ</span>`;
    els.metricsBody.innerHTML = `<tr><td colspan="5" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
  }
}

function renderMetricsFromCache() {
  if (!latestMetricData) return;

  const operatorQuery = els.metricOperatorFilter.value.trim().toLowerCase();
  const freeTextQuery = els.metricFreeTextFilter.value.trim().toLowerCase();
  const users = (latestMetricData.users || []).filter((item) => {
    const operatorMatch = !operatorQuery || String(item.operatorName || "").toLowerCase().includes(operatorQuery);
    const freeTextMatch = !freeTextQuery || `${item.operatorName || ""} ${item.skus?.join(" ") || ""} ${item.categories?.join(" ") || ""}`.toLowerCase().includes(freeTextQuery);
    return operatorMatch && freeTextMatch;
  });

  const totals = summarizeMetricUsers(users);
  els.metricsSummary.innerHTML = `
    <span>Generate ${Number(totals.generatedImages || 0).toLocaleString("th-TH")} ภาพ</span>
    <span>Approve ${Number(totals.approvedImages || 0).toLocaleString("th-TH")} ภาพ</span>
    <span>${Number(totals.uniqueSkus || 0).toLocaleString("th-TH")} SKU</span>
    <span>${Number(totals.uniqueBrands || 0).toLocaleString("th-TH")} แบรนด์</span>
  `;

  const approveRate = totals.generatedImages ? Math.round((totals.approvedImages / totals.generatedImages) * 100) : 0;
  els.approveRate.textContent = `${approveRate}%`;
  els.approveRateBar.style.width = `${Math.min(100, approveRate)}%`;
  els.supportSignal.textContent = Number(totals.supportSignals || 0).toLocaleString("th-TH");

  if (!users.length) {
    els.metricsBody.innerHTML = '<tr><td colspan="5" class="empty-state">ยังไม่มี KPI ตาม filter นี้</td></tr>';
    return;
  }

  els.metricsBody.innerHTML = users
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.operatorName)}<br><span class="table-muted">${escapeHtml(latestMetricData.date || "-")}</span></td>
          <td>${Number(item.generatedImages || 0).toLocaleString("th-TH")}</td>
          <td>${Number(item.approvedImages || 0).toLocaleString("th-TH")}</td>
          <td>${Number(item.uniqueSkus || 0).toLocaleString("th-TH")}</td>
          <td>${Number(item.uniqueCategories || 0).toLocaleString("th-TH")} หมวด<br><span class="table-muted">${Number(item.uniqueSubtypes || 0).toLocaleString("th-TH")} ประเภท</span></td>
        </tr>
      `
    )
    .join("");
}

function summarizeMetricUsers(users) {
  const skuSet = new Set();
  const brandSet = new Set();
  return users.reduce(
    (total, item) => {
      total.generatedImages += Number(item.generatedImages || 0);
      total.approvedImages += Number(item.approvedImages || 0);
      total.supportSignals += Number(item.generatedImages || 0) - Number(item.approvedImages || 0);
      (item.skus || []).forEach((sku) => skuSet.add(sku));
      (item.brands || []).forEach((brand) => brandSet.add(brand));
      total.uniqueSkus = skuSet.size;
      total.uniqueBrands = brandSet.size;
      return total;
    },
    { generatedImages: 0, approvedImages: 0, uniqueSkus: 0, uniqueBrands: 0, supportSignals: 0 }
  );
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
