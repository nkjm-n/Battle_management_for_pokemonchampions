import { useId, useState } from "react";

export default function AutocompleteInput({
  label,
  value,
  placeholder,
  suggestions,
  onChange,
  onSelect,
  helper,
}) {
  const inputId = useId();
  const [isFocused, setIsFocused] = useState(false);
  const showSuggestions = isFocused && value.trim() !== "" && suggestions.length > 0;

  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <div className="autocomplete">
        <input
          id={inputId}
          className="field__input"
          type="text"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={(event) => onChange(event.target.value)}
        />
        {showSuggestions ? (
          <div className="autocomplete__panel">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.key}
                className="autocomplete__item"
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(suggestion.value);
                }}
              >
                <span className="autocomplete__item-name">{suggestion.value}</span>
                {suggestion.meta ? <span className="autocomplete__item-meta">{suggestion.meta}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {helper ? <span className="field__helper">{helper}</span> : null}
    </label>
  );
}
