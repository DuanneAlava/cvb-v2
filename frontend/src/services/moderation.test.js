import { checkFields, rejectionMessage } from './moderation.js';
import { PROFANITY, INSULTS, BLOCKED_PHRASES, ALWAYS_ALLOWED } from '../data/blockedWords.js';

/*
 * THE RUDENESS FILTER, TESTED ON KNOWN INPUTS.
 *
 * services/moderation.js is the check every post gets before it is sent. It
 * has two jobs, and both are tested here: catch a rude word however it is
 * disguised, and let an honest post through untouched - "assignment",
 * "sheet", "may manyak sa CR". The second job matters as much as the first:
 * a filter that rejects a real complaint silences exactly the report the
 * board exists for.
 *
 * The server keeps its own copy of this filter (backend/src/models/
 * moderation.js); scripts/check-shared-lists.mjs proves both copies answer
 * alike. These tests prove the answers are the right ones.
 *
 * Run with `npm test` in frontend/ (CI adds `-- --watchAll=false`).
 *
 * WHAT YOU'LL MEET IN THIS FILE
 * - describe('name', fn) / test('name', fn)  Jest, the test runner that
 *   comes with react-scripts. describe groups tests; each test is one check.
 * - test.each(list)('name %s', fn)  The same test run once per item in the
 *   list; %s in the name is replaced by the item, so a failure says which.
 * - expect(value).toBe(other)  Fail unless the two are the same.
 *   toEqual compares contents (two lists with the same items are equal).
 */

const blocked = (text) => !checkFields(text).clean;

describe('words on the lists are blocked', () => {
  test('every single word on the profanity and insult lists', () => {
    for (const word of [...PROFANITY, ...INSULTS]) {
      expect({ word, blocked: blocked(word) }).toEqual({ word, blocked: true });
    }
  });

  test('every blocked phrase', () => {
    for (const phrase of BLOCKED_PHRASES) {
      expect({ phrase, blocked: blocked(phrase) }).toEqual({ phrase, blocked: true });
    }
  });

  test('in capitals, in the middle of a sentence', () => {
    expect(blocked('The STUPID chairs in room 204 are broken.')).toBe(true);
  });

  test('in any of the fields checked together', () => {
    // The post form checks the title and the message in one call.
    expect(checkFields('Broken chairs', 'Whoever did this is stupid')).toEqual({
      clean: false,
      matches: ['stupid'],
    });
  });
});

describe('disguised spellings are still caught', () => {
  test.each([
    ['spaced out one letter at a time', 's t u p i d'],
    ['spaced out inside a sentence', 'I am not s t u p i d'],
    ['with symbols between the letters', 'f*u*c*k'],
    ['with digits for letters', '1d10t'],
    ['with digits and the texting "h"', 'p0t4ng1naMoh'],
    ['stretched', 'fuuuuck'],
    ['stretched, with the texting "h"', 'putanginamoooh'],
    ['with the other Filipino vowel spelling', 'potangina'],
    ['with an accent', 'pütangina'],
    ['with an ending added', 'sh1tty'],
  ])('%s: "%s"', (_, text) => {
    expect(blocked(text)).toBe(true);
  });
});

describe('honest posts are let through', () => {
  test('every word on the always-allowed list', () => {
    for (const word of ALWAYS_ALLOWED) {
      expect({ word, blocked: blocked(word) }).toEqual({ word, blocked: false });
    }
  });

  test.each([
    // Words that contain, or squash down to, a swear.
    'Please post the assignment sheet before class.',
    'The spreadsheet for the assessment is wrong.',
    // A complaint needs these words to be made at all.
    'may manyak sa CR',
    'There is a cockroach in the canteen.',
    'leche flan',
    // Folding o/u and e/i is only done to Filipino words, so these stay put.
    'The deck chairs by the pool.',
    'Do not poke the projector.',
    // The texting "h" is only dropped after a vowel.
    'The bath in the dorm is broken.',
    'The tech room needs more chairs.',
    'Please fix the broken chairs in room 204.',
  ])('"%s"', (text) => {
    expect(checkFields(text)).toEqual({ clean: true, matches: [] });
  });

  test('nothing at all is clean', () => {
    expect(checkFields('')).toEqual({ clean: true, matches: [] });
    expect(checkFields(undefined, null)).toEqual({ clean: true, matches: [] });
  });
});

test('the message a student sees names none of the words it found', () => {
  const message = rejectionMessage();
  expect(message).toMatch(/not allowed/);
  for (const word of [...PROFANITY, ...INSULTS]) {
    expect(message.toLowerCase().split(/\W+/)).not.toContain(word);
  }
});
