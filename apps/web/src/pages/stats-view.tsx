import { useEffect, useState } from 'react';
import type { StatsGroup, StatsResponse } from '@gameshelf/contracts';
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

  if (failed) return <section className="stats-page"><p className="notice" role="alert">Não foi possível carregar as estatísticas.</p></section>;
  if (!stats) return <section className="stats-page"><p role="status">Carregando estatísticas…</p></section>;

  const { totals } = stats;
  const maxRating = Math.max(1, ...stats.ratingDistribution.map((entry) => entry.count));
  const maxDifficulty = Math.max(1, ...stats.difficultyDistribution.map((entry) => entry.count));
  const journey = totals.journeyStart ? `${new Intl.NumberFormat('pt-BR').format(totals.journeyDays)} dias (${(totals.journeyDays / 365.25).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} anos)` : '—';

  return <section className="stats-page" aria-labelledby="stats-title">
    <p className="eyebrow">SUA JORNADA</p><h1 id="stats-title">Estatísticas</h1>
    <p className="library-subtitle">Números dos jogos zerados. As horas de cada jogo contam no ano em que ele foi zerado.</p>

    <div className="kpi-grid" aria-label="Totais">
      <Tile label="Jogos zerados" value={String(totals.completedCount)} accent />
      <Tile label="Horas em jogos zerados" value={formatCompactHours(totals.completedHours)} />
      <Tile label="Média por jogo zerado" value={totals.averageCompletedHours === null ? '—' : formatCompactHours(totals.averageCompletedHours)} />
      <Tile label="Tempo de jornada" value={journey} small />
    </div>
    <div className="kpi-grid kpi-grid-secondary">
      <Tile label="Jogo mais longo" value={totals.longestGame?.title ?? '—'} detail={totals.longestGame ? formatCompactHours(totals.longestGame.hours) : undefined} small />
      <Tile label="Jogo mais curto" value={totals.shortestGame?.title ?? '—'} detail={totals.shortestGame ? formatCompactHours(totals.shortestGame.hours) : undefined} small />
    </div>

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
        <ul className="hbar-list" aria-label="Jogos por nota">{stats.ratingDistribution.map((entry) => <li key={entry.rating} title={`Nota ${entry.rating}: ${entry.count}`}><span className="hbar-label">{entry.rating === 11 ? '11 · Jogo da vida' : entry.rating}</span><span className="hbar-track"><span className="hbar-fill" style={{ width: `${(entry.count / maxRating) * 100}%` }} /></span><strong>{entry.count}</strong></li>)}</ul>
      </section>
      <section className="panel" aria-labelledby="difficulty-title"><h2 id="difficulty-title">Nível de dificuldade</h2>
        <ul className="hbar-list" aria-label="Jogos zerados por dificuldade">{stats.difficultyDistribution.map((entry) => <li key={entry.difficulty} title={`${difficultyLabels[entry.difficulty]}: ${entry.count}`}><span className="hbar-label">{difficultyLabels[entry.difficulty]}</span><span className="hbar-track"><span className="hbar-fill" style={{ width: `${(entry.count / maxDifficulty) * 100}%` }} /></span><strong>{entry.count}</strong></li>)}</ul>
      </section>
    </div>

    <div className="dashboard-columns">
      <GroupTable title="Por gênero" groups={stats.byGenre} />
      <GroupTable title="Por plataforma" groups={stats.byPlatform} />
    </div>
    <GroupTable title="Por tipo" groups={stats.byType} />

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

function Tile({ label, value, detail, accent = false, small = false }: { label: string; value: string; detail?: string; accent?: boolean; small?: boolean }) {
  return <article className={`stat-card${accent ? ' stat-card-accent' : ''}${small ? ' stat-card-small' : ''}`}><span>{label}</span><strong>{value}</strong>{detail && <em>{detail}</em>}</article>;
}

function GroupTable({ title, groups }: { title: string; groups: StatsGroup[] }) {
  return <section className="panel"><h2>{title}</h2>
    {groups.length ? <table className="stats-table"><thead><tr><th scope="col">Nome</th><th scope="col">Zerados</th><th scope="col">Tempo</th><th scope="col">Nota média</th></tr></thead><tbody>{groups.map((group) => <tr key={group.key}><th scope="row">{group.name}</th><td>{group.completedCount}</td><td>{formatCompactHours(group.hours)}</td><td>{group.averageRating === null ? '—' : group.averageRating.toLocaleString('pt-BR')}</td></tr>)}</tbody></table> : <p className="dashboard-empty">Sem dados ainda.</p>}
  </section>;
}

function RankList({ groups }: { groups: StatsGroup[] }) {
  return groups.length ? <ol className="rank-list">{groups.map((group) => <li key={group.key}><span>{group.name}</span><span>{group.averageRating?.toLocaleString('pt-BR')}</span></li>)}</ol> : <p className="dashboard-empty">Sem notas suficientes.</p>;
}
