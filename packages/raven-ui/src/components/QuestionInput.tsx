import * as React from "react";

export interface QuestionInputProps {
  /** Controlled question text (0..N chars). When provided, the component is controlled and `onChange` should update it. */
  value?: string;
  /** Initial question text for the uncontrolled case. Ignored when `value` is set. */
  defaultValue?: string;
  /** Placeholder shown in the empty textarea. */
  placeholder?: string;
  /** Example questions rendered as chip buttons below the card. Omit/empty to hide the chip row. */
  examples?: string[];
  /** Fired whenever the text changes (typing or picking an example). */
  onChange?: (v: string) => void;
  /** Fired when the user submits — clicking "Consult Raven" or pressing Enter (no shift). Receives the current text. */
  onConsult?: (v: string) => void;
  /** Fired when an example chip is picked. The text is also set to the picked question. */
  onPickExample?: (q: string) => void;
}

/**
 * The landing input card for asking Raven a yes/no forecast question: a serif
 * textarea with a mono "raven ▸" eyebrow, an "↵ Enter to consult" hint, and a
 * "Consult Raven →" button — followed by optional example chips that fill the box.
 * Controlled when `value` is given, otherwise it manages its own text state.
 */
export const QuestionInput: React.FC<QuestionInputProps> = ({
  value,
  defaultValue,
  placeholder = "Will Apple ship a foldable iPhone in 2026?",
  examples,
  onChange,
  onConsult,
  onPickExample,
}) => {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const text = isControlled ? (value as string) : internal;

  const setText = (v: string) => {
    if (!isControlled) setInternal(v);
    onChange?.(v);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onConsult?.(text);
    }
  };

  const pickExample = (q: string) => {
    setText(q);
    onPickExample?.(q);
  };

  return (
    <div>
      <div
        style={{
          background: "var(--rv-bg2)",
          border: "1px solid var(--rv-line)",
          borderRadius: 18,
          padding: "18px 18px 16px",
          textAlign: "left",
          boxShadow: "0 24px 60px -30px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            fontFamily: "var(--rv-font-mono)",
            fontSize: 12,
            color: "var(--rv-orange)",
            marginBottom: 10,
          }}
        >
          <span>raven</span>
          <span style={{ color: "var(--rv-ink3)" }}>&#9656;</span>
        </div>
        <textarea
          rows={2}
          value={text}
          placeholder={placeholder}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          style={{
            width: "100%",
            resize: "none",
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--rv-ink)",
            fontFamily: "var(--rv-font-serif)",
            fontSize: 25,
            lineHeight: 1.3,
            letterSpacing: -0.2,
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 14,
            paddingTop: 14,
            borderTop: "1px solid var(--rv-line)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--rv-font-mono)",
              fontSize: 11,
              color: "var(--rv-ink3)",
            }}
          >
            &#8629; Enter to consult
          </div>
          <button
            type="button"
            onClick={() => onConsult?.(text)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              background: "var(--rv-orange)",
              color: "#150C07",
              fontWeight: 600,
              fontSize: 14,
              border: "none",
              borderRadius: 10,
              padding: "11px 20px",
              cursor: "pointer",
              boxShadow: "0 8px 24px -8px var(--rv-orange)",
            }}
          >
            Consult Raven <span style={{ fontSize: 16 }}>&rarr;</span>
          </button>
        </div>
      </div>
      {examples && examples.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 9,
            justifyContent: "center",
            marginTop: 24,
          }}
        >
          {examples.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => pickExample(q)}
              style={{
                fontSize: 12.5,
                color: "var(--rv-ink2)",
                background: "var(--rv-bg2)",
                border: "1px solid var(--rv-line)",
                borderRadius: 100,
                padding: "8px 14px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
