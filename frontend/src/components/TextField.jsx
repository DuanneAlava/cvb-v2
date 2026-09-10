/*
 * One labelled field for the auth forms: the label, the box, an optional grey
 * hint underneath, and the red error message when something is wrong.
 *
 * Keeping this in one file means every field on both forms lines up and
 * behaves the same way.
 *
 * Pass `options` and it draws a dropdown instead of a text box, with the same
 * label, hint, error and 44px height as everything around it. That is how
 * Course / Program stopped being free text without the sign-up form growing a
 * second, slightly different-looking kind of field.
 */
function TextField({
  id, // links the label to the input, so tapping the label focuses the box
  label, // the text above the box
  type = 'text', // 'text', 'email' or 'password'
  value, // the current text, held by the page using this field
  onChange, // called whenever the student types
  placeholder,
  hint, // optional grey helper text under the box
  error, // optional red message shown when the value is not accepted
  autoComplete, // lets the browser and password managers fill the field in
  options, // when given, this becomes a <select> of { value, label } entries
}) {
  // One set of classes, so the dropdown and the text box are the same shape.
  const boxClass = `mt-1.5 min-h-[44px] w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 ${
    error
      ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
      : 'border-slate-300 focus:border-navy-600 focus:ring-navy-600'
  }`;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-navy-900">
        {label}
      </label>

      {options ? (
        <select
          id={id}
          value={value}
          onChange={onChange}
          aria-invalid={Boolean(error)}
          className={`${boxClass} cursor-pointer bg-white`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          // The border turns red when there is an error, so it is easy to spot.
          aria-invalid={Boolean(error)}
          className={boxClass}
        />
      )}

      {/* Show the error if there is one, otherwise show the hint if one was given. */}
      {error ? (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

export default TextField;
