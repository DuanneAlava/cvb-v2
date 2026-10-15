/*
 * The words CampusVoiceBox refuses to publish - the SERVER'S copy.
 *
 * The board is read by students and staff, so swearing and name-calling are
 * prohibited: a post containing anything from these lists is rejected before
 * it is ever saved (see models/moderation.js for the matching rules).
 *
 * KEEP THIS IDENTICAL to frontend/src/data/blockedWords.js. The browser checks
 * a post with that copy before sending it, and the API checks it again with
 * this one - add or remove a word in both, or the two will disagree about
 * what may be posted. See the note at the top of models/moderation.js.
 *
 * The lists cover English and Filipino - Tagalog, Bisaya and Ilocano - because
 * all of them turn up in the way students actually write on Facebook.
 *
 *
 * YOU DO NOT NEED TO LIST DISGUISED SPELLINGS
 * ===========================================
 * Everything here is written in plain lower case. The checker undoes the usual
 * disguises before comparing, so all of these are caught by the single entry
 * "putanginamo":
 *
 *   p0t4ng1naMoh      digits swapped in for letters, and texting "h" on the end
 *   P.U.T.A.N.G.I.N.A dots, stars, dashes or any other padding between letters
 *   p u t a n g i n a the word broken up with spaces
 *   pUuuuTaNgInAaAa   letters held down, and random capitals
 *   potangina mo      the o/u swap Filipino spelling drifts between
 *   putanginamoh      the texting "h" on its own
 *
 * So add the ordinary spelling of a word and the variants come free. What is
 * still worth adding by hand is a genuinely different spelling - "pakshet" is
 * not a disguised "pakyu", it is its own word, so both are listed.
 *
 *
 * A WARNING ABOUT FALSE POSITIVES
 * ===============================
 * Only add a word that is rude in every context. The wider these lists get,
 * the easier it is to block an honest post by accident, and a suggestion box
 * that eats honest posts is worse than one that lets a swear through. Read
 * ALWAYS_ALLOWED at the bottom before adding anything - it explains the words
 * that look like they belong here and deliberately do not.
 */

/* ------------------------------------------------------------------ *
 * ENGLISH
 * ------------------------------------------------------------------ */

// Swearing and slurs.
const PROFANITY_EN = [
  // the f-word and its spellings
  'fuck', 'fucks', 'fucked', 'fucking', 'fuckin', 'fuckn', 'fucker', 'fuckers',
  'fuk', 'fuq', 'fck', 'fcking', 'fvck', 'phuck', 'fk', 'fking',
  'motherfucker', 'motherfucking', 'mofo', 'mf', 'mfer',
  'dumbfuck', 'fuckface', 'fuckwit', 'fucktard',

  // the s-word and its spellings. "shet" is caught without being listed,
  // because listing it would also block the word "sheet".
  'shit', 'shits', 'shitty', 'shite', 'sht', 'shyt',
  'bullshit', 'bullcrap', 'horseshit', 'dogshit',
  'shithead', 'shitface', 'dipshit', 'jackshit',

  'bitch', 'bitches', 'bitching', 'bitchy', 'btch', 'biatch', 'biotch',
  'bitchass', 'bastard', 'bastards',

  'ass', 'asses', 'azz', 'asshole', 'assholes', 'arsehole', 'arse',
  'dumbass', 'jackass', 'asshat', 'assclown', 'asswipe', 'smartass',

  'dick', 'dickhead', 'dickface', 'cock', 'prick', 'pussy', 'cunt', 'twat',
  'wanker', 'whore', 'whores', 'slut', 'sluts', 'skank', 'hoe',

  // slurs
  'nigger', 'nigga', 'niggas', 'faggot', 'faggots', 'fag', 'fags', 'dyke',
  'tranny', 'retard', 'retards', 'retarded', 'spastic', 'spaz',
  'chink', 'gook', 'spic', 'wetback', 'midget', 'cripple',

  'bollocks', 'piss', 'pissed', 'crap', 'crappy', 'damn', 'damnit', 'dammit',
  'goddamn', 'goddamnit', 'douche', 'douchebag',

  // the shorthand that carries a swear inside it
  'stfu', 'wtf', 'gtfo', 'kys', 'lmfao', 'omfg', 'ffs', 'tf',
];

// Name-calling. Not swearing, but rude at a person, which the board also
// refuses: a suggestion should describe a problem, not attack somebody.
const INSULTS_EN = [
  'stupid', 'idiot', 'idiots', 'idiotic', 'moron', 'morons', 'moronic',
  'imbecile', 'dumb', 'dumbo', 'dimwit', 'halfwit', 'nitwit',
  'loser', 'losers', 'ugly', 'pathetic', 'useless', 'worthless',
  'scum', 'freak', 'psycho', 'jerk', 'incompetent', 'clueless', 'brainless',
];

/* ------------------------------------------------------------------ *
 * FILIPINO - Tagalog, Bisaya and Ilocano
 *
 * These are the ones that actually fill Filipino comment sections. The o/u
 * swap ("putangina" / "potangina") and the texting "h" ("...moh") are both
 * handled by the checker, so only one spelling of each needs listing.
 * ------------------------------------------------------------------ */

const PROFANITY_FIL = [
  // the putangina family, easily the most common of the lot
  'putangina', 'putanginamo', 'putanginang', 'putangnamo', 'putang',
  'puta', 'putaka', 'pota', 'potaena', 'putaena', 'putres', 'putragis',
  'tangina', 'tanginamo', 'tanginang', 'taena', 'taenamo', 'tngina', 'ptngina',
  'kingina', 'kinginamo', 'kingnamo', 'kanginamo',
  'amputa', 'ampota', 'anakngputa', 'yudiputa',
  'bwakanginamo', 'bwakangina',

  // pucha / pakyu / pakshet
  'pucha', 'puchang', 'putcha', 'pakshet', 'pakingshet', 'pakyu', 'pakyew',

  'gago', 'gaga', 'gagu', 'gagong', 'gagang', 'gagagago',
  'kupal', 'kupalka', 'punyeta', 'punyemas', 'puneta',
  'letse', 'litse', 'letseng', 'lintik', 'lintikna', 'lintian',
  'tarantado', 'tarantada', 'hinayupak', 'hayupak', 'hayup',
  'walanghiya', 'walanghiyang',

  'bwisit', 'buwisit', 'bwiset', 'bwesit',
  'peste', 'pesteng', 'pisti', 'piste', 'yawa', 'yawaka',
  'salot', 'demonyo', 'demonyita', 'satanas', 'hudas', 'atay',

  // crude and sexual
  'tae', 'titi', 'puke', 'pekpek', 'kepyas', 'burat', 'bayag', 'etits',
  'tarugo', 'bilat', 'jakol', 'jakulan', 'kantot', 'kantutan', 'iyot',
  'iyutan', 'chupa', 'tsupa', 'libog', 'malibog', 'kalibugan',
  'malandi', 'landi', 'harot', 'pokpok', 'kabit',

  // Ilocano
  'ukinnam', 'ukinnana', 'ukinam',
];

const INSULTS_FIL = [
  'tanga', 'tangang', 'tnga', 'bobo', 'boba', 'bobong', 'bobita',
  'ulol', 'ulul', 'ulolka', 'engot', 'hangal', 'gunggong', 'ungas',
  'shunga', 'abnoy', 'abnormal', 'siraulo', 'baliw', 'buang', 'buwang',
  'inutil', 'epal', 'unggoy', 'pangit', 'panget', 'chaka',
  'traydor', 'sinungaling', 'palamunin',
];

/* ------------------------------------------------------------------ *
 * PHRASES
 *
 * Rude only as a whole phrase. "animal" on its own is an ordinary word;
 * "animal ka" is an insult, so the phrase is listed here instead of the
 * single word being banned everywhere.
 * ------------------------------------------------------------------ */

const BLOCKED_PHRASES = [
  // Filipino
  'putang ina', 'putang ina mo', 'tang ina', 'tang ina mo', 'anak ng puta',
  'anak ka ng puta', 'bwakang ina', 'puta ka', 'puta ang',
  'hayop ka', 'animal ka', 'atay ka', 'yawa ka', 'walang hiya',
  'sira ulo', 'ulol ka', 'gago ka', 'gaga ka', 'bobo mo', 'tanga mo',
  'wala kang kwenta', 'wala kang silbi', 'pesteng yawa', 'kain ka ng tae',

  // English
  'son of a bitch', 'piece of shit', 'shut the fuck up', 'fuck you',
  'fuck off', 'screw you', 'shut up', 'shut your mouth', 'you suck',
  'go to hell', 'kill yourself',
];

/* ------------------------------------------------------------------ *
 * NEVER BLOCK THESE
 *
 * Words checked before anything else, and always allowed through. Two very
 * different reasons for the entries below - both matter.
 * ------------------------------------------------------------------ */

const ALWAYS_ALLOWED = [
  /*
   * 1. WORDS THAT LOOK LIKE A SWEAR BUT ARE NOT.
   * "sheet" squashes down to "shet", "class" to "clas", and "assignment"
   * starts with three letters that are a swear on their own. All perfectly
   * ordinary school words.
   */
  'sheet', 'sheets', 'spreadsheet', 'class', 'classes', 'classroom',
  'assignment', 'assignments', 'assessment', 'assessments', 'assess',
  'asset', 'assets', 'assist', 'assistance', 'assistant', 'associate',
  'association', 'assume', 'assumption', 'assure', 'assembly',
  'pass', 'passed', 'passes', 'passing', 'password', 'passage',
  'grass', 'glass', 'glasses', 'mass', 'bass', 'brass', 'compass', 'embassy',
  'analysis', 'analyse', 'analyze', 'analytics', 'cocktail', 'peacock',
  'title', 'titles', 'deck', 'decks', 'poke', 'bs', 'hell',
  'pest', 'pests', 'pesticide', 'leche', 'kangina', 'kanina',

  /*
   * 2. WORDS A STUDENT NEEDS IN ORDER TO REPORT A REAL PROBLEM.
   * This is the important half. A suggestion box exists so that students can
   * say "may manyak sa CR" or "there is a cockroach in the canteen". Block
   * the vocabulary of a complaint and the filter silences exactly the reports
   * that matter most - harassment, filth and safety. Do not add these to the
   * lists above, however rude they sound out of context.
   */
  'bastos', 'manyak', 'manyakis', 'pervert', 'creep', 'rapist',
  'harass', 'harassment', 'bully', 'bullying', 'bastos na',
  'baboy', 'manok', 'uod', 'ipis', 'daga', 'lamok', 'langaw',
  'basura', 'dumi', 'marumi', 'madumi', 'mabaho', 'amoy', 'baho',
  'sira', 'sirang', 'nasira', 'butas', 'tagas', 'baha',
  'trash', 'garbage', 'rubbish', 'dirty', 'smelly', 'broken', 'leaking',
];

/* ------------------------------------------------------------------ *
 * The combined lists the checker actually reads.
 * The Filipino ones are kept separate as well, because the checker applies
 * the Filipino o/u spelling drift only to those - doing it to English would
 * turn "deck" into "dick" and start rejecting honest posts.
 * ------------------------------------------------------------------ */

const PROFANITY = [...PROFANITY_EN, ...PROFANITY_FIL];
const INSULTS = [...INSULTS_EN, ...INSULTS_FIL];
const FILIPINO_WORDS = [...PROFANITY_FIL, ...INSULTS_FIL];

module.exports = { PROFANITY, INSULTS, FILIPINO_WORDS, BLOCKED_PHRASES, ALWAYS_ALLOWED };
