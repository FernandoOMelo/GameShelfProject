import { useEffect, useState, type ReactNode } from 'react';
import type { PlatformSummary, StatsGroup, StatsResponse } from '@gameshelf/contracts';
import { BarList, ErrorState, LoadingState } from '@gameshelf/ui';
import { AchievementsChart } from './achievements-chart';
import { ActivityHeatmap } from './activity-heatmap';
import { PlatformLogo, platformStyle } from './platform-icons';
import { CheckIcon, ClockIcon, CrownIcon, GamesIcon, ProgressLine, TrophyIcon } from './platforms-view';
import { ReplayPanel } from './replay-panel';
import { apiUrl, difficultyLabels, formatCompactHours } from './shared';

const integer = new Intl.NumberFormat('pt-BR');
const VISIBLE_RANKS = 5;

/**
 * Estatísticas. Os números dos jogos zerados podem ser limitados a um ano; a
 * biblioteca, as jornadas e as plataformas sempre mostram tudo. Seções sem dado
 * não ocupam espaço: ficam juntas numa faixa no fim, com o que preenche cada uma.
 */
export function StatsView({ refreshKey, onOpenGame }: { refreshKey: unknown; onOpenGame: (gameId: string) => void }) {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [summaries, setSummaries] = useState<PlatformSummary[]>([]);
  const [failed, setFailed] = useState(false);
  const [period, setPeriod] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    setFailed(false);
    Promise.all([
      fetch(`${apiUrl}/stats${period === null ? '' : `?year=${period}`}`).then((r) => r.ok ? r.json() as Promise<StatsResponse> : Promise.reject()),
      fetch(`${apiUrl}/platforms/summaries`).then((r) => r.ok ? r.json() as Promise<PlatformSummary[]> : Promise.resolve([])),
    ]).then(([body, sums]) => {
      if (!active) return;
      if (body && typeof body === 'object' && 'totals' in body) { setStats(body); setSummaries(Array.isArray(sums) ? sums : []); }
      else setFailed(true);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [refreshKey, period]);

  if (failed) return <section className="stats-page"><ErrorState>Não foi possível carregar as estatísticas.</ErrorState></section>;
  if (!stats) return <section className="stats-page"><LoadingState>Carregando estatísticas…</LoadingState></section>;

  const { totals, library } = stats;
  // Escalas fixas (notas e dificuldades) chegam completas da API; mostrar só o que
  // o usuário realmente usou evita paredes de barras zeradas.
  const ratedEntries = stats.ratingDistribution.filter((entry) => entry.count > 0);
  const difficultyEntries = stats.difficultyDistribution.filter((entry) => entry.count > 0);
  const journey = totals.journeyStart ? `${integer.format(totals.journeyDays)} dias` : null;
  const journeyHint = totals.journeyStart ? `${(totals.journeyDays / 365.25).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} anos desde o primeiro registro` : undefined;
  const years = stats.byYear.map((entry) => entry.year);
  const hours = (value: number | null) => value === null ? null : formatCompactHours(value);
  const timeBars = library.externalPlaytimeByPlatform.filter((entry) => entry.hours > 0);

  // Seções vazias vão para a faixa do fim, cada uma com o que as preenche.
  const empty: Array<{ title: string; hint: string }> = [];
  const note = (condition: boolean, title: string, hint: string) => { if (!condition) empty.push({ title, hint }); return condition; };
  const hasRating = note(ratedEntries.length > 0, 'Pontuação', 'Dê nota aos jogos zerados.');
  const hasDifficulty = note(difficultyEntries.length > 0, 'Nível de dificuldade', 'Informe a dificuldade ao zerar um jogo.');
  const hasGenre = note(stats.byGenre.length > 0, 'Por gênero', 'Zere um jogo com gênero definido.');
  const hasType = note(stats.byType.length > 0, 'Por tipo', 'Informe o tipo do jogo na edição.');
  const hasDeveloper = note(stats.byDeveloper.length > 0, 'Top 10 desenvolvedoras', 'Zere um jogo com desenvolvedora.');
  const hasRelease = note(stats.byReleaseYear.length > 0, 'Por ano de lançamento', 'Informe o ano de lançamento dos jogos.');
  const hasFavorites = note(stats.favorites.length > 0, 'Top 10 jogos favoritos', 'Marque jogos como favoritos na edição do jogo.');
  const hasTopGenres = note(stats.topGenres.length > 0, 'Top 5 gêneros favoritos', 'Precisa de notas nos jogos zerados.');
  const hasTopTypes = note(stats.topTypes.length > 0, 'Top 10 tipos favoritos', 'Precisa de notas nos jogos zerados.');

  return <section className="stats-page" aria-labelledby="stats-title">
    <div className="stats-head">
      <div>
        <p className="eyebrow">SUA JORNADA</p><h1 id="stats-title">Estatísticas</h1>
        <p className="library-subtitle">{period === null
          ? 'Números dos jogos zerados. As horas de cada jogo contam no ano em que ele foi zerado.'
          : `Jogos zerados em ${period}. A biblioteca, as jornadas e as plataformas abaixo continuam mostrando tudo.`}</p>
      </div>
      {years.length > 0 && <div className="ach-filters" role="group" aria-label="Período dos jogos zerados">
        <button type="button" className={`ach-filter${period === null ? ' is-active' : ''}`} aria-pressed={period === null} onClick={() => setPeriod(null)}>Tudo</button>
        {years.map((year) => <button key={year} type="button" className={`ach-filter${period === year ? ' is-active' : ''}`} aria-pressed={period === year} onClick={() => setPeriod(year)}>{year}</button>)}
      </div>}
    </div>

    <div className="stats-hero-grid" aria-label="Totais">
      <Metric hero accent label="Jogos zerados" value={String(totals.completedCount)} hint={totals.completedCount === 0 ? 'Zere um jogo para ver' : undefined} />
      <Metric hero label="Horas em jogos zerados" value={formatCompactHours(totals.completedHours)} />
      <Metric hero label="Média por jogo zerado" value={hours(totals.averageCompletedHours)} emptyHint="Zere um jogo com horas" />
      <Metric hero accent label="Total consolidado" value={formatCompactHours(library.consolidatedPlayedHours)}
        info={`O total consolidado soma as horas registradas aqui com ${formatCompactHours(library.externalCountedHours)} de plataformas marcadas como fonte do total, descontando o que já foi lançado como horas retroativas. As demais horas informadas por plataformas ficam de fora para não contar a mesma atividade duas vezes.`} />
    </div>

    <h2 className="stats-section-title">Biblioteca</h2>
    <div className="stats-grid">
      <Metric label="Jogos cadastrados" value={String(library.gameCount)} />
      <Metric label="Associações de plataforma" value={String(library.platformLinkCount)} />
      <Metric label="Taxa de conclusão" value={`${totals.completionRate.toLocaleString('pt-BR')}%`} info="Ignora jogos desejados, que ainda não estão na biblioteca." />
      <Metric label="Tempo de jornada" value={journey} hint={journeyHint} emptyHint="Sem registros ainda" />
    </div>

    <h2 className="stats-section-title">Jornadas</h2>
    <div className="stats-grid">
      <Metric label="Jornadas iniciadas" value={String(library.playthroughsStarted)} />
      <Metric label="Jornadas concluídas" value={String(library.playthroughsCompleted)} />
      <Metric label="Replays iniciados" value={String(library.replaysStarted)} />
      <Metric label="Jogos com jornada zerada" value={String(library.gamesWithCompletedPlaythrough)} />
    </div>

    <h2 className="stats-section-title">Tempo</h2>
    <div className="stats-grid stats-grid-5">
      <Metric label="Horas registradas aqui" value={formatCompactHours(library.localPlayedHours)} />
      <Metric label="Horas informadas por plataformas" value={formatCompactHours(library.externalPlaytimeHours)} info="Medida separada do histórico de sessões: as duas não são somadas." />
      <Metric label="Média por jogo jogado" value={hours(totals.averageHoursPerGame)} info="Considera todo jogo com horas registradas, zerado ou não." emptyHint="Sem horas registradas" />
      <Metric label="Jogo mais longo" value={totals.longestGame?.title ?? null} hint={totals.longestGame ? formatCompactHours(totals.longestGame.hours) : undefined} emptyHint="Zere um jogo com horas" small />
      <Metric label="Jogo mais curto" value={totals.shortestGame?.title ?? null} hint={totals.shortestGame ? formatCompactHours(totals.shortestGame.hours) : undefined} emptyHint="Zere um jogo com horas" small />
    </div>

    {timeBars.length > 0 && <section className="panel" aria-labelledby="platform-time-title">
      <h2 id="platform-time-title">Tempo informado por plataforma</h2>
      <p className="library-subtitle">Medida separada do histórico de sessões: as duas não são somadas.</p>
      <ul className="platform-time-bars" aria-label="Horas informadas por plataforma">
        {(() => {
          const max = Math.max(...timeBars.map((entry) => entry.hours));
          return timeBars.map((entry) => {
            const platform = summaries.find((item) => item.platform.id === entry.key || item.platform.name === entry.name)?.platform;
            return <li key={entry.key} style={platformStyle(platform ?? {})}>
              <PlatformLogo platform={platform ?? {}} size={24} />
              <span className="platform-time-name">{entry.name}</span>
              <span className="platform-time-track"><span className="platform-time-fill" style={{ width: `${(entry.hours / max) * 100}%` }} /></span>
              <strong>{formatCompactHours(entry.hours)}</strong>
            </li>;
          });
        })()}
      </ul>
    </section>}

    {summaries.some((item) => item.gameCount > 0) && <section className="panel" aria-labelledby="platform-summary-title">
      <h2 id="platform-summary-title">Plataformas</h2>
      <p className="library-subtitle">Toda a biblioteca, não só os jogos zerados.</p>
      <ul className="platform-summary-grid">
        {summaries.filter((item) => item.gameCount > 0).map((item) => <PlatformSummaryCard key={item.platform.id} summary={item} />)}
      </ul>
    </section>}

    <ReplayPanel refreshKey={refreshKey} onOpenGame={onOpenGame} {...(years[0] === undefined ? {} : { suggestedYear: years[0] })} />
    <AchievementsChart refreshKey={refreshKey} />
    <ActivityHeatmap refreshKey={refreshKey} />

    <section className="panel" aria-labelledby="timeline-title"><h2 id="timeline-title">Linha do tempo anual</h2>
      {stats.byYear.length ? <ol className="year-timeline">{stats.byYear.map((entry) => <li key={entry.year}>
        <strong className="year-label">{entry.year}</strong>
        <span>{entry.completedCount} {entry.completedCount === 1 ? 'zerado' : 'zerados'}</span>
        <span>{formatCompactHours(entry.hours)}</span>
        {entry.gameOfYear ? <button type="button" className="goty" onClick={() => onOpenGame(entry.gameOfYear!.id)}>{entry.gameOfYear.coverUrl ? <img src={entry.gameOfYear.coverUrl} alt="" /> : <span aria-hidden="true">★</span>}<span><small>Jogo do ano</small>{entry.gameOfYear.title}</span></button> : <span className="goty-empty">Sem jogo do ano</span>}
      </li>)}</ol> : <p className="dashboard-empty">Nenhum jogo zerado com data de conclusão.</p>}
    </section>

    {(hasRating || hasDifficulty) && <div className="stats-pair">
      {hasRating && <section className="panel" aria-labelledby="rating-title"><h2 id="rating-title">Pontuação</h2>
        <BarList label="Jogos por nota" entries={ratedEntries.map((entry) => ({ key: entry.rating, label: entry.rating === 11 ? '11 · Jogo da vida' : entry.rating, value: entry.count, title: `Nota ${entry.rating}: ${entry.count}` }))} />
      </section>}
      {hasDifficulty && <section className="panel" aria-labelledby="difficulty-title"><h2 id="difficulty-title">Nível de dificuldade</h2>
        <BarList label="Jogos zerados por dificuldade" entries={difficultyEntries.map((entry) => ({ key: entry.difficulty, label: difficultyLabels[entry.difficulty], value: entry.count, title: `${difficultyLabels[entry.difficulty]}: ${entry.count}` }))} />
      </section>}
    </div>}

    {(hasGenre || hasType) && <div className="stats-pair">
      {hasGenre && <RankBars title="Por gênero" groups={stats.byGenre} />}
      {hasType && <RankBars title="Por tipo" groups={stats.byType} />}
    </div>}

    {(hasDeveloper || hasRelease) && <div className="stats-pair">
      {hasDeveloper && <RankBars title="Top 10 desenvolvedoras" groups={stats.byDeveloper} />}
      {hasRelease && <section className="panel" aria-labelledby="release-year-title"><h2 id="release-year-title">Por ano de lançamento</h2>
        <ColumnChart entries={stats.byReleaseYear.map((entry) => ({ label: String(entry.year), value: entry.count }))} />
      </section>}
    </div>}

    {hasFavorites && <section className="panel" aria-labelledby="favorites-title"><h2 id="favorites-title">Top 10 jogos favoritos</h2>
      <ol className="favorite-shelf">{stats.favorites.map((game) => <li key={game.id}>
        <button type="button" onClick={() => onOpenGame(game.id)}>
          {game.coverUrl ? <img src={game.coverUrl} alt="" loading="lazy" /> : <span className="favorite-cover-empty" aria-hidden="true">★</span>}
          <span className="favorite-title">{game.title}</span>
          {game.rating !== null && <span className="favorite-rating">{game.rating}</span>}
        </button>
      </li>)}</ol>
    </section>}

    {(hasTopGenres || hasTopTypes) && <div className="stats-pair">
      {hasTopGenres && <section className="panel" aria-labelledby="top-genres-title"><h2 id="top-genres-title">Top 5 gêneros favoritos</h2><RankList groups={stats.topGenres} /></section>}
      {hasTopTypes && <section className="panel" aria-labelledby="top-types-title"><h2 id="top-types-title">Top 10 tipos favoritos</h2><RankList groups={stats.topTypes} /></section>}
    </div>}
    {(hasTopGenres || hasTopTypes) && <small className="stats-note">Rankings de gênero e tipo usam a média das notas dos jogos zerados.</small>}

    {empty.length > 0 && <section className="panel stats-empty-strip" aria-labelledby="stats-empty-title">
      <h2 id="stats-empty-title">Ainda sem dados</h2>
      <ul>{empty.map((item) => <li key={item.title}><strong>{item.title}</strong><span>{item.hint}</span></li>)}</ul>
    </section>}
  </section>;
}

/** Número com rótulo; valor ausente vira um traço discreto com a dica do que preenche. */
function Metric({ label, value, hint, info, emptyHint, hero, accent, small }: {
  label: string; value: string | null; hint?: string | undefined; info?: string | undefined; emptyHint?: string | undefined; hero?: boolean; accent?: boolean; small?: boolean;
}) {
  return <div className={`metric${hero ? ' metric-hero' : ''}${accent ? ' metric-accent' : ''}${small ? ' metric-small' : ''}`}>
    <span className="metric-label">{label}{info && <span className="metric-info" title={info} aria-label={info} role="img" tabIndex={0}>ⓘ</span>}</span>
    {value === null
      ? <><strong className="metric-empty" aria-label="Sem dado">—</strong>{emptyHint && <small>{emptyHint}</small>}</>
      : <><strong>{value}</strong>{hint && <small>{hint}</small>}</>}
  </div>;
}

function PlatformSummaryCard({ summary: s }: { summary: PlatformSummary }) {
  const minutes = s.localPlayedMinutes + s.externalPlayedMinutes;
  const completionPct = s.gameCount > 0 ? Math.round((s.completedCount / s.gameCount) * 100) : 0;
  const achievementPct = s.achievementsTotal > 0 ? Math.round((s.achievementsUnlocked / s.achievementsTotal) * 100) : null;
  return <li className="platform-card platform-summary-card" style={platformStyle(s.platform)}>
    <div className="platform-card-head">
      <PlatformLogo platform={s.platform} size={36} />
      <div className="platform-card-title">
        <p className="platform-card-name">{s.platform.name}</p>
        <p className="platform-card-stats-row">
          <span title="Jogos"><GamesIcon />{integer.format(s.gameCount)}</span>
          {minutes >= 6 && <span title="Tempo de jogo"><ClockIcon />{formatCompactHours(minutes / 60)}</span>}
          {s.achievementsTotal > 0 && <span title="Conquistas desbloqueadas"><TrophyIcon />{integer.format(s.achievementsUnlocked)}</span>}
          <span title="Jogos dominados"><CrownIcon />{integer.format(s.dominatedCount)}</span>
          <span title="Jogos zerados"><CheckIcon />{integer.format(s.completedCount)}</span>
        </p>
      </div>
      {s.recentGameCovers.some(Boolean) && <div className="platform-card-covers" aria-hidden="true">
        {s.recentGameCovers.filter(Boolean).slice(0, 3).map((cover, i) => cover ? <img key={i} src={cover} alt="" loading="lazy" /> : null)}
      </div>}
    </div>
    <div className="platform-card-progress">
      <ProgressLine label={`Zerados ${completionPct}%`} pct={completionPct} />
      {achievementPct !== null && <ProgressLine label={`Conquistas ${integer.format(s.achievementsUnlocked)} de ${integer.format(s.achievementsTotal)}`} pct={achievementPct} />}
    </div>
  </li>;
}

/** Barras ordenadas com participação percentual; as cinco maiores, e o resto sob "Ver mais". */
function RankBars({ title, groups }: { title: string; groups: StatsGroup[] }) {
  const [expanded, setExpanded] = useState(false);
  const total = groups.reduce((sum, group) => sum + group.completedCount, 0);
  const max = Math.max(1, ...groups.map((group) => group.completedCount));
  const shown = expanded ? groups : groups.slice(0, VISIBLE_RANKS);
  return <section className="panel"><h2>{title}</h2>
    <ul className="rank-bars" aria-label={title}>
      {shown.map((group) => <li key={group.key} title={`${formatCompactHours(group.hours)}${group.averageRating === null ? '' : ` · nota média ${group.averageRating.toLocaleString('pt-BR')}`}`}>
        <span className="rank-bars-name">{group.name}</span>
        <span className="rank-bars-track"><span className="rank-bars-fill" style={{ width: `${(group.completedCount / max) * 100}%` }} /></span>
        <strong>{group.completedCount}<small> · {total > 0 ? Math.round((group.completedCount / total) * 100) : 0}%</small></strong>
      </li>)}
    </ul>
    {groups.length > VISIBLE_RANKS && <button type="button" className="session-edit rank-bars-more" aria-expanded={expanded} onClick={() => setExpanded((open) => !open)}>{expanded ? 'Ver menos' : `Ver mais (${groups.length - VISIBLE_RANKS})`}</button>}
  </section>;
}

function ColumnChart({ entries }: { entries: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...entries.map((entry) => entry.value));
  return <ul className="column-chart" aria-label="Jogos por ano de lançamento">
    {entries.map((entry) => <li key={entry.label} title={`${entry.label}: ${entry.value}`}>
      <strong>{entry.value}</strong>
      <span className="column-chart-bar" style={{ height: `${Math.max(6, (entry.value / max) * 100)}%` }} />
      <span className="column-chart-label">{entry.label}</span>
    </li>)}
  </ul>;
}

function RankList({ groups }: { groups: StatsGroup[] }): ReactNode {
  return <ol className="rank-list">{groups.map((group) => <li key={group.key}><span>{group.name}</span><span>{group.averageRating?.toLocaleString('pt-BR')}</span></li>)}</ol>;
}
