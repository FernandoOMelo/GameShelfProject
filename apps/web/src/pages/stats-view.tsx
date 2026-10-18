import { useEffect, useState } from 'react';
import type { StatsGroup, StatsResponse } from '@gameshelf/contracts';
import { BarList, ErrorState, LoadingState, StatCard } from '@gameshelf/ui';
import { ActivityHeatmap } from './activity-heatmap';
import { ReplayPanel } from './replay-panel';
import { apiUrl,difficultyLabels, formatCompactHours } from './shared';

export function StatsView({ refreshKey, onOpenGame }: { refreshKey: unknown; onOpenGame: (gameId: string) => void }) {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    void fetch(`${apiUrl}/stats`).then(async (response) => {
      const body = response.ok ? await response.json() as StatsResponse : null;
      if (!active) return;
      if (body && typeof body === 'object' && 'totals' in body) setStats(body); else setFailed(true);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [refreshKey]);

  if (failed) return <section className="stats-page"><ErrorState>Não foi possível carregar as estatísticas.</ErrorState></section>;
  if (!stats) return <section className="stats-page"><LoadingState>Carregando estatísticas…</LoadingState></section>;

  const { totals, library } = stats;
  // Escalas fixas (notas e dificuldades) chegam completas da API; mostrar só o que
  // o usuário realmente usou evita paredes de barras zeradas.
  const ratedEntries = stats.ratingDistribution.filter((entry) => entry.count > 0);
  const difficultyEntries = stats.difficultyDistribution.filter((entry) => entry.count > 0);
  const journey = totals.journeyStart ? `${new Intl.NumberFormat('pt-BR').format(totals.journeyDays)} dias (${(totals.journeyDays / 365.25).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} anos)` : '—';

  return <section className="stats-page" aria-labelledby="stats-title">
    <p className="eyebrow">SUA JORNADA</p><h1 id="stats-title">Estatísticas</h1>
    <p className="library-subtitle">Números dos jogos zerados. As horas de cada jogo contam no ano em que ele foi zerado.</p>

    <div className="kpi-grid" aria-label="Totais">
      <StatCard label="Jogos zerados" value={String(totals.completedCount)} accent />
      <StatCard label="Horas em jogos zerados" value={formatCompactHours(totals.completedHours)} />
      <StatCard label="Média por jogo zerado" value={totals.averageCompletedHours === null ? '—' : formatCompactHours(totals.averageCompletedHours)} />
      <StatCard label="Tempo de jornada" value={journey} small />
    </div>
    {/* Biblioteca: um jogo em três plataformas continua sendo um jogo. Tempo
        local e tempo informado pelas plataformas ficam separados, nunca somados. */}
    <div className="kpi-grid kpi-grid-secondary" aria-label="Biblioteca, plataformas e jornadas">
      <StatCard label="Jogos cadastrados" value={String(library.gameCount)} />
      <StatCard label="Associações de plataforma" value={String(library.platformLinkCount)} />
      <StatCard label="Jornadas iniciadas" value={String(library.playthroughsStarted)} />
      <StatCard label="Jornadas concluídas" value={String(library.playthroughsCompleted)} />
      <StatCard label="Replays iniciados" value={String(library.replaysStarted)} />
      <StatCard label="Jogos com jornada zerada" value={String(library.gamesWithCompletedPlaythrough)} />
      <StatCard label="Horas registradas aqui" value={formatCompactHours(library.localPlayedHours)} />
      <StatCard label="Horas informadas por plataformas" value={formatCompactHours(library.externalPlaytimeHours)} small />
    </div>
    {library.externalPlaytimeByPlatform.length > 0 && <section className="panel">
      <div className="section-heading"><h2>Tempo informado por plataforma</h2></div>
      <p className="library-subtitle">Medida separada do histórico de sessões: as duas não são somadas.</p>
      <BarList label="Horas informadas por plataforma" entries={library.externalPlaytimeByPlatform.map((entry) => ({ key: entry.key, label: entry.name, value: entry.hours, title: formatCompactHours(entry.hours) }))} />
    </section>}

    <div className="kpi-grid kpi-grid-secondary">
      <StatCard label="Taxa de conclusão" value={`${totals.completionRate.toLocaleString('pt-BR')}%`} />
      <StatCard label="Média por jogo jogado" value={totals.averageHoursPerGame === null ? '—' : formatCompactHours(totals.averageHoursPerGame)} />
      <StatCard label="Jogo mais longo" value={totals.longestGame?.title ?? '—'} detail={totals.longestGame ? formatCompactHours(totals.longestGame.hours) : undefined} small />
      <StatCard label="Jogo mais curto" value={totals.shortestGame?.title ?? '—'} detail={totals.shortestGame ? formatCompactHours(totals.shortestGame.hours) : undefined} small />
    </div>
    <small className="stats-note">A taxa de conclusão ignora jogos desejados, que ainda não estão na biblioteca. A média por jogo jogado considera todo jogo com horas registradas, zerado ou não.</small>

    <ReplayPanel refreshKey={refreshKey} onOpenGame={onOpenGame} />
    <ActivityHeatmap refreshKey={refreshKey} />

    <section className="panel" aria-labelledby="timeline-title"><h2 id="timeline-title">Linha do tempo anual</h2>
      {stats.byYear.length ? <ol className="year-timeline">{stats.byYear.map((entry) => <li key={entry.year}>
        <strong className="year-label">{entry.year}</strong>
        <span>{entry.completedCount} {entry.completedCount === 1 ? 'zerado' : 'zerados'}</span>
        <span>{formatCompactHours(entry.hours)}</span>
        {entry.gameOfYear ? <button type="button" className="goty" onClick={() => onOpenGame(entry.gameOfYear!.id)}>{entry.gameOfYear.coverUrl ? <img src={entry.gameOfYear.coverUrl} alt="" /> : <span aria-hidden="true">★</span>}<span><small>Jogo do ano</small>{entry.gameOfYear.title}</span></button> : <span className="goty-empty">Sem jogo do ano</span>}
      </li>)}</ol> : <p className="dashboard-empty">Nenhum jogo zerado com data de conclusão.</p>}
    </section>

    <div className="dashboard-columns">
      <section className="panel" aria-labelledby="rating-title"><h2 id="rating-title">Pontuação</h2>
        <BarList label="Jogos por nota" empty={<p className="dashboard-empty">Nenhum jogo zerado com nota registrada.</p>} entries={ratedEntries.map((entry) => ({ key: entry.rating, label: entry.rating === 11 ? '11 · Jogo da vida' : entry.rating, value: entry.count, title: `Nota ${entry.rating}: ${entry.count}` }))} />
      </section>
      <section className="panel" aria-labelledby="difficulty-title"><h2 id="difficulty-title">Nível de dificuldade</h2>
        <BarList label="Jogos zerados por dificuldade" empty={<p className="dashboard-empty">Nenhum jogo zerado com dificuldade informada.</p>} entries={difficultyEntries.map((entry) => ({ key: entry.difficulty, label: difficultyLabels[entry.difficulty], value: entry.count, title: `${difficultyLabels[entry.difficulty]}: ${entry.count}` }))} />
      </section>
    </div>

    <div className="dashboard-columns">
      <GroupTable title="Por gênero" groups={stats.byGenre} />
      <GroupTable title="Por plataforma" groups={stats.byPlatform} />
    </div>
    <GroupTable title="Por tipo" groups={stats.byType} />

    <div className="dashboard-columns">
      <GroupTable title="Top 10 desenvolvedoras" groups={stats.byDeveloper} />
      <section className="panel" aria-labelledby="release-year-title"><h2 id="release-year-title">Por ano de lançamento</h2>
        <BarList label="Jogos por ano de lançamento" empty={<p className="dashboard-empty">Nenhum jogo com ano de lançamento informado.</p>} entries={stats.byReleaseYear.map((entry) => ({ key: entry.year, label: entry.year, value: entry.count, title: `${entry.year}: ${entry.count}` }))} />
      </section>
    </div>

    <div className="dashboard-columns">
      <section className="panel" aria-labelledby="favorites-title"><h2 id="favorites-title">Top 10 jogos favoritos</h2>
        {stats.favorites.length ? <ol className="rank-list">{stats.favorites.map((game) => <li key={game.id}><button type="button" onClick={() => onOpenGame(game.id)}>{game.title}</button>{game.rating !== null && <span>{game.rating}</span>}</li>)}</ol> : <p className="dashboard-empty">Marque jogos como favoritos na edição do jogo.</p>}
      </section>
      <div className="stats-stack">
        <section className="panel" aria-labelledby="top-genres-title"><h2 id="top-genres-title">Top 5 gêneros favoritos</h2><RankList groups={stats.topGenres} /></section>
        <section className="panel" aria-labelledby="top-types-title"><h2 id="top-types-title">Top 10 tipos favoritos</h2><RankList groups={stats.topTypes} /></section>
      </div>
    </div>
    <small className="stats-note">Rankings de gênero e tipo usam a média das notas dos jogos zerados.</small>
  </section>;
}

function GroupTable({ title, groups }: { title: string; groups: StatsGroup[] }) {
  return <section className="panel"><h2>{title}</h2>
    {groups.length ? <table className="stats-table"><thead><tr><th scope="col">Nome</th><th scope="col">Zerados</th><th scope="col">Tempo</th><th scope="col">Nota média</th></tr></thead><tbody>{groups.map((group) => <tr key={group.key}><th scope="row">{group.name}</th><td>{group.completedCount}</td><td>{formatCompactHours(group.hours)}</td><td>{group.averageRating === null ? '—' : group.averageRating.toLocaleString('pt-BR')}</td></tr>)}</tbody></table> : <p className="dashboard-empty">Sem dados ainda.</p>}
  </section>;
}

function RankList({ groups }: { groups: StatsGroup[] }) {
  return groups.length ? <ol className="rank-list">{groups.map((group) => <li key={group.key}><span>{group.name}</span><span>{group.averageRating?.toLocaleString('pt-BR')}</span></li>)}</ol> : <p className="dashboard-empty">Sem notas suficientes.</p>;
}
