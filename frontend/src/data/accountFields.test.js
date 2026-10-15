import { newPasswordProblem, PASSWORD_RULE_MESSAGE } from './accountFields.js';

/*
 * THE CHECK A NEW PASSWORD GETS, on the sign-up, change-password and
 * reset-password forms.
 *
 * newPasswordProblem() answers with the FIRST problem, so the order is part
 * of what it promises: a password that breaks the rule is complained about
 * before the repeat box is, because "the two passwords do not match" is no
 * help while the password itself still has to change.
 *
 * The rule itself (8+ characters, a letter and a number) is compared with
 * the server's copy by scripts/check-shared-lists.mjs.
 *
 * WHAT YOU'LL MEET IN THIS FILE
 * - test / expect / test.each  Jest - see services/moderation.test.js.
 * - toBeNull()  Fail unless the value is null - here, "no problem".
 */

const GOOD = 'Passw0rd1';

test('a password that breaks the rule is the problem, before any mismatch', () => {
  // Wrong in both ways at once: the password is named, not the repeat box.
  expect(newPasswordProblem('short', 'different')).toEqual({
    field: 'password',
    message: PASSWORD_RULE_MESSAGE,
  });
});

test.each([
  ['shorter than 8 characters', 'abc1'],
  ['without a number', 'abcdefgh'],
  ['without a letter', '12345678'],
  ['left empty', ''],
])('a password %s is refused', (_, password) => {
  expect(newPasswordProblem(password, password)?.field).toBe('password');
});

test('a good password that the repeat box does not match is the second problem', () => {
  expect(newPasswordProblem(GOOD, `${GOOD}x`)).toEqual({
    field: 'confirm',
    message: 'The two passwords do not match.',
  });
});

test('a good password, repeated exactly, has no problem', () => {
  expect(newPasswordProblem(GOOD, GOOD)).toBeNull();
});
