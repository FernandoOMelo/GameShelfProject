import type { ReactNode } from 'react';
import type { AppView } from '../router';

/**
 * Cabeçalho de perfil e barra de abas do Trophies Hunter (referência visual em
 * docs/product/ui-references.md). Os números vêm todos de dados reais do app:
 * não há pontuação, seguidores nem classificação social nesta tela.
 */

const integer = new Intl.NumberFormat('pt-BR');

function hoursLabel(value: number): string {
  return `${integer.format(Math.round(value))}h`;
}

type ProfileStat = { label: string; value: string; icon: string; detail?: string };

export type ProfileHeaderProps = {
  gameCount: number;
  playingCount: number;
  completedCount: number;
  abandonedCount: number;
  totalPlayedHours: number;
  weeklyHours: number;
  /** Conquistas agregadas das plataformas; `null` quando a fonte não respondeu. */
  achievements: { unlocked: number; total: number } | null;
};

export function ProfileHeader({
  gameCount,
  playingCount,
  completedCount,
  abandonedCount,
  totalPlayedHours,
  weeklyHours,
  achievements,
}: ProfileHeaderProps) {
  const stats: ProfileStat[] = [
    { label: 'Jogos na biblioteca', icon: '▦', value: integer.format(gameCount), detail: `${integer.format(playingCount)} em andamento` },
    { label: 'Zerados', icon: '✔', value: integer.format(completedCount), detail: `${integer.format(abandonedCount)} abandonados` },
  ];
  if (achievements && achievements.total > 0) {
    stats.push({ label: 'Conquistas obtidas', icon: '◆', value: integer.format(achievements.unlocked), detail: `de ${integer.format(achievements.total)}` });
  }
  stats.push({ label: 'Tempo total de jogo', icon: '◷', value: hoursLabel(totalPlayedHours), detail: `${integer.format(weeklyHours)}h nesta semana` });

  return (
    <section className="profile-header" aria-label="Resumo do perfil">
      <div className="profile-identity">
        <span className="profile-avatar" aria-hidden="true">G</span>
        <div className="profile-names">
          <p className="profile-name">GameShelf</p>
          <p className="profile-sub">Biblioteca pessoal · dados locais</p>
        </div>
      </div>
      <dl className="profile-stats">
        {stats.map((stat) => (
          <div className="profile-stat" key={stat.label}>
            <dt>{stat.label}</dt>
            <dd className="profile-stat-value"><span className="profile-stat-icon" aria-hidden="true">{stat.icon}</span>{stat.value}</dd>
            {stat.detail && <dd className="profile-stat-detail">{stat.detail}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}

type Tab = { view: AppView; label: string; icon: string };

const tabs: Tab[] = [
  { view: 'library', label: 'Jogos', icon: '▦' },
  { view: 'queue', label: 'Fila', icon: '≣' },
  { view: 'lists', label: 'Coleções', icon: '❐' },
  { view: 'timeline', label: 'Sessões de jogo', icon: '◔' },
  { view: 'platforms', label: 'Plataformas', icon: '▤' },
  { view: 'stats', label: 'Estatísticas', icon: '∿' },
];

export type ProfileTabsProps = {
  activeView: AppView;
  queueCount: number;
  onSelect: (view: AppView) => void;
  /** Ações contextuais à direita (adição, densidade, filtros). */
  children?: ReactNode;
};

export function ProfileTabs({ activeView, queueCount, onSelect, children }: ProfileTabsProps) {
  return (
    <nav className="profile-tabs" aria-label="Seções do perfil">
      <div className="profile-tabs-list">
        {tabs.map((tab) => (
          <button
            key={tab.view}
            type="button"
            className="profile-tab"
            aria-current={activeView === tab.view ? 'page' : undefined}
            onClick={() => onSelect(tab.view)}
          >
            <span className="profile-tab-icon" aria-hidden="true">{tab.icon}</span>
            <span className="profile-tab-label">{tab.label}</span>
            {tab.view === 'queue' && <span className="profile-tab-badge" aria-hidden="true">{queueCount}</span>}
          </button>
        ))}
      </div>
      {children && <div className="profile-tabs-actions">{children}</div>}
    </nav>
  );
}
