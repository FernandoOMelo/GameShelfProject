import type { ReactNode } from 'react';

type PanelProps = {
  children: ReactNode;
  /** Título visível. Vira um `<h2>` e é ligado ao painel por `titleId`. */
  title?: ReactNode;
  titleId?: string;
  /** Controles alinhados à direita do título. */
  actions?: ReactNode;
  className?: string;
};

/** Superfície de conteúdo do sistema (equivalente à antiga classe `.panel`). */
export function Panel({ children, title, titleId, actions, className }: PanelProps) {
  const hasHeader = title != null || actions != null;
  return <section className={`panel${className ? ` ${className}` : ''}`} aria-labelledby={titleId}>
    {hasHeader && <div className="section-heading">{title != null && <h2 id={titleId}>{title}</h2>}{actions}</div>}
    {children}
  </section>;
}
