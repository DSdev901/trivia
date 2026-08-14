/** Rank current-events headlines by story weight and pick the people to bold. */

/** Top of the ranked list shown as the briefing; Haiku rewrites these. */
export const BRIEFING_FEATURED = 40;

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
  "Aces", "Mystics", "Lynx", "Mercury", "Sparks", "Fever", "Liberty",
  "Storm", "Dream", "Valkyries", "Wings",
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
  [/\b(dies at|died at|dies:|died:|has died|dead at|killed|murder(?:ed)?|assassinated|death of)\b/i, 42],
  [/\b(merger|acquisition|antitrust|sold at|valuation)\b/i, 36],
  [/\b\$?\d+(?:\.\d+)?\s*(billion|trillion)\b/i, 34],
  [/\b\$?\d+(?:\.\d+)?\s*million\b.{0,40}\b(?:box office|ticket|sale|deal|contract|gross|settlement)\b/i, 18],
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
  [/\bbraless|sheer (?:lace|dress)|red carpet|what she wore\b/i, 32],
  [/\band more\b|\bmore top stories\b/i, 22],
  [/\baudience up\b/i, 14],
  [/\bstock (?:award|grant|bonus)|beneficiary of \$\d/i, 16],
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

function recencyPoints(iso, now, maxPts, perDay) {
  return Math.max(0, maxPts - daysAgo(iso, now) * perDay);
}

function listiclePenalty(headline) {
  const h = String(headline || "");
  let n = 0;
  if (/\b\d+\s+things you (?:need to |should )?know\b/i.test(h)) n += 20;
  if (/\bwhat we learned\b/i.test(h)) n += 14;
  if (/\b(?:questions|takeaways) for\b/i.test(h)) n += 12;
  if (/\(EXCL|\bEXCLUSIVE\b/i.test(h)) n += 8;
  return n;
}

function recapUrl(url) {
  return /\/recap(?:\?|$)|gameId=/i.test(String(url || ""));
}

function storyWeight(item, now = Date.now()) {
  const text = `${item.headline} ${item.summary}`;
  let score = 12;
  if (item.top) score += 6;
  if (item.tag === "Milestone" && !/\bbirthday|braless|red carpet\b/i.test(text)) {
    score += 26;
  }
  if (item.section === "netflix") score -= 8;
  else {
    for (const [re, pts] of HIGH_WEIGHT) {
      if (re.test(text)) score += pts;
    }
  }
  if ((item.people || []).length) score += 4;
  for (const [re, pts] of LOW_WEIGHT) {
    if (re.test(text)) score -= pts;
  }
  if (RECAP_HEADLINE.test(item.headline) || recapUrl(item.url)) score -= 30;
  if (/\b(offseason recap|early .+ season preview)\b/i.test(item.headline)) score -= 12;
  if ((item.summary || "").length < 60) score -= 4;
  if ((item.summary || "").length > 180) score += 3;
  score -= listiclePenalty(item.headline);
  item.quality = score;
  return score + recencyPoints(item.date, now, 12, 0.9);
}

function clusterRankScore(item, now = Date.now()) {
  const coverage = Math.max(1, Number(item.coverage) || 1);
  const quality = Number(item.quality ?? item.score) || 0;
  const mention = 26 * Math.log2(coverage + 1);
  return (
    quality +
    mention +
    recencyPoints(item.date, now, 22, 1.35)
  );
}

const CLUSTER_STOP = new Set([
  "the", "and", "for", "with", "from", "that", "this", "have", "been", "into",
  "after", "before", "over", "under", "about", "amid", "says", "said", "will",
  "could", "would", "their", "they", "them", "his", "her", "its", "who", "what",
  "when", "where", "how", "why", "not", "but", "are", "was", "were", "has",
  "had", "offseason", "recap", "preview", "rumors", "rumour", "news", "latest",
  "source", "sources", "report", "update", "updates", "tracker", "highlights",
  "standouts", "questions", "betting", "odds", "early", "season", "schedule",
  "week", "vs", "win", "won", "beat", "beats", "loss", "game", "games",
  "points", "point", "yards", "innings", "thursday", "wednesday", "tuesday",
  "monday", "friday", "saturday", "sunday", "night", "day", "look", "looks",
  "take", "hold", "lead", "leads", "behind", "against", "first", "second",
  "third", "hosts", "visits", "faces", "showing", "performance", "streak",
  "skid", "victory", "rout", "past", "than", "wore", "wear", "dress", "trend",
  "reveals", "reveal", "responds", "respond", "another", "like", "home",
  "still", "just", "more", "most", "very", "says",
]);

function clusterTokens(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !CLUSTER_STOP.has(w));
}

function tokenSet(item) {
  return new Set(clusterTokens(item.headline));
}

function sharedCount(a, b) {
  let n = 0;
  for (const w of a) if (b.has(w)) n += 1;
  return n;
}

function notablePeopleOverlap(a, b) {
  for (const x of a.people || []) {
    const xl = x.toLowerCase();
    const lastX = lastName(xl);
    for (const y of b.people || []) {
      const yl = y.toLowerCase();
      if (xl === yl) return true;
      // "Lionel Messi" vs "Messi" — not "Josh Lucas" vs "Jai Lucas"
      if (lastX === yl || lastName(yl) === xl) return true;
    }
  }
  return false;
}

function urlKey(url) {
  const u = String(url || "").split("#")[0];
  if (!u) return "";
  const espn = u.match(/\/id\/(\d+)/);
  if (espn) return `espn:${espn[1]}`;
  const gameId = u.match(/[?&]gameId=(\d+)/i);
  if (gameId) return `game:${gameId[1]}`;
  const path = u.replace(/\?.*$/, "").replace(/\/$/, "");
  const slug = path.split("/").pop() || "";
  if (slug.length > 24) return `slug:${slug.replace(/-\d{6,}.*$/, "")}`;
  return u.toLowerCase().replace(/\/$/, "");
}

function gameIdOf(url) {
  const m = String(url || "").match(/[?&]gameId=(\d+)/i);
  return m ? m[1] : "";
}

function isPreviewTemplate(headline) {
  return (
    /\bleads\b.+\b(against|into)\b/i.test(headline) ||
    /\b(hosts|visits|faces|takes on|plays|play the)\b.+\b(after|following|against|matchup|streak|skid)\b/i.test(
      headline
    )
  );
}

const TEAM_RE = new RegExp(
  `\\b(${[...TEAMS]
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length)
    .join("|")})\\b`,
  "gi"
);

function headlineTeams(item) {
  const found = new Set();
  const text = item.headline || "";
  TEAM_RE.lastIndex = 0;
  let m;
  while ((m = TEAM_RE.exec(text))) found.add(m[1].toLowerCase());
  return [...found].sort();
}

function scorePair(headline) {
  const m = String(headline || "").match(/(\d+)\s*[-–]\s*(\d+)/);
  if (!m) return "";
  const x = Number(m[1]);
  const y = Number(m[2]);
  if (x > 200 || y > 200) return "";
  return [Math.min(x, y), Math.max(x, y)].join("-");
}

function teamsScoreKey(item) {
  if (!item._teams || item._teams.length < 2) return "";
  if (item._scorePair) return `${item._teams.join("|")}|${item._scorePair}`;
  if (item.date) return `${item._teams.join("|")}|${item.date}`;
  return "";
}

function extraShared(a, b) {
  const nameParts = new Set();
  for (const n of [...(a.people || []), ...(b.people || [])]) {
    for (const w of clusterTokens(n)) nameParts.add(w);
  }
  let n = 0;
  for (const w of a._tokens) {
    if (b._tokens.has(w) && !nameParts.has(w)) n += 1;
  }
  return n;
}

function titleHints(item) {
  const quotes = new Set();
  const topics = new Set();
  const t = String(item.headline || "").toLowerCase();
  if (/spider-?man/.test(t) && !/wolverine/.test(t) && !/odyssey/.test(t)) {
    topics.add("spiderman");
  }
  for (const m of t.matchAll(/[‘'“"]([^'”"]{8,70})[’'”"]/g)) {
    const key = m[1].replace(/[^a-z0-9]+/g, " ").trim();
    if (key.length >= 8) quotes.add(key);
  }
  return { quotes, topics };
}

function hintOverlap(a, b) {
  for (const t of a._topics) if (b._topics.has(t)) return true;
  if (a._quotes.size === 1 && b._quotes.size === 1) {
    const [q] = a._quotes;
    return b._quotes.has(q);
  }
  return false;
}

function sameEventPeople(a, b) {
  const shared = sharedCount(a._tokens, b._tokens);
  return notablePeopleOverlap(a, b) && extraShared(a, b) >= 1 && shared >= 3;
}

function dealKey(item) {
  const t = `${item.headline} ${item.summary}`.toLowerCase();
  if (!/\b(sold|sale|buy|purchase|deal)\b/.test(t)) return "";
  if (!/\b\d+(?:\.\d+)?\s*(billion|million)\b/.test(t) && !/\$\d/.test(t)) {
    return "";
  }
  const teams = headlineTeams({ headline: item.headline });
  if (teams.length) return `deal:${teams.sort().join("|")}`;
  return "";
}

function relatedStories(a, b) {
  if (a._urlKey && a._urlKey === b._urlKey) return true;
  if (a._gameId && a._gameId === b._gameId) return true;
  if (a._dealKey && a._dealKey === b._dealKey) return true;

  const teamKeyA = teamsScoreKey(a);
  const teamKeyB = teamsScoreKey(b);
  if (a._isGame || b._isGame) {
    return Boolean(teamKeyA && teamKeyA === teamKeyB);
  }

  if (a.section !== b.section) {
    return hintOverlap(a, b) || sameEventPeople(a, b);
  }

  if (hintOverlap(a, b)) return true;
  if (sameEventPeople(a, b)) return true;
  const shared = sharedCount(a._tokens, b._tokens);
  const union = a._tokens.size + b._tokens.size - shared;
  const jaccard = union ? shared / union : 0;
  if (shared >= 4 && jaccard >= 0.38) return true;
  if (shared >= 3 && jaccard >= 0.52) return true;
  return false;
}

function prepareCluster(item) {
  item._urlKey = urlKey(item.url);
  item._gameId = gameIdOf(item.url);
  item._teams = headlineTeams(item);
  item._scorePair = scorePair(item.headline);
  item._tokens = tokenSet(item);
  const hints = titleHints(item);
  item._quotes = hints.quotes;
  item._topics = hints.topics;
  item._dealKey = dealKey(item);
  item._isGame = Boolean(
    item._gameId ||
      recapUrl(item.url) ||
      RECAP_HEADLINE.test(item.headline) ||
      isPreviewTemplate(item.headline)
  );
  return item;
}

function firstSentences(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\[…\]\s*$/, "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 28 && !/^reported by\b/i.test(s));
}

function sentenceOverlap(a, b) {
  const ta = new Set(clusterTokens(a));
  const tb = new Set(clusterTokens(b));
  const shared = sharedCount(ta, tb);
  const union = ta.size + tb.size - shared;
  return union ? shared / union : 0;
}

function isJunkFact(s) {
  return (
    /\bis a (?:\d{4}|multi-purpose)\b/i.test(s) ||
    /Awards Circuit section is the home/i.test(s) ||
    /^Read this article on /i.test(s) ||
    /\b(?:Cinematic Universe|\d+th film in the Marvel|superhero film reboot)\b/i.test(s) ||
    /\([A-Z]{2,4}\) is\b/.test(s)
  );
}

function memorableSummary(group) {
  const ranked = [...group].sort((a, b) => b.score - a.score);
  const headTok = new Set(clusterTokens(ranked[0].headline));
  const facts = [];
  const consider = [];
  for (const item of ranked) {
    const fromSum = firstSentences(item.summary).filter((s) => {
      if (isJunkFact(s)) return false;
      return sharedCount(headTok, new Set(clusterTokens(s))) >= 2;
    });
    if (fromSum.length) consider.push(...fromSum);
    else if (item === ranked[0] || extraShared(item, ranked[0]) >= 2) {
      consider.push(item.headline.replace(/[.!?]+$/, "") + ".");
    }
  }
  for (const fact of consider) {
    if (facts.some((f) => sentenceOverlap(f, fact) >= 0.5)) continue;
    facts.push(fact);
    if (facts.length >= 6) break;
  }
  let out = facts.join(" ").replace(/\s+/g, " ").trim();
  if (out.length > 720) out = `${out.slice(0, 717).replace(/\s+\S*$/, "")}…`;
  return out;
}

const NAME_TRAIL_JUNK = new Set([
  "Says", "Said", "Hits", "Sets", "Goes", "Buy", "Sells", "Wins", "Reveals",
  "Wore", "Doesn't", "Doesn", "Exclusive", "Commitment", "Predictions",
  "Shares", "Share", "Actress", "Actor", "Fans", "Media", "Kingdom", "Track",
  "Urge", "Fast", "Following", "Braless", "Magic", "Wonder",
]);

function looksLikePersonName(name) {
  const parts = String(name || "")
    .replace(/['\u2019]s$/i, "")
    .split(/\s+/)
    .map((p) => p.replace(/[.,]+$/g, ""))
    .filter(Boolean);
  if (!parts.length || parts.length > 3) return false;
  if (parts.length === 1) return MONONYMS.has(parts[0]);
  if (looksLikeTeamOrPlace(parts)) return false;
  if (parts.some((p) => NAME_TRAIL_JUNK.has(p) || FIRST_BLOCK.has(p))) return false;
  const last = parts[parts.length - 1];
  if (/n['\u2019]t$/i.test(last)) return false;
  if (
    /\b(universe|everything|commitment|exclusive|predictions|circuit|taiwan|oscars?|emmys?|actress|actor|supporting)\b/i.test(
      name
    )
  ) {
    return false;
  }
  return parts.every(
    (p) =>
      PARTICLES.has(p.toLowerCase()) ||
      SUFFIXES.has(p) ||
      HONORIFICS.has(p.replace(/\.$/, "")) ||
      isNameToken(p)
  );
}

function namesAreSamePerson(a, b) {
  const pa = a.toLowerCase().split(/\s+/);
  const pb = b.toLowerCase().split(/\s+/);
  if (pa[pa.length - 1] !== pb[pb.length - 1] && !(pa.length === 1 && pa[0] === pb[pb.length - 1]) && !(pb.length === 1 && pb[0] === pa[pa.length - 1])) {
    return false;
  }
  if (pa.length === 1 || pb.length === 1) return pa[pa.length - 1] === pb[pb.length - 1] || pa[0] === pb[pb.length - 1] || pb[0] === pa[pa.length - 1];
  const fa = pa[0];
  const fb = pb[0];
  return fa === fb || fa.startsWith(fb) || fb.startsWith(fa);
}

function dedupePeople(people) {
  const ranked = [...people].sort((a, b) => b.length - a.length);
  const out = [];
  for (const name of ranked) {
    if (out.some((p) => namesAreSamePerson(p, name))) continue;
    out.push(name);
  }
  return out;
}

function mentionCount(group, name) {
  const key = name.toLowerCase();
  const last = lastName(key);
  let n = 0;
  for (const item of group) {
    const blob = `${item.headline} ${item.summary}`.toLowerCase();
    if (blob.includes(key) || (last.length > 3 && blob.includes(last))) n += 1;
  }
  return n;
}

function clusterAngles(ranked, bestHeadline) {
  if (ranked.length < 2) return [];
  const seen = [bestHeadline];
  const angles = [];
  for (const item of ranked) {
    const headline = String(item.headline || "").trim();
    if (!headline) continue;
    if (seen.some((s) => sentenceOverlap(s, headline) >= 0.5)) continue;
    seen.push(headline);
    const fact = firstSentences(item.summary).find((s) => !isJunkFact(s)) || "";
    const row = { headline };
    if (fact && sentenceOverlap(headline, fact) < 0.55) row.fact = fact;
    angles.push(row);
    if (angles.length >= 5) break;
  }
  return angles;
}

function mergeGroup(group) {
  const ranked = [...group].sort(
    (a, b) => b.score - a.score || (b.date || "").localeCompare(a.date || "")
  );
  const best = ranked[0];
  const angles = clusterAngles(ranked, best.headline);
  const people = [];
  const seen = new Set();
  for (const item of ranked) {
    for (const name of item.people || []) {
      const cleaned = String(name).replace(/['\u2019]s$/i, "").trim();
      if (!looksLikePersonName(cleaned)) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      people.push(cleaned);
    }
  }
  const coverage = group.length;
  const bestKeys = new Set(
    (best.people || [])
      .map((n) => n.replace(/['\u2019]s$/i, "").trim().toLowerCase())
      .filter(Boolean)
  );
  const who = dedupePeople(people).sort((a, b) => {
    const aBest = [...bestKeys].some((p) => p === a.toLowerCase() || namesAreSamePerson(p, a))
      ? 1
      : 0;
    const bBest = [...bestKeys].some((p) => p === b.toLowerCase() || namesAreSamePerson(p, b))
      ? 1
      : 0;
    if (bBest !== aBest) return bBest - aBest;
    return mentionCount(ranked, b) - mentionCount(ranked, a) || b.length - a.length;
  });
  return {
    section: best.section,
    headline: best.headline,
    summary: memorableSummary(ranked),
    date: ranked.map((i) => i.date || "").sort().pop(),
    url: best.url || "",
    tag: best.tag,
    top: best.top,
    starring: best.starring,
    image: best.image,
    type: best.type,
    people: who.slice(0, 3),
    coverage,
    quality: best.quality ?? best.score,
    score: best.score,
    ...(angles.length ? { angles } : {}),
  };
}

function clusterStories(items) {
  const n = items.length;
  for (const item of items) prepareCluster(item);
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const unite = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (relatedStories(items[i], items[j])) unite(i, j);
    }
  }
  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(items[i]);
  }
  return [...groups.values()].map(mergeGroup);
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

/**
 * Rank clustered current-events headlines. Related stories are merged.
 * Rank blends how often a story was mentioned, story weight, and recency
 * so a fresh milestone can outrank an older pile of recaps.
 * `data` is { sports, entertainment } payloads from the JSON feeds.
 */
export function buildBriefing(data, now = Date.now()) {
  const items = collectItems(data);
  for (const item of items) item.score = storyWeight(item, now);
  const clustered = clusterStories(items);
  clustered.sort(
    (a, b) =>
      clusterRankScore(b, now) - clusterRankScore(a, now) ||
      (b.coverage || 1) - (a.coverage || 1) ||
      (b.date || "").localeCompare(a.date || "") ||
      a.headline.localeCompare(b.headline)
  );
  const windows = [data.sports, data.entertainment]
    .filter(Boolean)
    .map((d) => [d.windowStart, d.windowEnd]);
  const windowStart = windows.map((w) => w[0]).sort()[0] || "";
  const windowEnd = windows.map((w) => w[1]).sort().pop() || "";
  return { windowStart, windowEnd, items: clustered };
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

export { escapeHtml, stripHtml, extractPeople };
