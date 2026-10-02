import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode };

export function Button({ children, ...props }: ButtonProps) {
  return <button {...props} className={`gameshelf-button ${props.className ?? ''}`.trim()}>{children}</button>;
}
