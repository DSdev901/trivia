/** Merge river + lake source packs into one Waterways quiz per region,
 * and add the oceans, seas, bays, and straits that surround it.
 */
import { w, WATER_FACTS, WATER_SOURCE, inferWaterType } from "./water-features.mjs";

export function isObsoleteWaterPackId(id) {
  return id !== "great-lakes" && /-(rivers|lakes)$/.test(id);
}

const EXTRA_SOURCE = [
  {
    id: "world-rivers",
    name: "World: Rivers",
    group: "world",
    section: "Physical features",
    items: [
      w("amazon", "Amazon", -3, -60, WATER_FACTS.amazon, { waterway: "Amazonas" }),
      w("nile", "Nile", 26, 32.5, WATER_FACTS.nile, { waterway: "Nile" }),
      w("yangtze", "Yangtze", 31, 112, WATER_FACTS.yangtze, { waterway: "Chang Jiang" }),
      w("mississippi", "Mississippi", 35, -90, WATER_FACTS.mississippi, { waterway: "Mississippi" }),
      w("yenisei", "Yenisei", 67, 86.5, WATER_FACTS.yenisei),
      w("yellow", "Yellow River", 35, 111, WATER_FACTS.yellow, { waterway: "Huang" }),
      w("ob", "Ob", 62, 70, WATER_FACTS.ob),
      w("parana", "Paraná", -27, -58.5, WATER_FACTS.parana),
      w("congo", "Congo", -2, 18, WATER_FACTS.congo, { border: true, waterway: "Congo" }),
      w("amur", "Amur", 50, 137, WATER_FACTS.amur, { border: true, waterway: "Amur" }),
      w("lena", "Lena", 68, 127, WATER_FACTS.lena),
      w("mekong", "Mekong", 15, 105, WATER_FACTS.mekong, { border: true, waterway: "Mekong" }),
      w("niger", "Niger", 16, 4, WATER_FACTS.niger, { waterway: "Niger" }),
      w("murray", "Murray", -34.2, 142, WATER_FACTS.murray, { waterway: "Murray" }),
      w("volga", "Volga", 56, 47, WATER_FACTS.volga, { waterway: "Volga" }),
      w("ganges", "Ganges", 25.3, 83, WATER_FACTS.ganges),
      w("danube", "Danube", 45.2, 19.5, WATER_FACTS.danube, { border: true, waterway: "Danube" }),
      w("indus", "Indus", 28.5, 70, WATER_FACTS.indus),
      w("rhine", "Rhine", 50, 7, WATER_FACTS.rhine, { border: true, waterway: "Rhine" }),
      w("zambezi", "Zambezi", -16, 28.5, WATER_FACTS.zambezi, { border: true, waterway: "Zambezi" }),
    ],
  },
  {
    id: "world-lakes",
    name: "World: Lakes",
    group: "world",
    section: "Physical features",
    items: [
      w("aral", "Aral Sea", 45, 60, WATER_FACTS.aral),
      w("caspian", "Caspian Sea", 41.8, 50.5, WATER_FACTS.caspian),
      w("baikal", "Lake Baikal", 53.5, 108, WATER_FACTS.baikal),
      w("balkhash", "Lake Balkhash", 46, 74, WATER_FACTS.balkhash),
      w("chad", "Lake Chad", 13, 14, WATER_FACTS.chad, { country: "Chad" }),
      w("erie", "Lake Erie", 42.2, -81.2, WATER_FACTS.erie),
      w("great-bear", "Great Bear Lake", 66, -121, WATER_FACTS["great-bear"]),
      w("great-slave", "Great Slave Lake", 61.5, -114, WATER_FACTS["great-slave"]),
      w("huron", "Lake Huron", 44.8, -82.4, WATER_FACTS.huron),
      w("ladoga", "Lake Ladoga", 61, 31.5, WATER_FACTS.ladoga),
      w("malawi", "Lake Malawi", -12, 34.5, WATER_FACTS.malawi, { country: "Malawi" }),
      w("michigan", "Lake Michigan", 44, -87, WATER_FACTS.michigan),
      w("nicaragua", "Lake Nicaragua", 11.6, -85.4, WATER_FACTS.nicaragua),
      w("ontario", "Lake Ontario", 43.7, -77.9, WATER_FACTS.ontario),
      w("superior", "Lake Superior", 47.7, -87.5, WATER_FACTS.superior),
      w("tanganyika", "Lake Tanganyika", -6.5, 29.8, WATER_FACTS.tanganyika),
      w("titicaca", "Lake Titicaca", -15.8, -69.4, WATER_FACTS.titicaca),
      w("tonle-sap", "Tonlé Sap", 12.9, 104.1, WATER_FACTS["tonle-sap"]),
      w("victoria", "Lake Victoria", -1, 33, WATER_FACTS.victoria),
      w("winnipeg", "Lake Winnipeg", 52.5, -97.5, WATER_FACTS.winnipeg),
    ],
  },
  {
    id: "na-lakes",
    name: "North America: Lakes",
    group: "north-america",
    section: "The continent",
    items: [
      w("great-bear", "Great Bear Lake", 66, -121, WATER_FACTS["great-bear"]),
      w("great-salt", "Great Salt Lake", 41.15, -112.55, WATER_FACTS["great-salt"]),
      w("great-slave", "Great Slave Lake", 61.4, -114, WATER_FACTS["great-slave"]),
      w("erie", "Lake Erie", 42.2, -81.2, WATER_FACTS.erie),
      w("huron", "Lake Huron", 44.8, -82.4, WATER_FACTS.huron),
      w("michigan", "Lake Michigan", 44, -87, WATER_FACTS.michigan),
      w("nipigon", "Lake Nipigon", 49.8, -88.5, ["Largest lake entirely in Ontario.", "Drains toward Lake Superior."]),
      w("okeechobee", "Lake Okeechobee", 26.93, -80.8, ["Largest lake in Florida.", "The “liquid heart” of the Everglades."]),
      w("ontario", "Lake Ontario", 43.7, -77.9, WATER_FACTS.ontario),
      w("superior", "Lake Superior", 47.7, -87.5, WATER_FACTS.superior),
      w("winnipeg", "Lake Winnipeg", 52.5, -97.5, WATER_FACTS.winnipeg),
      w("woods", "Lake of the Woods", 49.1, -94.8, ["Lake on the U.S.–Canada border.", "Shared by Ontario, Manitoba, and Minnesota."]),
    ],
  },
  {
    id: "europe-rivers",
    name: "Europe: Rivers",
    group: "europe",
    section: "The continent",
    items: [
      w("danube", "Danube", 45.2, 19.5, WATER_FACTS.danube, { border: true, waterway: "Danube" }),
      w("dniester", "Dniester", 47.5, 29, ["River of Ukraine and Moldova."], { waterway: "Dniester" }),
      w("dnipro", "Dnipro", 49, 32.5, ["Major river of Ukraine.", "The Dnieper, flowing to the Black Sea."], { waterway: "Dnipro" }),
      w("don", "Don", 47.5, 40.5, ["River of southern Russia.", "Empties into the Sea of Azov."], { waterway: "Don" }),
      w("ebro", "Ebro", 41.4, 0.3, ["Spain’s longest river entirely in-country."], { waterway: "Ebro" }),
      w("elbe", "Elbe", 52.5, 12, ["River of Czechia and Germany.", "Empties into the North Sea at Hamburg."], { waterway: "Elbe" }),
      w("loire", "Loire", 47.4, 0.8, ["France’s longest river."], { waterway: "Loire" }),
      w("oder", "Oder", 52.5, 14.6, WATER_FACTS.oder, { border: true, waterway: "Oder" }),
      w("po", "Po", 45, 11, ["Italy’s longest river."], { waterway: "Po" }),
      w("rhine", "Rhine", 50, 7, WATER_FACTS.rhine, { border: true, waterway: "Rhine" }),
      w("rhone", "Rhône", 44.8, 4.8, ["Flows from the Alps to the Mediterranean."], { waterway: "Rhône" }),
      w("seine", "Seine", 48.9, 2.3, ["Flows through Paris."], { waterway: "Seine" }),
      w("tagus", "Tagus", 39.5, -8, ["Longest river of the Iberian Peninsula."]),
      w("thames", "Thames", 51.5, -0.1, ["River of southern England."], { waterway: "Thames" }),
      w("ural-river", "Ural", 51.5, 53.5, ["River along the Europe–Asia boundary."]),
      w("vardar", "Vardar", 41.6, 21.7, ["Principal river of North Macedonia."]),
      w("vistula", "Vistula", 52.2, 21, ["Poland’s longest river."], { waterway: "Vistula" }),
      w("volga", "Volga", 56, 47, WATER_FACTS.volga, { waterway: "Volga" }),
    ],
  },
  {
    id: "us-rivers",
    name: "The U.S.: Rivers",
    group: "north-america",
    section: "United States",
    items: [
      w("arkansas", "Arkansas River", 35.4, -95, ["Major Mississippi tributary of the southern plains."]),
      w("chattahoochee", "Chattahoochee River", 32.5, -85, WATER_FACTS.chattahoochee, { border: true, waterway: "Chattahoochee" }),
      w("colorado", "Colorado River", 36.1, -113.8, WATER_FACTS.colorado, { border: true, waterway: "Colorado" }),
      w("columbia", "Columbia River", 45.7, -120.2, ["Great river of the Pacific Northwest."], { waterway: "Columbia" }),
      w("delaware", "Delaware River", 40.2, -74.8, ["River of the Mid-Atlantic states."]),
      w("mississippi", "Mississippi River", 35, -90, WATER_FACTS.mississippi, { waterway: "Mississippi" }),
      w("missouri", "Missouri River", 42, -98, ["Longest river in the United States."], { waterway: "Missouri" }),
      w("ohio", "Ohio River", 38.5, -85, WATER_FACTS.ohio, { border: true, waterway: "Ohio" }),
      w("potomac", "Potomac River", 38.9, -77.1, ["Flows past Washington, D.C."]),
      w("rio-grande", "Rio Grande", 29, -103, WATER_FACTS["rio-grande"], { border: true, waterway: "Rio Grande" }),
      w("sacramento", "Sacramento River", 39.1, -121.8, ["Principal river of California’s Central Valley."]),
      w("st-lawrence", "Saint Lawrence River", 44.8, -75, WATER_FACTS["st-lawrence"], { border: true, waterway: "St. Lawrence" }),
      w("snake", "Snake River", 44.5, -117, ["Columbia’s largest tributary."]),
      w("tennessee", "Tennessee River", 35.5, -87, ["Major river of the American South."]),
    ],
  },
  {
    id: "canada-rivers",
    name: "Canada: Rivers",
    group: "north-america",
    section: "Canada",
    items: [
      w("athabasca-river", "Athabasca River", 56.7, -111.4, ["Flows from the Columbia Icefield to Lake Athabasca."]),
      w("fraser", "Fraser River", 49.2, -122.9, ["The main river of British Columbia."]),
      w("mackenzie", "Mackenzie River", 67.4, -133.7, WATER_FACTS.mackenzie, { waterway: "Mackenzie" }),
      w("nelson", "Nelson River", 56.5, -94, ["Drains Lake Winnipeg toward Hudson Bay."]),
      w("ottawa-river", "Ottawa River", 45.6, -76.2, WATER_FACTS["ottawa-river"], { border: true, waterway: "Ottawa" }),
      w("peace", "Peace River", 56.2, -117.3, ["Major river of northern Alberta and B.C."]),
      w("red-river", "Red River", 49, -97.2, ["Flows north into Lake Winnipeg."]),
      w("saint-john-river", "Saint John River", 46.3, -67.2, ["Main river of New Brunswick."]),
      w("saskatchewan", "Saskatchewan River", 53.2, -105, ["Prairie river formed by the North and South Saskatchewan."]),
      w("st-lawrence-ca", "Saint Lawrence River", 47.5, -69.5, WATER_FACTS["st-lawrence-ca"], { border: true, waterway: "St. Lawrence" }),
      w("yukon-river", "Yukon River", 64, -139.4, ["Rises in British Columbia and Yukon, then crosses Alaska."]),
    ],
  },
];

const COASTAL = {
  world: [
    w("pacific-ocean", "Pacific Ocean", 5, -150, ["Earth’s largest ocean.", "Larger than all of Earth’s land combined."]),
    w("atlantic-ocean", "Atlantic Ocean", 20, -40, ["Ocean between the Americas, Europe, and Africa.", "Earth’s second-largest ocean."]),
    w("indian-ocean", "Indian Ocean", -15, 80, ["Ocean between Africa, Asia, and Australia.", "The warmest of the five oceans."]),
    w("arctic-ocean", "Arctic Ocean", 82, 0, ["Smallest and shallowest ocean.", "Covered by seasonal sea ice."]),
    w("southern-ocean", "Southern Ocean", -60, 0, ["Ocean ringing Antarctica.", "Defined by the Antarctic Circumpolar Current."]),
    w("mediterranean", "Mediterranean Sea", 35, 18, ["Sea enclosed by Europe, Africa, and Asia.", "Connected to the Atlantic at Gibraltar."]),
    w("caribbean-sea", "Caribbean Sea", 14.5, -75, ["Sea of the American tropics.", "Bounded by the Antilles and the mainland coasts."]),
    w("south-china-sea", "South China Sea", 12, 114, ["A major Pacific marginal sea.", "Among the world’s busiest shipping lanes."]),
    w("red-sea", "Red Sea", 20, 38.5, ["Narrow sea between Africa and Arabia.", "Linked to the Mediterranean by the Suez Canal."]),
    w("gibraltar", "Strait of Gibraltar", 35.97, -5.58, ["The Atlantic’s gate to the Mediterranean.", "Separates Spain from Morocco."]),
    w("bering-strait", "Bering Strait", 65.8, -168.5, ["Separates Alaska from Russia.", "The Pacific’s link to the Arctic Ocean."]),
    w("english-channel", "English Channel", 50.2, -1, ["Between Great Britain and France.", "The busiest shipping lane in the world."]),
    w("drake-passage", "Drake Passage", -58, -62, ["Open water between South America and Antarctica.", "The stormiest of the great ocean passages."]),
    w("malacca", "Strait of Malacca", 2.5, 101.2, ["Between the Malay Peninsula and Sumatra.", "The main shipping choke point of the Indian–Pacific route."]),
    w("gulf-mexico", "Gulf of Mexico", 25, -90, ["Atlantic gulf south of the United States.", "Fed by the Mississippi River."]),
    w("bay-bengal", "Bay of Bengal", 15, 88, ["Northeastern arm of the Indian Ocean.", "The world’s largest bay by area."]),
    w("hudson-bay", "Hudson Bay", 60, -85, ["Huge inland sea of northeastern Canada.", "Ice-covered for much of the year."]),
    w("persian-gulf", "Persian Gulf", 26.5, 52, ["Arm of the Indian Ocean between Iran and Arabia.", "Entered through the Strait of Hormuz."]),
    w("hormuz", "Strait of Hormuz", 26.57, 56.25, ["The only sea entrance to the Persian Gulf.", "A critical oil-shipping choke point."]),
  ],
  asia: [
    w("pacific-ocean", "Pacific Ocean", 30, 155, ["Ocean east of Asia.", "Earth’s largest ocean."]),
    w("indian-ocean", "Indian Ocean", 5, 80, ["Ocean south of Asia."]),
    w("arctic-ocean", "Arctic Ocean", 75, 80, ["Ocean north of Siberia."]),
    w("south-china-sea", "South China Sea", 12, 114, ["Major sea of East and Southeast Asia.", "Among the world’s busiest shipping lanes."]),
    w("east-china-sea", "East China Sea", 28, 125, ["Between China, Korea, and Japan’s Ryukyu Islands."]),
    w("sea-japan", "Sea of Japan", 40, 135, ["Between the Japanese archipelago and the mainland.", "Also called the East Sea."]),
    w("arabian-sea", "Arabian Sea", 15, 65, ["Northwestern Indian Ocean.", "Between Arabia and the Indian subcontinent."]),
    w("bay-bengal", "Bay of Bengal", 15, 88, ["Northeastern Indian Ocean.", "The world’s largest bay by area."]),
    w("bering-strait", "Bering Strait", 65.8, 169.5, ["Separates Asia from North America."]),
    w("malacca", "Strait of Malacca", 2.5, 101.2, ["Between the Malay Peninsula and Sumatra."]),
    w("hormuz", "Strait of Hormuz", 26.57, 56.25, ["The only sea entrance to the Persian Gulf."]),
    w("taiwan-strait", "Taiwan Strait", 24, 119, ["Between mainland China and Taiwan."]),
    w("persian-gulf", "Persian Gulf", 26.5, 52, ["Between Iran and the Arabian Peninsula."]),
    w("red-sea", "Red Sea", 20, 38.5, ["Between Africa and Arabia."]),
    w("yellow-sea", "Yellow Sea", 35.5, 123, ["Between China and the Korean Peninsula.", "Named for the Huang He’s silt."]),
    w("okhotsk", "Sea of Okhotsk", 54, 149, ["Northwest Pacific sea of Russia’s Far East."]),
  ],
  "east-asia": [
    w("pacific-ocean", "Pacific Ocean", 30, 155, ["Ocean east of China, Korea, and Japan."]),
    w("east-china-sea", "East China Sea", 28, 125, ["Between China, Korea, and the Ryukyu Islands."]),
    w("yellow-sea", "Yellow Sea", 35.5, 123, ["Between China and the Korean Peninsula."]),
    w("sea-japan", "Sea of Japan", 40, 135, ["Between Japan and the mainland.", "Also called the East Sea."]),
    w("south-china-sea", "South China Sea", 18, 116, ["The southern sea of East Asia’s rim."]),
    w("taiwan-strait", "Taiwan Strait", 24, 119, ["Between mainland China and Taiwan."]),
    w("korea-strait", "Korea Strait", 34, 129, ["Between Korea and Japan.", "Links the East China Sea to the Sea of Japan."]),
    w("tsugaru", "Tsugaru Strait", 41.5, 140.5, ["Between Honshu and Hokkaido.", "The main strait of northern Japan."]),
    w("bohai", "Bohai Sea", 38.5, 120, ["Innermost gulf of the Yellow Sea.", "Beijing and Tianjin sit on its rim."]),
    w("tokyo-bay", "Tokyo Bay", 35.45, 139.75, ["Bay on Japan’s Pacific coast.", "Tokyo, Yokohama, and Chiba ring its shores."]),
  ],
  "southeast-asia": [
    w("south-china-sea", "South China Sea", 12, 114, ["The principal sea of Southeast Asia."]),
    w("pacific-ocean", "Pacific Ocean", 8, 135, ["Ocean east of the Philippines and New Guinea."]),
    w("andaman", "Andaman Sea", 10, 96, ["Between Myanmar, Thailand, and the Andaman Islands."]),
    w("java-sea", "Java Sea", -5, 110, ["Shallow sea among Java, Borneo, and Sumatra."]),
    w("philippine-sea", "Philippine Sea", 15, 130, ["West Pacific sea east of the Philippines."]),
    w("malacca", "Strait of Malacca", 2.5, 101.2, ["Between the Malay Peninsula and Sumatra."]),
    w("sunda", "Sunda Strait", -5.9, 105.9, ["Between Java and Sumatra.", "Site of the 1883 Krakatoa eruption."]),
    w("makassar", "Makassar Strait", -2, 118, ["Between Borneo and Sulawesi."]),
    w("gulf-thailand", "Gulf of Thailand", 10, 101, ["Arm of the South China Sea.", "Bangkok sits at its head."]),
    w("gulf-tonkin", "Gulf of Tonkin", 19.5, 107, ["Between northern Vietnam and China’s Hainan."]),
    w("manila-bay", "Manila Bay", 14.5, 120.7, ["The great bay of Luzon.", "Manila stands on its eastern shore."]),
    w("ha-long-bay", "Hạ Long Bay", 20.9, 107.1, ["Bay of limestone karst islets in northern Vietnam.", "A UNESCO World Heritage site."]),
  ],
  "south-asia": [
    w("bay-bengal", "Bay of Bengal", 15, 88, ["Northeastern Indian Ocean.", "India’s east-coast sea."]),
    w("arabian-sea", "Arabian Sea", 15, 65, ["Northwestern Indian Ocean.", "India’s west-coast sea."]),
    w("indian-ocean", "Indian Ocean", 5, 80, ["Ocean south of the subcontinent."]),
    w("palk", "Palk Strait", 10, 79.8, ["Between India and Sri Lanka."]),
    w("gulf-mannar", "Gulf of Mannar", 8.8, 79, ["Between southern India and Sri Lanka."]),
    w("gulf-khambhat", "Gulf of Khambhat", 21.5, 72.3, ["Arabian Sea gulf of Gujarat.", "Also called the Gulf of Cambay."]),
  ],
  "central-asia": [],
  "middle-east": [
    w("mediterranean", "Mediterranean Sea", 34, 32, ["Sea west of the Levant and north of Egypt."]),
    w("red-sea", "Red Sea", 20, 38.5, ["Between Arabia and Africa."]),
    w("persian-gulf", "Persian Gulf", 26.5, 52, ["Between Iran and the Arabian Peninsula."]),
    w("arabian-sea", "Arabian Sea", 15, 60, ["Ocean south of Arabia and Iran."]),
    w("gulf-aden", "Gulf of Aden", 12.5, 47, ["Between Yemen and the Horn of Africa."]),
    w("gulf-oman", "Gulf of Oman", 24.5, 58.5, ["Links the Arabian Sea to the Strait of Hormuz."]),
    w("hormuz", "Strait of Hormuz", 26.57, 56.25, ["The only sea entrance to the Persian Gulf."]),
    w("bab-el-mandeb", "Bab-el-Mandeb", 12.58, 43.33, ["The Red Sea’s gate to the Gulf of Aden.", "Separates Yemen from Djibouti and Eritrea."]),
    w("suez", "Suez Canal", 30.45, 32.35, ["Artificial waterway linking the Mediterranean and Red Sea."]),
    w("gulf-aqaba", "Gulf of Aqaba", 28.5, 34.7, ["Northeastern arm of the Red Sea.", "Also called the Gulf of Eilat."]),
  ],
  mena: [
    w("mediterranean", "Mediterranean Sea", 34, 22, ["Sea north of Africa and west of the Levant."]),
    w("red-sea", "Red Sea", 20, 38.5, ["Between Africa and Arabia."]),
    w("persian-gulf", "Persian Gulf", 26.5, 52, ["Between Iran and the Arabian Peninsula."]),
    w("arabian-sea", "Arabian Sea", 15, 60, ["Ocean south of Arabia."]),
    w("atlantic-ocean", "Atlantic Ocean", 32, -12, ["Ocean west of Morocco and Western Sahara."]),
    w("gibraltar", "Strait of Gibraltar", 35.97, -5.58, ["The Atlantic’s gate to the Mediterranean."]),
    w("hormuz", "Strait of Hormuz", 26.57, 56.25, ["The only sea entrance to the Persian Gulf."]),
    w("bab-el-mandeb", "Bab-el-Mandeb", 12.58, 43.33, ["The Red Sea’s gate to the Indian Ocean."]),
    w("suez", "Suez Canal", 30.45, 32.35, ["Links the Mediterranean and the Red Sea."]),
  ],
  africa: [
    w("atlantic-ocean", "Atlantic Ocean", 5, -15, ["Ocean off Africa’s west coast."]),
    w("indian-ocean", "Indian Ocean", -10, 55, ["Ocean off Africa’s east coast."]),
    w("mediterranean", "Mediterranean Sea", 34, 18, ["Sea north of Africa."]),
    w("red-sea", "Red Sea", 20, 38.5, ["Between northeast Africa and Arabia."]),
    w("gulf-guinea", "Gulf of Guinea", 3, 3, ["Atlantic gulf of West and Central Africa.", "The Niger and Congo empty toward it."]),
    w("mozambique-channel", "Mozambique Channel", -17, 42, ["Between Mozambique and Madagascar."]),
    w("gibraltar", "Strait of Gibraltar", 35.97, -5.58, ["Between Morocco and Spain."]),
    w("bab-el-mandeb", "Bab-el-Mandeb", 12.58, 43.33, ["Between the Red Sea and the Gulf of Aden."]),
    w("gulf-aden", "Gulf of Aden", 12.5, 47, ["Between the Horn of Africa and Yemen."]),
    w("suez", "Suez Canal", 30.45, 32.35, ["Links the Mediterranean and the Red Sea."]),
  ],
  "northern-africa": [
    w("mediterranean", "Mediterranean Sea", 34, 18, ["Sea north of the Maghreb and Egypt."]),
    w("atlantic-ocean", "Atlantic Ocean", 28, -16, ["Ocean west of Morocco and Western Sahara."]),
    w("red-sea", "Red Sea", 22, 38, ["Sea east of Egypt and Sudan."]),
    w("gibraltar", "Strait of Gibraltar", 35.97, -5.58, ["Between Morocco and Spain."]),
    w("suez", "Suez Canal", 30.45, 32.35, ["Links the Mediterranean and the Red Sea."]),
    w("gulf-sidra", "Gulf of Sidra", 31.5, 18, ["Mediterranean gulf of Libya.", "Also called the Gulf of Sirte."]),
    w("gulf-gabes", "Gulf of Gabès", 34, 10.5, ["Mediterranean gulf of Tunisia."]),
  ],
  "western-africa": [
    w("atlantic-ocean", "Atlantic Ocean", 10, -20, ["Ocean west of West Africa."]),
    w("gulf-guinea", "Gulf of Guinea", 3, 3, ["Atlantic gulf of the West African coast."]),
    w("bight-benin", "Bight of Benin", 5.5, 3, ["The western curve of the Gulf of Guinea."]),
    w("bight-biafra", "Bight of Biafra", 3.5, 8, ["The eastern curve of the Gulf of Guinea.", "Also called the Bight of Bonny."]),
  ],
  "central-africa": [
    w("atlantic-ocean", "Atlantic Ocean", 0, -5, ["Ocean west of Gabon, Congo, and Cabinda."]),
    w("gulf-guinea", "Gulf of Guinea", 1, 6, ["Atlantic gulf off Cameroon, Equatorial Guinea, and Gabon."]),
  ],
  "eastern-africa": [
    w("indian-ocean", "Indian Ocean", 0, 48, ["Ocean east of the Horn and Kenya."]),
    w("red-sea", "Red Sea", 16, 40, ["Sea west of the Horn, along Eritrea and Sudan."]),
    w("gulf-aden", "Gulf of Aden", 12.5, 47, ["Between Somalia and Yemen."]),
    w("mozambique-channel", "Mozambique Channel", -14, 43, ["Between Mozambique, Tanzania, and Madagascar."]),
    w("bab-el-mandeb", "Bab-el-Mandeb", 12.58, 43.33, ["The Red Sea’s southern gate."]),
  ],
  "southern-africa": [
    w("indian-ocean", "Indian Ocean", -30, 40, ["Ocean east of South Africa and Mozambique."]),
    w("atlantic-ocean", "Atlantic Ocean", -28, 10, ["Ocean west of Namibia and South Africa."]),
    w("mozambique-channel", "Mozambique Channel", -20, 42, ["Between Mozambique and Madagascar."]),
    w("false-bay", "False Bay", -34.25, 18.65, ["Large bay east of the Cape Peninsula.", "Separated from Table Bay by the Cape of Good Hope."]),
    w("table-bay", "Table Bay", -33.85, 18.43, ["Bay under Table Mountain.", "Cape Town’s historic harbour."]),
    w("walvis-bay", "Walvis Bay", -22.95, 14.5, ["Namibia’s principal deep-water bay."]),
  ],
  "africa-north-equator": [
    w("mediterranean", "Mediterranean Sea", 34, 18, ["Sea north of Africa."]),
    w("atlantic-ocean", "Atlantic Ocean", 10, -18, ["Ocean west of northern Africa."]),
    w("red-sea", "Red Sea", 20, 38.5, ["Sea of northeast Africa."]),
    w("gulf-guinea", "Gulf of Guinea", 3, 3, ["Atlantic gulf of the equatorial west coast."]),
    w("gibraltar", "Strait of Gibraltar", 35.97, -5.58, ["Between Morocco and Spain."]),
  ],
  "africa-south-equator": [
    w("indian-ocean", "Indian Ocean", -15, 50, ["Ocean east of southern Africa."]),
    w("atlantic-ocean", "Atlantic Ocean", -10, 8, ["Ocean west of Angola and Namibia."]),
    w("mozambique-channel", "Mozambique Channel", -17, 42, ["Between Mozambique and Madagascar."]),
  ],
  europe: [
    w("atlantic-ocean", "Atlantic Ocean", 48, -20, ["Ocean west of Europe."]),
    w("arctic-ocean", "Arctic Ocean", 75, 20, ["Ocean north of Scandinavia."]),
    w("mediterranean", "Mediterranean Sea", 38, 15, ["Sea south of Europe."]),
    w("baltic", "Baltic Sea", 58, 20, ["Nearly enclosed sea of northern Europe."]),
    w("north-sea", "North Sea", 56, 3, ["Between Britain and Scandinavia."]),
    w("black-sea", "Black Sea", 43.3, 34, ["Inland sea of southeastern Europe."]),
    w("english-channel", "English Channel", 50.2, -1, ["Between Great Britain and France."]),
    w("biscay", "Bay of Biscay", 45, -4, ["Atlantic bay of France and Spain."]),
    w("gibraltar", "Strait of Gibraltar", 35.97, -5.58, ["Gateway between the Atlantic and Mediterranean."]),
    w("dover", "Strait of Dover", 51.05, 1.4, ["The English Channel’s narrowest point.", "The shortest sea crossing to France."]),
    w("bosporus", "Bosporus", 41.12, 29.07, ["Istanbul’s strait.", "The Black Sea’s only outlet to the Sea of Marmara."]),
    w("dardanelles", "Dardanelles", 40.22, 26.42, ["Strait of northwestern Turkey.", "Links the Sea of Marmara to the Aegean."]),
    w("adriatic", "Adriatic Sea", 43, 15.5, ["Between Italy and the Balkans."]),
    w("aegean", "Aegean Sea", 38, 25, ["Between Greece and Turkey."]),
  ],
  "northern-europe": [
    w("north-sea", "North Sea", 56, 3, ["Between Britain and Scandinavia."]),
    w("baltic", "Baltic Sea", 58, 20, ["Sea of the Nordic and Baltic coasts."]),
    w("norwegian-sea", "Norwegian Sea", 67, 3, ["Sea west of Norway."]),
    w("arctic-ocean", "Arctic Ocean", 75, 10, ["Ocean north of Norway and Svalbard."]),
    w("english-channel", "English Channel", 50.2, -1, ["Between Great Britain and France."]),
    w("irish-sea", "Irish Sea", 53.5, -5, ["Between Ireland and Great Britain."]),
    w("skagerrak", "Skagerrak", 57.8, 9, ["Between Norway, Sweden, and Denmark’s Jutland."]),
    w("kattegat", "Kattegat", 56.5, 11.5, ["Between Denmark and Sweden.", "The Baltic’s gate to the Skagerrak."]),
    w("gulf-bothnia", "Gulf of Bothnia", 62, 20, ["Northern arm of the Baltic.", "Between Sweden and Finland."]),
    w("gulf-finland", "Gulf of Finland", 59.8, 26, ["Eastern arm of the Baltic.", "Toward St. Petersburg, Tallinn, and Helsinki."]),
  ],
  "western-europe": [
    w("atlantic-ocean", "Atlantic Ocean", 46, -8, ["Ocean west of France and the Low Countries’ approaches."]),
    w("north-sea", "North Sea", 54, 4, ["Sea north of the Low Countries and Germany."]),
    w("english-channel", "English Channel", 50.2, -1, ["Between France and Great Britain."]),
    w("biscay", "Bay of Biscay", 45, -4, ["Atlantic bay of France and Spain."]),
    w("dover", "Strait of Dover", 51.05, 1.4, ["The Channel’s narrowest point."]),
  ],
  "eastern-europe": [
    w("baltic", "Baltic Sea", 56, 19, ["Sea of Poland, the Baltics, and Russia’s northwest."]),
    w("black-sea", "Black Sea", 43.3, 34, ["Sea of Ukraine, Romania, Bulgaria, and Russia’s south."]),
    w("bosporus", "Bosporus", 41.12, 29.07, ["The Black Sea’s outlet at Istanbul."]),
    w("dardanelles", "Dardanelles", 40.22, 26.42, ["The Aegean’s gate to the Sea of Marmara."]),
    w("gulf-finland", "Gulf of Finland", 59.8, 26, ["Toward St. Petersburg."]),
    w("white-sea", "White Sea", 65.5, 37, ["Inlet of the Arctic on Russia’s northwest."]),
    w("sea-azov", "Sea of Azov", 46, 36.5, ["Shallow sea north of the Black Sea.", "Entered through the Kerch Strait."]),
  ],
  "southern-europe": [
    w("mediterranean", "Mediterranean Sea", 38, 15, ["Sea south of Europe."]),
    w("adriatic", "Adriatic Sea", 43, 15.5, ["Between Italy and the Balkans."]),
    w("tyrrhenian", "Tyrrhenian Sea", 40, 12, ["Between mainland Italy, Sardinia, and Sicily."]),
    w("ionian", "Ionian Sea", 38, 18, ["Between Italy and Greece."]),
    w("aegean", "Aegean Sea", 38, 25, ["Between Greece and Turkey."]),
    w("gibraltar", "Strait of Gibraltar", 35.97, -5.58, ["Between Spain and Morocco."]),
    w("messina", "Strait of Messina", 38.2, 15.6, ["Between Sicily and the Italian mainland."]),
    w("otranto", "Strait of Otranto", 40.15, 18.9, ["The Adriatic’s gate to the Ionian Sea."]),
    w("gulf-lions", "Gulf of Lion", 43, 4, ["Mediterranean gulf of southern France."]),
  ],
  nordic: [
    w("norwegian-sea", "Norwegian Sea", 67, 3, ["Sea west of Norway."]),
    w("north-sea", "North Sea", 56, 5, ["Sea south of Norway and west of Denmark."]),
    w("baltic", "Baltic Sea", 58, 20, ["Sea of Sweden, Finland, and Denmark’s east."]),
    w("arctic-ocean", "Arctic Ocean", 78, 15, ["Ocean north of Norway and Svalbard."]),
    w("skagerrak", "Skagerrak", 57.8, 9, ["Between Norway, Sweden, and Jutland."]),
    w("kattegat", "Kattegat", 56.5, 11.5, ["Between Denmark and Sweden."]),
    w("gulf-bothnia", "Gulf of Bothnia", 62, 20, ["Between Sweden and Finland."]),
    w("denmark-strait", "Denmark Strait", 67, -24, ["Between Iceland and Greenland."]),
  ],
  "north-america": [
    w("atlantic-ocean", "Atlantic Ocean", 35, -65, ["Ocean off the east coast."]),
    w("pacific-ocean", "Pacific Ocean", 40, -135, ["Ocean off the west coast."]),
    w("arctic-ocean", "Arctic Ocean", 75, -120, ["Ocean north of Canada and Alaska."]),
    w("gulf-mexico", "Gulf of Mexico", 25, -90, ["Atlantic gulf south of the United States."]),
    w("hudson-bay", "Hudson Bay", 60, -85, ["Huge inland sea of northeastern Canada."]),
    w("caribbean-sea", "Caribbean Sea", 14.5, -75, ["Sea of the American tropics."]),
    w("bering-strait", "Bering Strait", 65.8, -168.5, ["Separates Alaska from Russia."]),
    w("bering-sea", "Bering Sea", 58, -175, ["North Pacific sea between Alaska and Russia."]),
    w("fundy", "Bay of Fundy", 45, -65.5, ["Atlantic bay of New Brunswick and Nova Scotia.", "Home of the world’s greatest tidal range."]),
    w("gulf-california", "Gulf of California", 28, -112, ["Between Baja California and mainland Mexico.", "Also called the Sea of Cortez."]),
    w("gulf-st-lawrence", "Gulf of St. Lawrence", 48.5, -62, ["The St. Lawrence River’s Atlantic outlet."]),
    w("gulf-alaska", "Gulf of Alaska", 58, -148, ["Pacific gulf of southern Alaska."]),
  ],
  "northern-america": [
    w("atlantic-ocean", "Atlantic Ocean", 38, -65, ["Ocean off the U.S. and Canadian east coasts."]),
    w("pacific-ocean", "Pacific Ocean", 40, -135, ["Ocean off the west coast."]),
    w("arctic-ocean", "Arctic Ocean", 75, -120, ["Ocean north of Canada and Alaska."]),
    w("gulf-mexico", "Gulf of Mexico", 25, -90, ["Atlantic gulf south of the United States."]),
    w("hudson-bay", "Hudson Bay", 60, -85, ["Huge inland sea of northeastern Canada."]),
    w("bering-strait", "Bering Strait", 65.8, -168.5, ["Separates Alaska from Russia."]),
    w("fundy", "Bay of Fundy", 45, -65.5, ["Home of the world’s greatest tidal range."]),
    w("gulf-california", "Gulf of California", 28, -112, ["Between Baja California and mainland Mexico."]),
    w("gulf-st-lawrence", "Gulf of St. Lawrence", 48.5, -62, ["The St. Lawrence River’s Atlantic outlet."]),
  ],
  "central-america": [
    w("caribbean-sea", "Caribbean Sea", 16, -82, ["Sea east of Central America."]),
    w("pacific-ocean", "Pacific Ocean", 10, -90, ["Ocean west of Central America."]),
    w("gulf-mexico", "Gulf of Mexico", 22, -94, ["Gulf north of the Yucatán."]),
    w("gulf-honduras", "Gulf of Honduras", 16, -87.5, ["Caribbean gulf of Belize, Guatemala, and Honduras."]),
    w("gulf-panama", "Gulf of Panama", 8, -79.5, ["Pacific gulf on Panama’s south coast."]),
    w("panama-canal", "Panama Canal", 9.08, -79.68, ["Artificial waterway linking the Atlantic and Pacific."]),
  ],
  caribbean: [
    w("caribbean-sea", "Caribbean Sea", 14.5, -75, ["The sea the islands enclose."]),
    w("gulf-mexico", "Gulf of Mexico", 24, -87, ["Gulf northwest of Cuba."]),
    w("atlantic-ocean", "Atlantic Ocean", 23, -65, ["Ocean north and east of the Antilles."]),
    w("windward-passage", "Windward Passage", 20, -73.8, ["Between Cuba and Hispaniola."]),
    w("mona-passage", "Mona Passage", 18.3, -67.8, ["Between Hispaniola and Puerto Rico."]),
    w("yucatan-channel", "Yucatán Channel", 21.5, -86, ["Between Cuba and Mexico’s Yucatán.", "The Caribbean’s gate to the Gulf of Mexico."]),
    w("gulf-gonave", "Gulf of Gonâve", 19, -73.3, ["Haiti’s great west-coast gulf.", "Port-au-Prince sits at its head."]),
  ],
  canada: [
    w("hudson-bay", "Hudson Bay", 60, -85, ["Huge inland sea of northeastern Canada."]),
    w("gulf-st-lawrence", "Gulf of St. Lawrence", 48.5, -62, ["The St. Lawrence River’s Atlantic outlet."]),
    w("fundy", "Bay of Fundy", 45, -65.5, ["Home of the world’s greatest tidal range."]),
    w("baffin-bay", "Baffin Bay", 73, -68, ["Between Baffin Island and Greenland."]),
    w("davis-strait", "Davis Strait", 65, -58, ["Between Baffin Island and Greenland.", "Links Baffin Bay to the Labrador Sea."]),
    w("beaufort", "Beaufort Sea", 72, -140, ["Arctic sea north of Yukon and the Northwest Territories."]),
    w("georgia-strait", "Strait of Georgia", 49.3, -123.8, ["Between Vancouver Island and the mainland."]),
    w("arctic-ocean", "Arctic Ocean", 75, -100, ["Ocean north of the Canadian Arctic Archipelago."]),
  ],
  us: [
    w("atlantic-ocean", "Atlantic Ocean", 35, -70, ["Ocean off the east coast."]),
    w("pacific-ocean", "Pacific Ocean", 36, -125, ["Ocean off the west coast."]),
    w("gulf-mexico", "Gulf of Mexico", 25, -90, ["Gulf south of the U.S. Gulf Coast."]),
    w("arctic-ocean", "Arctic Ocean", 72, -155, ["Ocean north of Alaska."]),
    w("chesapeake", "Chesapeake Bay", 37.6, -76.1, ["The largest estuary in the United States.", "Shared by Maryland and Virginia."]),
    w("san-francisco-bay", "San Francisco Bay", 37.8, -122.4, ["Pacific estuary of northern California."]),
    w("puget-sound", "Puget Sound", 47.8, -122.4, ["Inland sea of Washington State.", "Seattle and Tacoma sit on its shores."]),
    w("bering-strait", "Bering Strait", 65.8, -168.5, ["Separates Alaska from Russia."]),
    w("long-island-sound", "Long Island Sound", 41.1, -72.8, ["Between Long Island and Connecticut."]),
    w("gulf-california", "Gulf of California", 28, -112, ["Pacific gulf along Mexico, south of California."]),
  ],
  "south-america": [
    w("atlantic-ocean", "Atlantic Ocean", -15, -30, ["Ocean off the east coast."]),
    w("pacific-ocean", "Pacific Ocean", -20, -85, ["Ocean off the west coast."]),
    w("caribbean-sea", "Caribbean Sea", 12, -70, ["Sea north of Colombia and Venezuela."]),
    w("rio-plata", "Río de la Plata", -34.9, -57, ["Estuary of the Paraná and Uruguay rivers.", "The widest estuary on Earth."]),
    w("magellan", "Strait of Magellan", -53.5, -70.8, ["Passage at the tip of South America.", "Between the mainland and Tierra del Fuego."]),
    w("drake-passage", "Drake Passage", -58, -62, ["Open water between Cape Horn and Antarctica."]),
    w("guanabara", "Guanabara Bay", -22.8, -43.15, ["Bay of Rio de Janeiro.", "Sugarloaf stands at its entrance."]),
    w("gulf-venezuela", "Gulf of Venezuela", 11, -71.2, ["Caribbean gulf that opens to Lake Maracaibo."]),
    w("gulf-guayaquil", "Gulf of Guayaquil", -3, -80.5, ["Pacific gulf of Ecuador and northern Peru."]),
  ],
  "latin-america": [
    w("atlantic-ocean", "Atlantic Ocean", -10, -30, ["Ocean off Brazil and the Argentine coast."]),
    w("pacific-ocean", "Pacific Ocean", -10, -85, ["Ocean off Mexico, Central America, and the Andes coast."]),
    w("caribbean-sea", "Caribbean Sea", 14, -75, ["Sea of Central America and northern South America."]),
    w("gulf-mexico", "Gulf of Mexico", 22, -92, ["Gulf of Mexico and the Yucatán."]),
    w("rio-plata", "Río de la Plata", -34.9, -57, ["Estuary of the Paraná and Uruguay."]),
    w("magellan", "Strait of Magellan", -53.5, -70.8, ["Passage at the tip of South America."]),
    w("guanabara", "Guanabara Bay", -22.8, -43.15, ["Bay of Rio de Janeiro."]),
    w("gulf-california", "Gulf of California", 28, -112, ["Between Baja California and mainland Mexico."]),
  ],
  oceania: [
    w("pacific-ocean", "Pacific Ocean", -10, 170, ["The ocean that defines Oceania."]),
    w("indian-ocean", "Indian Ocean", -20, 100, ["Ocean west of Australia."]),
    w("tasman-sea", "Tasman Sea", -38, 160, ["Between Australia and New Zealand."]),
    w("coral-sea", "Coral Sea", -16, 152, ["Northeast of Australia.", "Home of the Great Barrier Reef’s outer waters."]),
    w("southern-ocean", "Southern Ocean", -55, 150, ["Ocean south of Australia and New Zealand."]),
    w("torres", "Torres Strait", -10, 142.3, ["Between Australia and New Guinea."]),
    w("bass", "Bass Strait", -40, 146, ["Between Tasmania and mainland Australia."]),
    w("cook", "Cook Strait", -41.2, 174.5, ["Between New Zealand’s North and South Islands."]),
    w("carpentaria", "Gulf of Carpentaria", -14, 139, ["Gulf of northern Australia."]),
    w("bight", "Great Australian Bight", -35, 130, ["Open bay on Australia’s southern coast."]),
    w("bismarck-sea", "Bismarck Sea", -4, 148, ["North of New Guinea, in Papua New Guinea."]),
  ],
  australia: [
    w("indian-ocean", "Indian Ocean", -25, 108, ["Ocean west of Australia."]),
    w("pacific-ocean", "Pacific Ocean", -28, 160, ["Ocean east of Australia."]),
    w("tasman-sea", "Tasman Sea", -38, 160, ["Between Australia and New Zealand."]),
    w("southern-ocean", "Southern Ocean", -50, 140, ["Ocean south of Australia."]),
    w("bass", "Bass Strait", -40, 146, ["Between Tasmania and the mainland."]),
    w("torres", "Torres Strait", -10, 142.3, ["Between Australia and New Guinea."]),
    w("bight", "Great Australian Bight", -35, 130, ["Open bay on the southern coast."]),
    w("carpentaria", "Gulf of Carpentaria", -14, 139, ["Gulf of northern Australia."]),
    w("cook", "Cook Strait", -41.2, 174.5, ["Between New Zealand’s North and South Islands."]),
    w("shark-bay", "Shark Bay", -25.5, 113.5, ["Indian Ocean bay of Western Australia.", "A UNESCO World Heritage site."]),
    w("port-phillip", "Port Phillip", -38.15, 144.9, ["Bay of Melbourne, on Victoria’s south coast."]),
  ],
  melanesia: [
    w("coral-sea", "Coral Sea", -16, 152, ["Sea of the Great Barrier Reef and Vanuatu’s approaches."]),
    w("solomon-sea", "Solomon Sea", -9, 154, ["Between New Guinea and the Solomon Islands."]),
    w("bismarck-sea", "Bismarck Sea", -4, 148, ["North of New Guinea."]),
    w("torres", "Torres Strait", -10, 142.3, ["Between New Guinea and Australia."]),
    w("pacific-ocean", "Pacific Ocean", -10, 165, ["Ocean east of Melanesia."]),
  ],
  micronesia: [
    w("pacific-ocean", "Pacific Ocean", 8, 155, ["The ocean that surrounds Micronesia."]),
    w("philippine-sea", "Philippine Sea", 12, 140, ["West Pacific sea west of the Marianas and Palau."]),
  ],
  polynesia: [
    w("pacific-ocean", "Pacific Ocean", -15, -170, ["The ocean that surrounds Polynesia."]),
  ],
};

const EXTRA_REGIONS = [
  {
    prefix: "nordic",
    title: "The Nordic Countries",
    group: "europe",
    section: "The Nordic Countries",
    inland: [
      w("glomma", "Glomma", 59.9, 11.2, ["Longest river in Norway."], { waterway: "Glomma" }),
      w("kemijoki", "Kemijoki", 66.5, 25.8, ["Longest river in Finland."]),
      w("vanern", "Vänern", 58.9, 13.3, ["Largest lake in the European Union."]),
      w("vattern", "Vättern", 58.3, 14.5, ["Sweden’s second-largest lake."]),
      w("saimaa", "Saimaa", 61.3, 28, ["Largest lake in Finland."]),
    ],
  },
  {
    prefix: "mena",
    title: "The Middle East and North Africa",
    group: "asia",
    section: "The Middle East and North Africa",
    inland: [
      w("nile", "Nile", 26, 32.5, WATER_FACTS.nile, { waterway: "Nile" }),
      w("tigris", "Tigris", 34.5, 44.4, ["Great river of Mesopotamia."]),
      w("euphrates", "Euphrates", 33, 40.4, ["Longest river in Western Asia."]),
      w("jordan", "Jordan River", 32.1, 35.55, WATER_FACTS.jordan, { border: true, waterway: "Jordan" }),
      w("dead-sea", "Dead Sea", 31.5, 35.5, ["Earth’s lowest land elevation on its shores.", "Among the saltiest large lakes."], { border: true }),
    ],
  },
  {
    prefix: "africa-north-equator",
    title: "Africa North Of the Equator",
    group: "africa",
    section: "Africa North Of the Equator",
    inland: [
      w("nile", "Nile", 26, 32.5, WATER_FACTS.nile, { waterway: "Nile" }),
      w("niger", "Niger", 16, 4, WATER_FACTS.niger, { waterway: "Niger" }),
      w("senegal-r", "Senegal River", 16.5, -14.5, ["Forms most of the Senegal–Mauritania border."], { border: true, waterway: "Sénégal" }),
      w("chad", "Lake Chad", 13, 14, WATER_FACTS.chad, { country: "Chad" }),
      w("nasser", "Lake Nasser", 22.5, 32.5, ["Reservoir behind Aswan High Dam."]),
      w("volta-lake", "Lake Volta", 7, 0, ["Among the world’s largest reservoirs by area."]),
    ],
  },
  {
    prefix: "africa-south-equator",
    title: "Africa South Of the Equator",
    group: "africa",
    section: "Africa South Of the Equator",
    inland: [
      w("congo", "Congo", -2, 18, WATER_FACTS.congo, { border: true, waterway: "Congo" }),
      w("zambezi", "Zambezi", -16, 28.5, WATER_FACTS.zambezi, { border: true, waterway: "Zambezi" }),
      w("orange", "Orange River", -28.6, 17.6, ["Longest river in South Africa."], { border: true, waterway: "Orange" }),
      w("victoria", "Lake Victoria", -1, 33, WATER_FACTS.victoria),
      w("tanganyika", "Lake Tanganyika", -6.5, 29.8, WATER_FACTS.tanganyika),
      w("malawi", "Lake Malawi", -12, 34.5, WATER_FACTS.malawi, { country: "Malawi" }),
    ],
  },
  {
    prefix: "melanesia",
    title: "Melanesia",
    group: "oceania",
    section: "Melanesia",
    inland: [
      w("sepic", "Sepik", -4.2, 142.5, ["Longest river on the island of New Guinea in PNG.", "Flows to the Bismarck Sea."]),
    ],
  },
  {
    prefix: "micronesia",
    title: "Micronesia",
    group: "oceania",
    section: "Micronesia",
    inland: [],
  },
  {
    prefix: "polynesia",
    title: "Polynesia",
    group: "oceania",
    section: "Polynesia",
    inland: [],
  },
];

function dedupeItems(lists) {
  const seen = new Set();
  const out = [];
  for (const item of lists.flat()) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function sourcePrefix(id) {
  return String(id || "").replace(/-(rivers|lakes)$/, "");
}

function titleBase(name) {
  return String(name || "")
    .replace(/: (Rivers|Lakes)$/, "")
    .replace(/^The Contiguous U\.S\.$/, "The U.S.");
}

function waterwaysBlurb(title, items) {
  const coastalRe = /\b(Ocean|Sea|Gulf|Strait|Bay|Channel|Sound|Bight|Passage|Cove|Canal)\b/i;
  const coastal = items.filter((it) => coastalRe.test(it.name));
  const inland = items.filter((it) => !coastal.includes(it));
  const sample = [...inland.slice(0, 2), ...coastal.slice(0, 1)].map((it) => it.name);
  if (sample.length >= 2) return `${sample.join(", ")}, and more.`;
  if (coastal.length && !inland.length) return `Oceans, seas, and passages around ${title}.`;
  return `Rivers, lakes, and waters around ${title}.`;
}

function tagWaterType(items, type) {
  return items.map((it) => ({
    ...it,
    waterType: it.waterType || type || inferWaterType(it.name),
  }));
}

function mergeGroup(prefix, packs, extra) {
  const rivers = tagWaterType(
    packs.filter((p) => p.id.endsWith("-rivers")).flatMap((p) => p.items),
    "river"
  );
  const lakes = tagWaterType(
    packs.filter((p) => p.id.endsWith("-lakes")).flatMap((p) => p.items),
    "lake"
  );
  const other = tagWaterType(
    packs
      .filter((p) => !p.id.endsWith("-rivers") && !p.id.endsWith("-lakes"))
      .flatMap((p) => p.items),
    ""
  );
  const inland = tagWaterType(extra?.inland || [], "");
  const coastal = tagWaterType(COASTAL[prefix] || [], "ocean");
  const items = dedupeItems([rivers, lakes, other, inland, coastal]);
  const fromPack = packs[0];
  const title = extra?.title || titleBase(fromPack?.name || prefix);
  const group = extra?.group || fromPack?.group;
  const section = extra?.section || fromPack?.section;
  return {
    id: `${prefix}-waterways`,
    name: `${title}: Waterways`,
    blurb: waterwaysBlurb(title, items),
    group,
    section,
    items,
  };
}

export const WATER_PACKS = (() => {
  const byPrefix = new Map();
  for (const pack of [...WATER_SOURCE, ...EXTRA_SOURCE]) {
    const prefix = sourcePrefix(pack.id);
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
    byPrefix.get(prefix).push(pack);
  }
  const extras = new Map(EXTRA_REGIONS.map((row) => [row.prefix, row]));
  const prefixes = [...new Set([...byPrefix.keys(), ...extras.keys()])];
  return prefixes
    .map((prefix) => mergeGroup(prefix, byPrefix.get(prefix) || [], extras.get(prefix)))
    .filter((pack) => pack.items.length >= 4 && pack.group && pack.section);
})();
