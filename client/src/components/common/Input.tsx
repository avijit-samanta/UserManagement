import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FieldWrapperProps {
  label: string;
  fullWidth?: boolean;
}

export function TextField({
  label,
  fullWidth,
  ...rest
}: FieldWrapperProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`form-field${fullWidth ? ' full-width' : ''}`}>
      <label className="form-label">{label}</label>
      <input className="form-input" {...rest} />
    </div>
  );
}

export function TextAreaField({
  label,
  fullWidth,
  ...rest
}: FieldWrapperProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className={`form-field${fullWidth ? ' full-width' : ''}`}>
      <label className="form-label">{label}</label>
      <textarea className="form-textarea" {...rest} />
    </div>
  );
}
