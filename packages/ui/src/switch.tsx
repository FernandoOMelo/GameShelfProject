import type { InputHTMLAttributes } from 'react';

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

/** Toggle visual para booleanos de formulário (equivalente a um checkbox nativo). */
export function Switch(props: SwitchProps) {
  return (
    <span className="gs-switch">
      <input type="checkbox" {...props} />
      <span className="gs-switch-thumb" aria-hidden="true" />
    </span>
  );
}
