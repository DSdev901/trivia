/** Shared guestbook language filter for the API and the home page form. */

const BANNED = new Set(
  `
  anal anus arse arses ass asses asshole assholes
  ballsack bastard bastards bitch bitches bitchy blowjob bollocks boner boob boobs
  chink chinks clitoris cock cocks coon coons cum cums cunt cunts
  dick dicks dildo dildos dyke dykes
  fag faggot faggots fags fatass fellatio feltch
  fuck fucked fucker fuckers fucking fucks
  goddam goddammit goddamn
  homo homos
  jackass jackasses jap japs jizz
  kike kikes
  milf motherfucker motherfuckers motherfucking
  nigg nigga niggas nigger niggers
  penis penises piss pissed pisses pissing porn porno prick pricks pussies pussy
  retard retarded retards rimjob
  shit shits shitty slut sluts
  spastic spic spics
  tit tits titty tranny twat twats
  vagina vaginas
  wank wanker wankers whore whores
  fck fuk fvck phuck
  `.match(/[a-z]+/g)
);

const CHASTISE = [
  "Tut tut. This guestbook is PG, like a church raffle with better snacks. Try that again without the spice.",
  "We read that, gasped, and fainted onto the fainting couch. Come back when your vocabulary has put its pants on.",
  "Sir/Madam, this is a trivia night, not a pirate shanty. The book remains un-signed until you cool it.",
  "Our imaginary webmaster has printed this on a Post-it and stuck it to your fridge: no swearing in the guest book, pal.",
  "Bold strategy. The guestbook has clutched its pearls and asked you to try a version Grandma could read aloud.",
];

const LEET = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
  "!": "i",
};

function normalize(text) {
  let s = String(text || "").toLowerCase();
  s = s.replace(/[013457@$!]/g, (ch) => LEET[ch] || ch);
  s = s.replace(/[^a-z]+/g, " ");
  return s.trim();
}

function foldRepeats(token) {
  return token.replace(/(.)\1+/g, "$1");
}

function glueSingles(tokens) {
  const out = [];
  let buf = "";
  const flush = () => {
    if (buf.length >= 3) out.push(buf);
    buf = "";
  };
  for (const t of tokens) {
    if (t.length === 1) buf += t;
    else {
      flush();
      out.push(t);
    }
  }
  flush();
  return out;
}

function tokenBanned(token) {
  if (!token) return false;
  if (BANNED.has(token) || BANNED.has(foldRepeats(token))) return true;
  if (token.endsWith("ed") && BANNED.has(token.slice(0, -2))) return true;
  if (token.endsWith("er") && BANNED.has(token.slice(0, -2))) return true;
  if (token.endsWith("ing") && token.length > 6 && BANNED.has(token.slice(0, -3))) {
    return true;
  }
  return false;
}

export function guestbookHasVulgar(text) {
  const tokens = glueSingles(normalize(text).split(/\s+/).filter(Boolean));
  return tokens.some(tokenBanned);
}

export function chastiseGuestbook(text) {
  const s = String(text || "x");
  let n = 0;
  for (let i = 0; i < s.length; i += 1) {
    n = (n + s.charCodeAt(i) * (i + 1)) % CHASTISE.length;
  }
  return CHASTISE[n];
}
