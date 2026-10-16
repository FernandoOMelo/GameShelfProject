import type { ReactNode } from 'react';

export type BarListEntry = {
  key: string | number;
  label: ReactNode;
  value: number;
  /** Dica exibida ao passar o mouse (o valor numérico já é lido pelo leitor de tela). */
  title?: string;
};

type BarListProps = {
  entries: BarListEntry[];
  /** Nome acessível da lista, por exemplo `Jogos por nota`. */
  label: string;
  /** Conteúdo exibido quando a lista está vazia. */
  empty?: ReactNode;
};

/**
 * Gráfico de barras horizontais usado nas estatísticas.
 *
 * As barras são HTML/CSS em vez de SVG: o projeto não usa biblioteca de gráficos
 * e o fluxo de layout mantém o texto selecionável e acessível, além de se ajustar
 * sozinho à largura disponível sem cálculo de coordenadas.
 */
export function BarList({ entries, label, empty }: BarListProps) {
  if (!entries.length) return <>{empty ?? null}</>;
  const max = Math.max(1, ...entries.map((entry) => entry.value));
  return <ul className="hbar-list" aria-label={label}>
    {entries.map((entry) => <li key={entry.key} title={entry.title}>
      <span className="hbar-label">{entry.label}</span>
      <span className="hbar-track"><span className="hbar-fill" style={{ width: `${(entry.value / max) * 100}%` }} /></span>
      <strong>{entry.value}</strong>
    </li>)}
  </ul>;
}
