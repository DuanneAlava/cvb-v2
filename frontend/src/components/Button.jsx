/*
 * One reusable button used everywhere in the app, so every button in
 * CampusVoiceBox has the same height, rounding and focus ring.
 */

/*
 * The colour of the button. Pick one with the `variant` prop.
 *
 * EVERY VARIANT CARRIES A BORDER, even the ones that show no outline - the
 * solid fills use a transparent one. Without it a bordered and an unbordered
 * button are 2px different in size, because a border counts towards a flex
 * item's minimum width. Two buttons sitting side by side with `flex-1` then
 * come out 163px and 161px instead of matching, which is exactly the kind of
 * one-pixel asymmetry that is impossible to spot and irritating to look at.
 */
const VARIANTS = {
  // Cream button on the dark hero - this is the main "Post a suggestion" call to action.
  cream: 'border border-transparent bg-cream text-navy-900 hover:bg-white',

  // Solid blue button - used on the login and sign-up forms.
  primary: 'border border-transparent bg-navy-600 text-white hover:bg-navy-700',

  // See-through button with a white outline - sits next to the cream button on the hero.
  outline: 'bg-white/10 text-white border border-white/70 hover:bg-white/20',

  // White button with a grey outline - used for quieter actions such as "Log in".
  ghost: 'bg-white text-navy-700 border border-navy-200 hover:bg-navy-50',
};

// The size of the button. Pick one with the `size` prop.
const SIZES = {
  sm: 'px-3.5 py-2 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

function Button({
  children, // the text or icon shown inside the button
  variant = 'primary', // which colour from VARIANTS above
  size = 'md', // which size from SIZES above
  type = 'button', // 'submit' makes it send the form it sits in
  fullWidth = false, // true makes the button stretch to the full width of its parent
  className = '', // any extra classes the caller wants to add
  ...props // anything else, such as onClick or disabled
}) {
  /*
   * Styles that every button shares, no matter the variant or size.
   *
   * `min-h-[44px]` is the touch-target floor. Apple, Google and WCAG 2.5.5 all
   * land on roughly 44px as the smallest control a finger can hit reliably,
   * and the small and medium sizes came out at 36-38px on their padding alone.
   * Setting a floor here rather than inflating each size keeps the paddings -
   * and so the proportions - as they were, while guaranteeing no button in the
   * app can be built too small to press.
   */
  const base =
    'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg font-semibold ' +
    'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ' +
    'focus:ring-navy-500 disabled:opacity-60 disabled:cursor-not-allowed';

  return (
    <button
      type={type}
      className={`${base} ${VARIANTS[variant]} ${SIZES[size]} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
