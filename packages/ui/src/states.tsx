import type { ReactNode } from 'react';

type StatCardProps = {
  label: string;
  value: string;
  detail?: string;
  /** Comparação com o período anterior (ex.: `▲ 12% vs. período anterior`). */
  delta?: string;
  accent?: boolean;
  small?: boolean;
  /** Quando informado, o card vira botão navegável (ver `linkLabel`). */
  onClick?: () => void;
  linkLabel?: string;
};

/** Indicador numérico do painel e das estatísticas. */
export function StatCard({ label, value, detail, delta, accent = false, small = false, onClick, linkLabel }: StatCardProps) {
  const className = `stat-card${accent ? ' stat-card-accent' : ''}${small ? ' stat-card-small' : ''}`;
  const body = <><span>{label}</span><strong>{value}</strong>{detail && <em>{detail}</em>}{delta && <em className="stat-delta">{delta}</em>}</>;
  if (!onClick) return <article className={className}>{body}</article>;
  return <button type="button" className={`${className} stat-card-link`} aria-label={linkLabel ?? `${label}: ${value}. Ver na biblioteca`} onClick={onClick}>{body}</button>;
}

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
};

/** Estado vazio padrão de uma tela ou lista. */
export function EmptyState({ title, description, icon = '▧', action }: EmptyStateProps) {
  return <section className="empty-state">
    <span className="empty-icon" aria-hidden="true">{icon}</span>
    <h2>{title}</h2>
    {description && <p>{description}</p>}
    {action}
  </section>;
}

/** Estado de carregamento (spin desligado em `prefers-reduced-motion`). */
export function LoadingState({ children }: { children: ReactNode }) {
  return <p className="loading-state" role="status">{children}</p>;
}

/** Estado de erro com ação de recuperação opcional. */
export function ErrorState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="notice" role="alert">{children}{action}</div>;
}
