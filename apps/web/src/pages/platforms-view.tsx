import type { Game, Platform, PlatformSummary } from '@gameshelf/contracts';
import { Button, EmptyState } from '@gameshelf/ui';

import { PlatformIcon } from './platform-icons';
import { formatCompactHours } from './shared';

/**
 * Aba Plataformas: o equivalente à área "Contas" do Trophies Hunter, sem os
 * dados sociais da referência. Cada card mostra o que o GameShelf realmente
 * sabe sobre a plataforma — contagem de jogos, zerados, tempo registrado e
 * conquistas — e omite a linha quando não há dado, em vez de exibir zero.
 */

const integer = new Intl.NumberFormat('pt-BR');

export type PlatformsViewProps = {
  platforms: Platform[];
  summaries: PlatformSummary[];
  games: Game[];
  onGoToSettings: () => void;
};

type Row = {
  platform: Platform;
  gameCount: number;
  completedCount: number;
  dominatedCount: number;
  localMinutes: number;
  externalMinutes: number;
  achievements: { unlocked: number; total: number } | null;
  covers: string[];
};

function buildRows(platforms: Platform[], summaries: PlatformSummary[], games: Game[]): Row[] {
  return platforms
    .map((platform): Row => {
      const summary = summaries.find((item) => item.platform.id === platform.id) ?? null;
      const linked = games.filter((game) => game.platformIds.includes(platform.id));
      const gameCount = summary?.gameCount ?? linked.length;
      const completedCount = summary?.completedCount ?? linked.filter((game) => game.status === 'COMPLETED').length;
      const dominatedCount = summary?.dominatedCount ?? 0;
      return {
        platform,
        gameCount,
        completedCount,
        dominatedCount,
        localMinutes: summary?.localPlayedMinutes ?? 0,
        externalMinutes: summary?.externalPlayedMinutes ?? 0,
        achievements: summary && summary.achievementsTotal > 0
          ? { unlocked: summary.achievementsUnlocked, total: summary.achievementsTotal }
          : null,
        covers: (summary?.recentGameCovers ?? []).filter((cover): cover is string => Boolean(cover)),
      };
    })
    .sort((left, right) => right.gameCount - left.gameCount || left.platform.name.localeCompare(right.platform.name, 'pt-BR'));
}

export function PlatformsView({ platforms, summaries, games, onGoToSettings }: PlatformsViewProps) {
  const rows = buildRows(platforms, summaries, games);

  return (
    <section className="platforms-page" aria-labelledby="platforms-title">
      <div className="view-heading">
        <div>
          <p className="eyebrow">SUAS PLATAFORMAS</p>
          <h1 id="platforms-title">Plataformas</h1>
          <p className="library-subtitle">Onde seus jogos estão: biblioteca, tempo e conquistas por plataforma.</p>
        </div>
        <Button type="button" onClick={onGoToSettings}>Gerenciar plataformas</Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Nenhuma plataforma ainda"
          description="Cadastre uma plataforma nas configurações para começar a agrupar seus jogos."
          action={<Button type="button" onClick={onGoToSettings}>Gerenciar plataformas</Button>}
        />
      ) : (
        <ul className="platforms-grid">
          {rows.map((row) => {
            const completionPct = row.gameCount > 0 ? Math.round((row.completedCount / row.gameCount) * 100) : null;
            const achievementPct = row.achievements ? Math.round((row.achievements.unlocked / row.achievements.total) * 100) : null;
            return (
              <li className="platform-card" key={row.platform.id}>
                <div className="platform-card-head">
                  <span className="platform-card-icon" aria-hidden="true"><PlatformIcon iconKey={row.platform.iconKey} /></span>
                  <div>
                    <p className="platform-card-name">{row.platform.name}</p>
                    <p className="platform-card-counts">
                      {integer.format(row.gameCount)} {row.gameCount === 1 ? 'jogo' : 'jogos'}
                      {row.completedCount > 0 && <> · {integer.format(row.completedCount)} zerado{row.completedCount !== 1 ? 's' : ''}</>}
                      {row.dominatedCount > 0 && <> · {integer.format(row.dominatedCount)} dominado{row.dominatedCount !== 1 ? 's' : ''}</>}
                    </p>
                  </div>
                </div>

                {row.covers.length > 0 && (
                  <div className="platform-card-covers" aria-hidden="true">
                    {row.covers.slice(0, 4).map((cover, index) => (
                      <img key={`${cover}-${index}`} src={cover} alt="" loading="lazy" decoding="async" />
                    ))}
                  </div>
                )}

                <dl className="platform-card-stats">
                  {row.localMinutes > 0 && (
                    <div><dt>Tempo registrado</dt><dd>{formatCompactHours(row.localMinutes / 60)}</dd></div>
                  )}
                  {row.externalMinutes > 0 && (
                    <div><dt>Tempo informado pela plataforma</dt><dd>{formatCompactHours(row.externalMinutes / 60)}</dd></div>
                  )}
                  {row.achievements && (
                    <div>
                      <dt>Conquistas</dt>
                      <dd>{integer.format(row.achievements.unlocked)} de {integer.format(row.achievements.total)}</dd>
                      {achievementPct !== null && (
                        <span className="platform-card-bar" title={`${achievementPct}% das conquistas`}>
                          <span className="platform-card-bar-fill" style={{ width: `${achievementPct}%` }} />
                        </span>
                      )}
                    </div>
                  )}
                </dl>

                {completionPct !== null && (
                  <div className="platform-card-progress">
                    <span className="platform-card-progress-label">Zerados {completionPct}%</span>
                    <span className="platform-card-progress-track" aria-hidden="true">
                      <span className="platform-card-progress-fill" style={{ width: `${completionPct}%` }} />
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
