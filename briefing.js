/** Rank current-events headlines by story weight and pick the people to bold. */

const MONTHS = new Set([
  "January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December", "Jan", "Feb",
  "Mar", "Apr", "Jun", "Jul", "Aug", "Sep", "Sept", "Oct", "Nov", "Dec",
]);

const DAYS = new Set([
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
  "Mon", "Tue", "Tues", "Wed", "Thu", "Thur", "Fri", "Sat", "Sun",
]);

const HONORIFICS = new Set(["Mr", "Mrs", "Ms", "Miss", "Dr", "Sir", "Dame", "Prof"]);

const PARTICLES = new Set(["da", "de", "del", "della", "di", "du", "la", "le", "van", "von", "bin", "al", "el", "st", "st."]);

const SUFFIXES = new Set(["Jr", "Jr.", "Sr", "Sr.", "II", "III", "IV", "V"]);

/** One-word names that headlines treat as the person. */
const MONONYMS = new Set([
  "Adele", "Beyoncé", "Beyonce", "Brady", "Cher", "Diddy", "Drake", "Federer",
  "Giannis", "LeBron", "Madonna", "Mahomes", "Messi", "Nadal", "Ohtani",
  "Pelé", "Pele", "Rihanna", "Ronaldo", "Serena", "Shaq", "Trump", "Usher",
  "Venus", "Yeezy", "Zendaya",
]);

const FIRST_BLOCK = new Set([
  "A", "An", "The", "And", "Or", "But", "For", "With", "From", "After", "Before",
  "Over", "Under", "Into", "Upon", "About", "Against", "Among", "Between",
  "During", "Without", "Within", "Through", "Across", "This", "That", "These",
  "Those", "Some", "Any", "All", "Each", "Every", "New", "Old", "Best", "Worst",
  "Latest", "Live", "Breaking", "Update", "Report", "Source", "Sources",
  "Official", "Inside", "Watch", "How", "Why", "What", "When", "Where", "Who",
  "While", "Still", "Just", "Back", "Next", "Last", "First", "Second", "Third",
  "Final", "Big", "Top", "High", "Low", "Real", "Super", "World", "National",
  "American", "United", "Major", "Minor", "Grand", "Golden", "North", "South",
  "East", "West", "Los", "Las", "San", "Santa", "Saint", "St", "St.", "Fort",
  "Mount", "Lake", "Port", "Cape", "FedEx",   "NBA", "NFL", "MLB", "NHL", "WNBA",
  "NCAA", "MLS", "UFC", "WWE", "PGA", "FIFA", "ESPN", "ACC", "SEC", "AFC",
  "NFC", "ATP", "WTA", "UEFA", "IOC",
]);

const WORD_BLOCK = new Set([
  ...FIRST_BLOCK,
  ...MONTHS,
  ...DAYS,
  "Day", "Night", "Week", "Year", "Season", "Seasons", "Game", "Games", "Team",
  "Teams", "Show", "Shows", "Movie", "Movies", "Film", "Films", "News", "Report",
  "Preview", "Recap", "Update", "Updates", "Championship", "Championships",
  "Title", "Deal", "Draft", "Camp", "Schedule", "Record", "Office", "Box",
  "Bowl", "Cup", "Series", "Open", "Classic", "Festival", "Center", "Centre",
  "House", "Street", "City", "County", "State", "Island", "Park", "Stadium",
  "Arena", "League", "Conference", "Division", "Network", "Times", "Post",
  "Magazine", "Studio", "Studios", "Pictures", "Entertainment", "Sports",
  "College", "Football", "Basketball", "Baseball", "Soccer", "Hockey", "Golf",
  "Tennis", "Training", "Transfer", "Rumors", "Rumour", "Rumours", "Tracker",
  "Highlights", "Standouts", "Questions", "Concerns", "Odds", "Betting",
  "Opening", "Weekend", "Domestic", "Ticket", "Awards", "Award", "Album",
  "Tour", "Trailer", "Premiere", "Release", "Original", "Originals", "Special",
  "Documentary", "Docuseries", "Reality", "Episode", "Season", "Win", "Loss",
  "Victory", "Defeat", "Innings", "Homers", "RBIs", "Touchdown", "Playoffs",
  "Offseason", "Preseason", "Regular", "Milestone", "Celebrity", "Board",
  "Votes", "Building", "Merger", "Lawsuit", "Investors", "Social", "Media",
  "Monday", "Night", "Raw", "Field", "Dreams", "Hall", "Fame", "Super",
  "Global", "Citizen", "White", "Kennedy", "Warner", "Bros", "Discovery",
  "Paramount", "Netflix", "Disney", "Hulu", "Amazon", "Apple", "Sony", "Marvel",
  "Universal", "Variety", "Deadline", "TMZ", "Instagram", "TikTok", "YouTube",
  "Congress", "Senate", "Court", "States", "America", "England", "London",
  "France", "Paris", "Spain", "Italy", "Germany", "China", "Japan", "Mexico",
  "Canada", "Australia", "India", "Brazil", "Africa", "Europe", "Pacific",
  "Atlantic", "Midwest", "West", "East", "South", "North", "Bay", "Valley",
  "Heights", "Hills", "Beach", "Coast", "River", "Lakes", "Great",
  "Brand", "Spider-Man", "Wolverine", "Mutant", "Hero", "PS5", "Xbox",
  "Complete", "Strong", "Early", "Late", "Former", "Rookie", "Veteran",
  "Utility", "Player", "Players", "Coach", "Coaches", "Referee", "Manager",
  "Owner", "Owners", "Agent", "Agents", "Execs", "Sources", "Source",
  "Mom", "Dad", "Family", "Wife", "Husband", "Brother", "Sister",
]);

const TEAMS = new Set([
  "Hawks", "Celtics", "Nets", "Hornets", "Bulls", "Cavaliers", "Cavs",
  "Mavericks", "Mavs", "Nuggets", "Pistons", "Warriors", "Rockets", "Pacers",
  "Clippers", "Lakers", "Grizzlies", "Heat", "Bucks", "Timberwolves", "Wolves",
  "Pelicans", "Knicks", "Thunder", "Magic", "Sixers", "76ers", "Suns",
  "Blazers", "Kings", "Spurs", "Raptors", "Jazz", "Wizards",
  "Cardinals", "Falcons", "Ravens", "Bills", "Panthers", "Bears", "Bengals",
  "Browns", "Cowboys", "Broncos", "Lions", "Packers", "Texans", "Colts",
  "Jaguars", "Jags", "Chiefs", "Raiders", "Chargers", "Rams", "Dolphins",
  "Vikings", "Patriots", "Saints", "Giants", "Jets", "Eagles", "Steelers",
  "49ers", "Niners", "Seahawks", "Buccaneers", "Bucs", "Titans", "Commanders",
  "Diamondbacks", "Dbacks", "Braves", "Orioles", "Sox", "Cubs", "Reds",
  "Guardians", "Rockies", "Tigers", "Astros", "Royals", "Angels", "Dodgers",
  "Marlins", "Brewers", "Twins", "Mets", "Yankees", "Athletics", "A's",
  "Phillies", "Pirates", "Padres", "Mariners", "Rays", "Rangers", "Jays",
  "Nationals", "Nats",
  "Blackhawks", "Bruins", "Canadiens", "Canucks", "Capitals", "Devils",
  "Ducks", "Flames", "Flyers", "Hurricanes", "Islanders", "Jackets",
  "Kings", "Knights", "Kraken", "Leafs", "Lightning", "Oilers", "Penguins",
  "Predators", "Sabres", "Senators", "Sharks", "Stars", "Wild",
  "Chelsea", "Arsenal", "Liverpool", "Barcelona", "Madrid", "Bayern", "PSG",
  "Juventus", "Tottenham", "Newcastle", "Fulham", "Monaco", "Inter", "Milan",
  "LAFC", "Galaxy", "Sounders", "Fire", "Union", "Crew", "Atlanta",
  "Crimson", "Tide", "Buckeyes", "Wolverines", "Sooners", "Longhorns",
  "Trojans", "Ducks", "Nittany", "Seminoles", "Gators", "Volunteers",
  "Bulldogs", "Wildcats", "Jayhawks", "Hoosiers", "Illini", "Hawkeyes",
  "Spartans", "Badgers", "Boilermakers", "Cornhuskers", "Tigers",
]);

/** Lowercase words that are almost never a surname in a headline. */
const COMMON = new Set(`
a an the and or but if as at by for from in into of on off to up with without
about after against among around before behind below between during over under
again further then once here there when where why how all any both each few more
most other some such no nor not only own same so than too very can will just
should now also still even never ever already yet
you your yours we our ours they them their theirs it its he she him his her hers
this that these those who whom whose which what
need needs know known knowing thing things shocking shock
hit hits hitting million billions billion trillion deal deals sale sales buy buys
buying sold selling boost boosts past first last new old big small high low
audience married marriage sight season seasons episode episodes show shows
movie movies film films series special specials
office box domestic weekend opening record records milestone milestones
push pushes allow allows merger mergers condition conditions
has have had having was were been being is are am
dead death died dies dying killed killing killer wife wives kid kids child
children girlfriend boyfriend husband family families mom dad mother father
murder murdered indictment indicted update updates story stories top
collection building expands expand adds add star stars
detailing details meeting meets daughter daughters brother brothers sister
sisters
would could might may must did does doing
one two three four five six seven eight nine ten
pass passes passed passing year years summer winter spring fall
highest grossing gross box-office
on peacock netflix hulu disney
indie topline collection doctor who
man utd united city
reach reaches reached
`.trim().split(/\s+/));

const CITIES = new Set([
  "Houston", "Boston", "Chicago", "Dallas", "Denver", "Detroit", "Indiana",
  "Indiana's", "Miami", "Milwaukee", "Minnesota", "Orleans", "Orleans'",
  "York", "Oklahoma", "Orlando", "Philadelphia", "Phoenix", "Portland",
  "Sacramento", "Antonio", "Toronto", "Utah", "Washington", "Atlanta",
  "Baltimore", "Buffalo", "Carolina", "Cincinnati", "Cleveland", "Arizona",
  "Green", "Bay", "Jacksonville", "Kansas", "Vegas", "Angeles", "England",
  "Orleans", "Seattle", "Tampa", "Tennessee", "Pittsburgh", "San",
  "Francisco", "Diego", "Jose", "Oakland", "Colorado", "Florida", "Texas",
  "Georgia", "Alabama", "Auburn", "Oregon", "Michigan", "Ohio", "Penn",
  "State", "Notre", "Dame", "Army", "Navy", "Air", "Force", "Manchester",
  "London", "Madrid", "Munich", "Turin", "Milan", "Paris", "Monaco",
  "Malaga", "Málaga",
]);

const HIGH_WEIGHT = [
  [/\b(dies?|died|dead|death|killed|murder(?:ed)?|assassinated)\b/i, 42],
  [/\b(merger|acquisition|antitrust|sold at|valuation)\b/i, 36],
  [/\b\$?\d+(?:\.\d+)?\s*(billion|trillion)\b/i, 34],
  [/\b\$?\d+(?:\.\d+)?\s*million\b/i, 18],
  [/\b(record-breaking|breaks? (?:a |the )?record|fastest .+ to|highest-grossing|milestone|surpass(?:es|ed)?)\b/i, 28],
  [/\b(retir(?:e|ed|es|ement)|steps? away)\b/i, 24],
  [/\b(sentenced|indicted|lawsuit|sued|prison|solitary|fraud|defraud)\b/i, 24],
  [/\b(super bowl|world series|world cup|nba finals|stanley cup|championship game)\b/i, 30],
  [/\b(tommy john|season-ending|out for (?:the )?season|acl|achilles)\b/i, 22],
  [/\b(traded? to|sign(?:s|ed)? (?:a )?(?:max |supermax |\$))/i, 16],
  [/\b(impeach|elected|inaugur|executive order|white house)\b/i, 20],
  [/\b(plane crash|killed in|mass shooting)\b/i, 36],
];

const LOW_WEIGHT = [
  [/\boffseason recap|season preview|betting preview\b/i, 28],
  [/\btransfer rumors?\b/i, 20],
  [/\btracker:\b/i, 22],
  [/\bhighlights?:|best shots\b/i, 18],
  [/\bhow to watch|what to watch|where to watch\b/i, 22],
  [/\brumors?, news\b/i, 16],
  [/\bstandouts, questions for all\b/i, 18],
  [/\bunder-the-radar\b/i, 10],
  [/\bsocial media for the .+ schedule\b/i, 16],
];

const RECAP_HEADLINE =
  /\b(?:beat|beats|beat|down|rout(?:s)?|hold off|shuts? out|win over|victory over)\b.+\b\d+-\d+\b|\b\d+-\d+\b.+\b(?:win|victory|loss)\b/i;

function stripHtml(s) {
  return String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&hellip;/g, "…")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isNameToken(raw, { first = false } = {}) {
  const w = String(raw || "").replace(/^[("'[]+|[,)\]"']+$/g, "");
  if (!w) return false;
  if (SUFFIXES.has(w) || PARTICLES.has(w.toLowerCase())) return true;
  if (HONORIFICS.has(w.replace(/\.$/, ""))) return true;
  if (MONONYMS.has(w)) return true;
  if (MONTHS.has(w) || DAYS.has(w) || WORD_BLOCK.has(w) || TEAMS.has(w) || CITIES.has(w)) {
    return false;
  }
  if (first && FIRST_BLOCK.has(w)) return false;
  if (/^[A-Z]{2,4}$/.test(w) && !/^(DJ|AJ|CJ|EJ|JJ|LJ|RJ|TJ|BJ|PJ|KC|Bo)$/.test(w)) {
    return false;
  }
  if (/^\d/.test(w)) return false;
  return /^[A-ZÀ-ÖØ-Þ][A-Za-zÀ-öø-ÿ''’. -]*[A-Za-zÀ-öø-ÿ]$/.test(w) ||
    /^(DJ|AJ|CJ|EJ|JJ|LJ|RJ|TJ|BJ|PJ|KC)$/.test(w) ||
    /^[A-Z]\.$/.test(w);
}

function bareWord(raw) {
  return String(raw || "")
    .replace(/^[("'[]+|[,)\]"'':;]+$/g, "")
    .replace(/['’]s$/i, "");
}

function isCommonWord(raw) {
  const w = bareWord(raw).toLowerCase();
  return COMMON.has(w);
}

function looksLikeTeamOrPlace(parts) {
  const words = parts.map((p) => p.replace(/['’]s$/i, ""));
  if (words.some((w) => TEAMS.has(w))) return true;
  if (words.length >= 2 && CITIES.has(words[0]) && (TEAMS.has(words[1]) || CITIES.has(words[1]))) {
    return true;
  }
  if (words.length === 2 && CITIES.has(words[0]) && CITIES.has(words[1])) return true;
  return false;
}

function tokenize(text) {
  return String(text || "")
    .replace(/^((?:source|sources|report|breaking|watch|update|exclusive)\s*:\s*)/i, "")
    .split(/\s+/)
    .filter(Boolean);
}

function isTitleCaseHeadline(text) {
  const words = tokenize(text)
    .map(bareWord)
    .filter((w) => /[A-Za-zÀ-ö]/.test(w) && !/^[\d$]/.test(w));
  if (words.length < 5) return false;
  const capped = words.filter((w) => /^[A-ZÀ-ÖØ-Þ]/.test(w));
  return capped.length / words.length >= 0.65;
}

function extractPeopleFromText(text) {
  const tokens = tokenize(text);
  const found = [];
  const seen = new Set();

  const push = (parts) => {
    const clean = parts
      .map((p) => p.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]+|[^A-Za-zÀ-ÖØ-öø-ÿ.']+$/g, ""))
      .filter(Boolean);
    if (clean.length < 1) return;
    if (looksLikeTeamOrPlace(clean)) return;
    const content = clean.filter(
      (w) => !HONORIFICS.has(w.replace(/\.$/, "")) && !PARTICLES.has(w.toLowerCase()) && !SUFFIXES.has(w)
    );
    if (!content.length) return;
    if (content.length === 1 && !MONONYMS.has(content[0])) return;
    if (content.some((w) => isCommonWord(w))) return;
    const name = clean.join(" ").replace(/\s+/g, " ").trim();
    if (name.length < 3) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    found.push(name);
  };

  let i = 0;
  while (i < tokens.length) {
    const first = bareWord(tokens[i]);
    if (MONONYMS.has(first)) {
      push([first]);
      i += 1;
      continue;
    }
    const nextBare = i + 1 < tokens.length ? bareWord(tokens[i + 1]) : "";
    const firstCommon = isCommonWord(first);
    const canStart =
      HONORIFICS.has(first.replace(/\.$/, "")) ||
      (!firstCommon && isNameToken(first, { first: true })) ||
      (firstCommon && nextBare && !isCommonWord(nextBare) && isNameToken(nextBare));
    if (!canStart) {
      i += 1;
      continue;
    }
    const parts = [tokens[i].replace(/^[("'[]+/, "").replace(/[,:;]+$/, "")];
    let j = i + 1;
    while (j < tokens.length) {
      const raw = tokens[j].replace(/[,:;]+$/, "");
      const core = bareWord(raw);
      const lower = core.toLowerCase();
      if (isCommonWord(core) && !PARTICLES.has(lower) && !SUFFIXES.has(core)) break;
      if (PARTICLES.has(lower) || SUFFIXES.has(core) || isNameToken(core)) {
        parts.push(raw);
        j += 1;
        if (/[,:;]$/.test(tokens[j - 1]) && parts.length >= 2) break;
        continue;
      }
      break;
    }
    if (parts.length >= 2 || (parts.length === 1 && MONONYMS.has(bareWord(parts[0])))) {
      push(parts);
      i = j;
      continue;
    }
    i += 1;
  }

  return found;
}

function lastName(person) {
  const parts = String(person).split(/\s+/);
  return parts[parts.length - 1].replace(/[.,]+$/, "");
}

function extractPeople(item) {
  const headline = item.headline || "";
  const summary = item.summary || "";
  const fromHead = extractPeopleFromText(headline);
  const fromSum = extractPeopleFromText(summary);
  const starring = (item.starring || []).filter(Boolean);
  const titleCase = isTitleCaseHeadline(headline);

  const people = [];
  const seen = new Set();
  const add = (name) => {
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return;
    seen.add(key);
    people.push(name);
  };

  if (titleCase) {
    const sumKeys = new Set(fromSum.map((n) => n.toLowerCase()));
    for (const name of fromHead) {
      if (sumKeys.has(name.toLowerCase())) add(name);
      else if (name.split(/\s+/).length >= 2 && !name.split(/\s+/).some(isCommonWord)) add(name);
    }
    fromSum.forEach(add);
  } else {
    fromHead.forEach(add);
  }

  starring.slice(0, 4).forEach(add);

  if (!fromHead.length) {
    const possessive = headline.match(/([A-Z][A-Za-z.]+)['’]s?\s+([A-Z][A-Za-z''-]+)/);
    if (possessive && !TEAMS.has(possessive[2]) && !WORD_BLOCK.has(possessive[2])) {
      const last = possessive[2];
      const full = fromSum.find((n) => lastName(n).toLowerCase() === last.toLowerCase());
      if (full) add(full);
    }
  }

  if (!people.length) fromSum.slice(0, 2).forEach(add);

  return people.slice(0, 4);
}

function daysAgo(iso, now = Date.now()) {
  const t = new Date(`${iso}T12:00:00`).getTime();
  if (!t) return 20;
  return Math.max(0, (now - t) / 86400000);
}

function recapUrl(url) {
  return /\/recap(?:\?|$)|gameId=/i.test(String(url || ""));
}

function storyWeight(item, now = Date.now()) {
  const text = `${item.headline} ${item.summary}`;
  let score = 12;
  if (item.top) score += 6;
  if (item.tag === "Milestone") score += 26;
  if (item.section === "netflix") score -= 8;
  else {
    for (const [re, pts] of HIGH_WEIGHT) {
      if (re.test(text)) score += pts;
    }
  }
  if ((item.people || []).length) score += 4;
  score += Math.max(0, 14 - daysAgo(item.date, now) * 0.9);
  for (const [re, pts] of LOW_WEIGHT) {
    if (re.test(text)) score -= pts;
  }
  if (RECAP_HEADLINE.test(item.headline) || recapUrl(item.url)) score -= 30;
  if (/\b(offseason recap|early .+ season preview)\b/i.test(item.headline)) score -= 12;
  if ((item.summary || "").length < 60) score -= 4;
  if ((item.summary || "").length > 180) score += 3;
  return score;
}

function contentTokens(headline) {
  return String(headline || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !WORD_BLOCK.has(w[0].toUpperCase() + w.slice(1)));
}

function clusterKey(item) {
  const people = (item.people || []).map((p) => p.toLowerCase()).sort().join("|");
  if (people) return `p:${people}`;
  return `h:${contentTokens(item.headline).slice(0, 6).join(" ")}`;
}

function normalizeItem(section, raw) {
  const headline = stripHtml(raw.headline || raw.title || "");
  const summary = stripHtml(raw.summary || raw.synopsis || "");
  const item = {
    section,
    headline,
    summary,
    date: raw.date || "",
    url: raw.url || "",
    tag: raw.sport || raw.tag || raw.type || section,
    top: Boolean(raw.top),
    starring: raw.starring || [],
    image: raw.image || "",
    type: raw.type || "",
  };
  item.people = extractPeople(item);
  return item;
}

function collectItems(data) {
  const out = [];
  for (const item of data.sports?.items || []) {
    out.push(normalizeItem("sports", item));
  }
  for (const item of data.entertainment?.items || []) {
    out.push(normalizeItem("entertainment", item));
  }
  return out;
}

function applyClusterBoost(items) {
  const groups = new Map();
  items.forEach((item, idx) => {
    const key = clusterKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(idx);
  });
  for (const idxs of groups.values()) {
    if (idxs.length < 2) continue;
    let best = idxs[0];
    for (const i of idxs) {
      if (items[i].score > items[best].score) best = i;
    }
    items[best].score += Math.min(24, (idxs.length - 1) * 8);
    items[best].coverage = idxs.length;
  }
}

/**
 * Rank every current-events headline. Heaviest stories first.
 * `data` is { sports, entertainment } payloads from the JSON feeds.
 */
export function buildBriefing(data, now = Date.now()) {
  const items = collectItems(data);
  for (const item of items) item.score = storyWeight(item, now);
  applyClusterBoost(items);
  items.sort(
    (a, b) =>
      b.score - a.score ||
      (b.date || "").localeCompare(a.date || "") ||
      a.headline.localeCompare(b.headline)
  );
  const windows = [data.sports, data.entertainment]
    .filter(Boolean)
    .map((d) => [d.windowStart, d.windowEnd]);
  const windowStart = windows.map((w) => w[0]).sort()[0] || "";
  const windowEnd = windows.map((w) => w[1]).sort().pop() || "";
  return { windowStart, windowEnd, items };
}

export function highlightPeople(text, people) {
  const escaped = escapeHtml(stripHtml(text));
  if (!people?.length) return escaped;
  const names = [...people].sort((a, b) => b.length - a.length);
  let out = escaped;
  for (const name of names) {
    const htmlName = escapeHtml(name);
    const re = new RegExp(
      `\\b(${escapeRegExp(htmlName)})(['’]s)?\\b`,
      "gi"
    );
    out = out.replace(re, `<strong class="ce-who">$1</strong>$2`);
    const last = lastName(name);
    const fullInText = new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(
      stripHtml(text)
    );
    if (
      !fullInText &&
      last &&
      last.length > 3 &&
      last.toLowerCase() !== name.toLowerCase() &&
      !WORD_BLOCK.has(last) &&
      !TEAMS.has(last)
    ) {
      const lastRe = new RegExp(
        `(?<![\\w-])(${escapeRegExp(escapeHtml(last))})(['’]s)?(?![\\w-])`,
        "g"
      );
      out = out.replace(lastRe, (m, g1, g2, offset, full) => {
        const before = full.slice(Math.max(0, offset - 20), offset);
        if (before.includes("ce-who")) return m;
        return `<strong class="ce-who">${g1}</strong>${g2 || ""}`;
      });
    }
  }
  return out;
}

export { escapeHtml, stripHtml };
