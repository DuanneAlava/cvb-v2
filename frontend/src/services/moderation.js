import {
  PROFANITY,
  INSULTS,
  FILIPINO_WORDS,
  BLOCKED_PHRASES,
  ALWAYS_ALLOWED,
} from '../data/blockedWords.js';

/*
 * The rudeness filter.
 *
 * Swearing and name-calling are prohibited on the board, so every post is
 * checked here before it is sent. The post form calls checkFields() and
 * refuses to submit when anything is found, and the records are checked again
 * as they arrive from the server (services/store.js), so a word added to the
 * list later still keeps older posts using it off the screen.
 *
 * THE SERVER HAS ITS OWN COPY - backend/src/models/moderation.js and
 * blockedWords.js - and checks every post again when it arrives, because a
 * request sent without this form skips this check. Keep the two copies
 * identical: change a rule or a word here, make the same change there.
 *
 * The hard part of a word filter is not catching "putangina" - it is catching
 * "p0t4ng1naMoh" while still letting "assignment", "sheet", "leche flan" and
 * "may manyak sa CR" through untouched. The steps below are ordered to do
 * exactly that, and the ALWAYS_ALLOWED list is checked before any of them.
 */

/*
 * STEP 1 - undo the usual disguises.
 * Students hide a word by swapping letters for lookalike digits and symbols,
 * so those are swapped back before anything is compared. This is what turns
 * "p0t4ng1na" back into "potangina".
 */
const LOOKALIKES = {
  '4': 'a', '@': 'a',
  '3': 'e', '€': 'e',
  '1': 'i', '!': 'i', '|': 'i',
  '0': 'o', ø: 'o',
  '5': 's', $: 's',
  '7': 't', '+': 't',
  '8': 'b',
  '6': 'g', '9': 'g',
};

function normalise(text) {
  return (
    text
      .toLowerCase()
      // pull accents off their letters, so "puñeta" becomes "puneta"
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // swap each lookalike character for the letter it stands in for
      .replace(/[4@3€1!|0ø5$7+869]/g, (character) => LOOKALIKES[character] ?? character)
      // drop everything that is not a letter or a space, which collapses
      // "f*u*c*k" and "p.u.t.a.n.g.i.n.a" back into single words
      .replace(/[^a-z\s]/g, '')
      // squash any run of spaces down to one, and trim the ends
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/*
 * STEP 2 - flatten stretched spelling.
 * "fuuuuck" and "gagooo" become "fuck" and "gago" by keeping only the first
 * letter of each repeated run.
 */
function squeeze(word) {
  return word.replace(/(.)\1+/g, '$1');
}

/*
 * STEP 3 - drop the texting "h".
 * Filipino texting hangs an "h" off the end of a word - "moh", "nah", "kah",
 * "poh" - so "putanginamoh" is checked as "putanginamo" too. The letter before
 * it has to be a vowel, which keeps real words like "bath" and "tech" intact.
 */
function dropTextingH(word) {
  return /[aeiou]h$/.test(word) ? word.slice(0, -1) : word;
}

/*
 * STEP 4 - even out the Filipino vowel drift.
 * Filipino spelling wanders between o and u, and between e and i: putangina
 * and potangina are the same word, so are letse and litse. Folding u to o and
 * i to e puts both spellings into the same shape.
 *
 * This is only ever applied to the Filipino word list. Doing it to English
 * would fold "deck" into "dick" and "poke" into "puke", and the filter would
 * start rejecting honest posts.
 */
function foldVowels(word) {
  return word.replace(/u/g, 'o').replace(/i/g, 'e');
}

/*
 * STEP 5 - strip a common ending.
 * This catches inflections that are not spelled out in the word lists, such as
 * "shitty" -> "shitt" -> "shit".
 */
function stripSuffix(word) {
  return word.replace(/(ing|ers|es|ed|er|s|y)$/, '');
}

// Every banned single word, held in a Set so lookups are instant.
const WORD_SET = new Set([...PROFANITY, ...INSULTS]);

/*
 * The same words with their repeated letters flattened, used to catch stretched
 * spelling. Anything shorter than four characters is left out on purpose:
 * flattening "ass" gives "as", and blocking "as" would reject almost every
 * honest sentence on the board.
 */
const SQUEEZED_SET = new Set(
  [...WORD_SET].map(squeeze).filter((word) => word.length >= 4)
);

/*
 * The Filipino words with their vowels folded. Only words of six letters or
 * more go in: the long compound curses are where the o/u drift actually
 * happens, and keeping short words out stops folding turning "puke" into
 * "poke" and blocking a canteen suggestion.
 */
const FOLDED_FIL_SET = new Set(
  FILIPINO_WORDS.filter((word) => word.length >= 6).map((word) => foldVowels(word))
);

const PHRASES = BLOCKED_PHRASES.map(normalise);
const ALLOWED = new Set(ALWAYS_ALLOWED.map(normalise));

/*
 * Every spelling of one word worth checking: as typed, without the texting
 * "h", flattened, and with a common ending removed - plus the combinations,
 * because "putanginamoooh" needs all three at once.
 */
function variantsOf(word) {
  const variants = new Set([word]);

  for (const current of [...variants]) variants.add(dropTextingH(current));
  for (const current of [...variants]) variants.add(squeeze(current));
  for (const current of [...variants]) {
    const stem = stripSuffix(current);
    if (stem !== current && stem.length >= 3) variants.add(stem);
  }

  return variants;
}

// Does this single word match the lists, in any of its disguises?
function isBlockedWord(word) {
  // The allowlist wins over everything. "sheet" is a sheet.
  if (ALLOWED.has(word)) return false;

  for (const variant of variantsOf(word)) {
    if (WORD_SET.has(variant)) return true;

    const flattened = squeeze(variant);
    if (flattened.length >= 4 && SQUEEZED_SET.has(flattened)) return true;

    if (variant.length >= 6 && FOLDED_FIL_SET.has(foldVowels(variant))) return true;
  }

  return false;
}

/*
 * Join up a word that was typed one letter at a time - "p u t a n g i n a".
 * Only runs of single letters are joined, and only runs of three or more, so
 * ordinary writing is left exactly as it was.
 */
function joinSpacedOutLetters(words) {
  const joined = [];
  let run = [];

  function flushRun() {
    if (run.length >= 3) joined.push(run.join(''));
    run = [];
  }

  for (const word of words) {
    if (word.length === 1) {
      run.push(word);
    } else {
      flushRun();
    }
  }
  flushRun();

  return joined;
}

/*
 * Check a piece of text and report what was found.
 *
 * Returns { clean, matches }.
 *
 * NEVER PUT `matches` ON THE SCREEN. It holds the actual offending words, and
 * repeating them back - in the form, on a card, or anywhere else - would print
 * the very swearing the board refuses to publish, which defeats the point of
 * having a filter at all. It is here so that a future staff moderation log, or
 * the same check running on the server, has something to record. What the
 * student sees is rejectionMessage() below, which names nothing.
 */
function checkText(text) {
  if (!text) return { clean: true, matches: [] };

  const normalised = normalise(text);
  const words = normalised.split(' ').filter(Boolean);
  const found = new Set();

  // Single words. Splitting on spaces is what keeps "assignment" safe: it is
  // compared whole, and it does not equal "ass".
  for (const word of words) {
    if (isBlockedWord(word)) found.add(word);
  }

  // The same again for anything spelled out one letter at a time.
  for (const word of joinSpacedOutLetters(words)) {
    if (isBlockedWord(word)) found.add(word);
  }

  // Whole phrases. The spaces around the phrase stop "shut up" matching
  // inside a longer word.
  for (const phrase of PHRASES) {
    if (` ${normalised} `.includes(` ${phrase} `)) found.add(phrase);
  }

  return { clean: found.size === 0, matches: [...found] };
}

// Check several fields at once, e.g. a post's title and its message.
export function checkFields(...values) {
  return checkText(values.filter(Boolean).join(' '));
}

/*
 * The warning the student sees when a check fails.
 *
 * It takes no arguments on purpose. There is deliberately no route from the
 * matched words to the screen, so the message cannot start quoting swearing
 * back at whoever typed it - or at anyone reading over their shoulder.
 */
export function rejectionMessage() {
  return (
    'Your post contains words that are not allowed on CampusVoiceBox. ' +
    'Please rewrite it respectfully before posting.'
  );
}
