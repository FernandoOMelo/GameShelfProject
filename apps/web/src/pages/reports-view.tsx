import { useEffect, useState, type ReactNode } from 'react';
import type { BacklogReport, CompletionsReport, Genre, Platform, PlaythroughsReport, PlaytimeReport } from '@gameshelf/contracts';
import { EmptyState, ErrorState, LoadingState, Panel, StatCard } from '@gameshelf/ui';
import { apiUrl, formatHoursMinutes } from './shared';

type Category = 'playtime' | 'completions' | 'playthroughs' | 'backlog';
type Range = { from: string; to: string };
type Reference = CompletionsReport['estimates']['reference'];
type Sort = 'DIFFERENCE_DESC' | 'DIFFERENCE_ASC' | 'PLAYED_DESC' | 'TITLE';

const PAGE_SIZE = 15;
const categories: Array<{ key: Category; title: string; description: string }> = [
  { key: 'playtime', title: 'Tempo de jogo', description: 'Sessões, horas, períodos e plataformas.' },
  { key: 'completions', title: 'Conclusões', description: 'Jogos zerados, estimativas e abandonos.' },
  { key: 'playthroughs', title: 'Jornadas e replays', description: 'Rejogabilidade e evolução por jornada.' },
  { key: 'backlog', title: 'Biblioteca e backlog', description: 'Acervo, envelhecimento e pendências.' },
];
const weekdayNames = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const lengthLabels: Record<PlaytimeReport['sessionLengths'][number]['key'], string> = {
  UP_TO_30: 'Até 30 min', UP_TO_60: '30 min a 1 h', UP_TO_120: '1 h a 2 h', UP_TO_240: '2 h a 4 h', OVER_240: 'Mais de 4 h',
};
const referenceLabels: Record<Reference, string> = { MAIN: 'História principal', COMPLETIONIST: '100%', PERSONAL: 'Pessoal' };
const monthFormat = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' });

const minutesLabel = (minutes: number) => formatHoursMinutes(minutes / 60);
const monthLabel = (month: string) => monthFormat.format(new Date(`${month}-01T00:00:00Z`));
const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

function quickRanges(): Array<{ label: string; range: Range }> {
  const today = new Date();
  const year = today.getFullYear();
  const yearAgo = new Date(today); yearAgo.setFullYear(year - 1);
  return [
    { label: 'Todo o histórico', range: { from: '', to: '' } },
    { label: `${year}`, range: { from: `${year}-01-01`, to: `${year}-12-31` } },
    { label: `${year - 1}`, range: { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` } },
    { label: 'Últimos 12 meses', range: { from: isoDay(yearAgo), to: isoDay(today) } },
  ];
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : '';
}

async function load<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`);
  if (!response.ok) throw new Error(String(response.status));
  return await response.json() as T;
}

/**
 * Central de relatórios (ADR-041). Cada categoria consulta a própria rota da API,
 * que filtra e agrega; aqui só se escolhe a categoria, o período e se mostra o resultado.
 */
export function ReportsView({ onOpenGame }: { onOpenGame: (gameId: string) => void }) {
  const [category, setCategory] = useState<Category | null>(null);
  const [range, setRange] = useState<Range>({ from: '', to: '' });

  return <section className="stats-page reports-page">
    <div className="stats-head">
      <h1>Relatórios</h1>
      <div className="ach-filters" role="group" aria-label="Período">
        {quickRanges().map(({ label, range: option }) => <button key={label} type="button" className={`ach-filter${option.from === range.from && option.to === range.to ? ' is-active' : ''}`} onClick={() => setRange(option)}>{label}</button>)}
      </div>
    </div>
    <div className="report-range">
      <label>De <input type="date" value={range.from} max={range.to || undefined} onChange={(event) => setRange({ ...range, from: event.target.value })} /></label>
      <label>Até <input type="date" value={range.to} min={range.from || undefined} onChange={(event) => setRange({ ...range, to: event.target.value })} /></label>
    </div>

    <ul className="report-categories" aria-label="Categorias de relatório">
      {categories.map((item) => <li key={item.key}>
        <button type="button" className="report-category" aria-pressed={category === item.key} onClick={() => setCategory(item.key)}>
          <strong>{item.title}</strong><span>{item.description}</span>
        </button>
      </li>)}
    </ul>

    {category === null && <EmptyState title="Escolha um relatório" description="Selecione uma categoria para explorar os dados com filtros e detalhes." />}
    {category === 'playtime' && <PlaytimeReportView range={range} onOpenGame={onOpenGame} />}
    {category === 'completions' && <CompletionsReportView range={range} onOpenGame={onOpenGame} />}
    {category === 'backlog' && <BacklogReportView onOpenGame={onOpenGame} />}
    {category === 'playthroughs' && <PlaythroughsReportView range={range} onOpenGame={onOpenGame} />}
  </section>;
}

function useReport<T>(path: string): { data: T | null; failed: boolean } {
  const [state, setState] = useState<{ path: string; data: T | null; failed: boolean }>({ path: '', data: null, failed: false });
  useEffect(() => {
    let active = true;
    load<T>(path).then((data) => { if (active) setState({ path, data, failed: false }); })
      .catch(() => { if (active) setState({ path, data: null, failed: true }); });
    return () => { active = false; };
  }, [path]);
  // Resposta de um filtro anterior não deve passar por resultado do atual.
  return state.path === path ? state : { data: null, failed: false };
}

function Bars({ label, entries }: { label: string; entries: Array<{ key: string | number; label: ReactNode; value: number; display: string; onOpen?: () => void }> }) {
  const max = Math.max(1, ...entries.map((entry) => entry.value));
  return <ul className="hbar-list" aria-label={label}>
    {entries.map((entry) => <li key={entry.key}>
      <span className="hbar-label">{entry.onOpen ? <button type="button" className="link-button" onClick={entry.onOpen}>{entry.label}</button> : entry.label}</span>
      <span className="hbar-track"><span className="hbar-fill" style={{ width: `${(entry.value / max) * 100}%` }} /></span>
      <strong>{entry.display}</strong>
    </li>)}
  </ul>;
}

function PlaytimeReportView({ range, onOpenGame }: { range: Range; onOpenGame: (gameId: string) => void }) {
  const [platformId, setPlatformId] = useState('');
  const [genreId, setGenreId] = useState('');
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  useEffect(() => {
    void load<Platform[]>('/platforms').then(setPlatforms).catch(() => setPlatforms([]));
    void load<Genre[]>('/genres').then(setGenres).catch(() => setGenres([]));
  }, []);

  const { data, failed } = useReport<PlaytimeReport>(`/reports/playtime${query({ from: range.from, to: range.to, platformId, genreId, timezoneOffsetMinutes: new Date().getTimezoneOffset() })}`);

  return <div className="report-body">
    <div className="report-filters">
      <label>Plataforma <select value={platformId} onChange={(event) => setPlatformId(event.target.value)}>
        <option value="">Todas</option>{platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}
      </select></label>
      <label>Gênero <select value={genreId} onChange={(event) => setGenreId(event.target.value)}>
        <option value="">Todos</option>{genres.map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}
      </select></label>
    </div>
    {failed && <ErrorState>Não foi possível carregar o relatório de tempo de jogo.</ErrorState>}
    {!failed && !data && <LoadingState>Carregando relatório…</LoadingState>}
    {data && (data.sessionCount === 0
      ? <EmptyState title="Nenhuma sessão encontrada" description="Ajuste o período ou os filtros, ou registre sessões de jogo." />
      : <PlaytimeBody report={data} onOpenGame={onOpenGame} />)}
  </div>;
}

function PlaytimeBody({ report, onOpenGame }: { report: PlaytimeReport; onOpenGame: (gameId: string) => void }) {
  const { highlights } = report;
  const rank = (entries: PlaytimeReport['byPlatform']) => entries.map((entry) => ({ key: entry.id ?? entry.name, label: entry.name, value: entry.minutes, display: `${minutesLabel(entry.minutes)} · ${entry.share.toLocaleString('pt-BR')}%` }));
  const peak = highlights.peakHour;
  return <>
    <div className="stats-grid">
      <StatCard label="Total de horas" value={minutesLabel(report.totalMinutes)} detail={`${report.sessionCount} sessões em ${report.activeDays} dias`} accent />
      <StatCard label="Média por sessão" value={minutesLabel(report.averageSessionMinutes)} />
      <StatCard label="Média mensal" value={minutesLabel(highlights.averageMonthlyMinutes)} detail="Considera os meses com sessões" />
      <StatCard label="Mês mais ativo" value={highlights.busiestMonth ? monthLabel(highlights.busiestMonth) : '—'} small />
      <StatCard label="Dia da semana mais ativo" value={highlights.busiestWeekday === null ? '—' : weekdayNames[highlights.busiestWeekday]!} small />
      <StatCard label="Horário mais frequente" value={peak === null ? '—' : `${peak}h–${(peak + 1) % 24}h`} detail="Hora de início da sessão" small />
    </div>
    <div className="stats-pair">
      <Panel title="Horas por mês"><Bars label="Horas por mês" entries={report.byMonth.map((entry) => ({ key: entry.month, label: monthLabel(entry.month), value: entry.minutes, display: minutesLabel(entry.minutes) }))} /></Panel>
      <Panel title="Horas por ano"><Bars label="Horas por ano" entries={report.byYear.map((entry) => ({ key: entry.year, label: String(entry.year), value: entry.minutes, display: minutesLabel(entry.minutes) }))} /></Panel>
      <Panel title="Dia da semana"><Bars label="Horas por dia da semana" entries={report.byWeekday.map((entry) => ({ key: entry.weekday, label: weekdayNames[entry.weekday]!, value: entry.minutes, display: minutesLabel(entry.minutes) }))} /></Panel>
      <Panel title="Duração das sessões"><Bars label="Sessões por duração" entries={report.sessionLengths.map((entry) => ({ key: entry.key, label: lengthLabels[entry.key], value: entry.sessions, display: String(entry.sessions) }))} /></Panel>
      <Panel title="Por plataforma"><Bars label="Horas por plataforma" entries={rank(report.byPlatform)} /></Panel>
      <Panel title="Por gênero"><Bars label="Horas por gênero" entries={rank(report.byGenre)} /><small className="stats-note">Um jogo com vários gêneros conta em cada um.</small></Panel>
      <Panel title="Por desenvolvedora"><Bars label="Horas por desenvolvedora" entries={rank(report.byDeveloper)} /></Panel>
      <Panel title="Jogos que mais consumiram tempo"><Bars label="Horas por jogo" entries={report.topGames.map((entry) => ({ key: entry.id ?? entry.name, label: entry.name, value: entry.minutes, display: `${minutesLabel(entry.minutes)} · ${entry.share.toLocaleString('pt-BR')}%`, ...(entry.id ? { onOpen: () => onOpenGame(entry.id!) } : {}) }))} /></Panel>
    </div>
  </>;
}

function CompletionsReportView({ range, onOpenGame }: { range: Range; onOpenGame: (gameId: string) => void }) {
  const [reference, setReference] = useState<Reference>('MAIN');
  const [sort, setSort] = useState<Sort>('DIFFERENCE_DESC');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [range.from, range.to, reference, sort]);

  const { data, failed } = useReport<CompletionsReport>(`/reports/completions${query({ from: range.from, to: range.to, reference, sort, page, pageSize: PAGE_SIZE })}`);

  const exportCsv = async () => {
    const all = await load<CompletionsReport>(`/reports/completions${query({ from: range.from, to: range.to, reference, sort, page: 1, pageSize: 500 })}`);
    const header = ['Jogo', 'Concluído em', 'Estimativa (h)', 'Jogado (h)', 'Diferença (%)'];
    const lines = all.estimates.rows.map((row) => [row.title, row.completedAt, row.estimatedHours, row.playedHours, row.differencePercent].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'));
    const url = URL.createObjectURL(new Blob([`﻿${[header.join(';'), ...lines].join('\n')}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'gameshelf-estimativa-vs-realidade.csv'; link.click();
    URL.revokeObjectURL(url);
  };

  if (failed) return <ErrorState>Não foi possível carregar o relatório de conclusões.</ErrorState>;
  if (!data) return <LoadingState>Carregando relatório…</LoadingState>;

  const { funnel, estimates } = data;
  const pages = Math.max(1, Math.ceil(estimates.total / estimates.pageSize));
  return <div className="report-body">
    <div className="stats-grid">
      <StatCard label="Taxa de conclusão" value={`${funnel.completionRate.toLocaleString('pt-BR')}%`} detail={`${funnel.completed} de ${funnel.started} jogos iniciados`} accent />
      <StatCard label="Abandonados" value={String(funnel.abandoned)} detail={`${funnel.abandonmentRate.toLocaleString('pt-BR')}% dos iniciados`} />
      <StatCard label="Pausados" value={String(funnel.paused)} />
      <StatCard label="Zerados no período" value={String(data.completedInRange)} detail={data.averageDaysToComplete === null ? 'Sem datas de início e conclusão' : `Em média ${data.averageDaysToComplete.toLocaleString('pt-BR')} dias para zerar`} />
    </div>
    <small className="stats-note">Taxa, abandonados e pausados refletem o estado atual da biblioteca; o período filtra só os jogos zerados.</small>

    <div className="stats-pair">
      <Panel title="Conclusões por mês">{data.byMonth.length === 0 ? <p className="library-subtitle">Nenhum jogo zerado no período.</p>
        : <Bars label="Conclusões por mês" entries={data.byMonth.map((entry) => ({ key: entry.month, label: monthLabel(entry.month), value: entry.count, display: String(entry.count) }))} />}</Panel>
      <Panel title="Conclusões por ano">{data.byYear.length === 0 ? <p className="library-subtitle">Nenhum jogo zerado no período.</p>
        : <Bars label="Conclusões por ano" entries={data.byYear.map((entry) => ({ key: entry.year, label: String(entry.year), value: entry.count, display: String(entry.count) }))} />}</Panel>
    </div>

    <Panel title="Estimativa versus realidade" actions={<button type="button" className="ach-filter" onClick={() => void exportCsv()} disabled={estimates.total === 0}>Exportar CSV</button>}>
      <div className="report-filters">
        <label>Referência <select value={reference} onChange={(event) => setReference(event.target.value as Reference)}>
          {(Object.keys(referenceLabels) as Reference[]).map((key) => <option key={key} value={key}>{referenceLabels[key]}</option>)}
        </select></label>
        <label>Ordenar por <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
          <option value="DIFFERENCE_DESC">Maior estouro</option><option value="DIFFERENCE_ASC">Maior economia</option>
          <option value="PLAYED_DESC">Mais horas jogadas</option><option value="TITLE">Título</option>
        </select></label>
      </div>
      {estimates.total === 0 ? <p className="library-subtitle">Nenhum jogo zerado no período com estimativa e horas registradas.</p> : <>
        <p className="library-subtitle">{estimates.overCount} acima da estimativa · {estimates.underCount} abaixo · diferença média {estimates.averageDifferencePercent === null ? '—' : signed(estimates.averageDifferencePercent)}. Horas jogadas somam sessões e horas retroativas.</p>
        <table className="stats-table">
          <thead><tr><th>Jogo</th><th>Concluído</th><th>Estimativa</th><th>Real</th><th>Diferença</th></tr></thead>
          <tbody>{estimates.rows.map((row) => <tr key={row.gameId}>
            <th scope="row"><button type="button" className="link-button" onClick={() => onOpenGame(row.gameId)}>{row.title}</button></th>
            <td>{row.completedAt.split('-').reverse().join('/')}</td><td>{formatHoursMinutes(row.estimatedHours)}</td><td>{formatHoursMinutes(row.playedHours)}</td><td>{signed(row.differencePercent)}</td>
          </tr>)}</tbody>
        </table>
        <div className="report-pager">
          <button type="button" className="ach-filter" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
          <span>Página {page} de {pages}</span>
          <button type="button" className="ach-filter" disabled={page >= pages} onClick={() => setPage(page + 1)}>Próxima</button>
        </div>
      </>}
    </Panel>

    {data.stalled.length > 0 && <Panel title="Jogos pausados há mais tempo">
      <Bars label="Dias sem atividade" entries={data.stalled.map((entry) => ({ key: entry.gameId, label: entry.title, value: entry.daysIdle, display: `${entry.daysIdle} dias`, onOpen: () => onOpenGame(entry.gameId) }))} />
    </Panel>}
  </div>;
}

const journeyStatusLabels: Record<PlaythroughsReport['mostReplayed'][number]['history'][number]['status'], string> = {
  PLANNED: 'Planejada', PLAYING: 'Jogando', PAUSED: 'Pausada', COMPLETED: 'Zerada', ABANDONED: 'Abandonada',
};
const decimal = (value: number | null) => value === null ? '—' : value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const brDate = (value: string | null) => value ? value.split('-').reverse().join('/') : '—';

function PlaythroughsReportView({ range, onOpenGame }: { range: Range; onOpenGame: (gameId: string) => void }) {
  const { data, failed } = useReport<PlaythroughsReport>(`/reports/playthroughs${query({ from: range.from, to: range.to })}`);
  if (failed) return <ErrorState>Não foi possível carregar o relatório de jornadas.</ErrorState>;
  if (!data) return <LoadingState>Carregando relatório…</LoadingState>;
  const { totals, firstVsLater } = data;
  if (totals.journeysStarted === 0) return <EmptyState title="Nenhuma jornada encontrada" description="Ajuste o período ou inicie jornadas nos jogos." />;
  const comparison = firstVsLater.firstAverageHours === null || firstVsLater.laterAverageHours === null
    ? '—' : `${decimal(firstVsLater.firstAverageHours)}h → ${decimal(firstVsLater.laterAverageHours)}h`;
  return <div className="report-body">
    <div className="stats-grid">
      <StatCard label="Jornadas iniciadas" value={String(totals.journeysStarted)} detail={`em ${totals.gamesWithJourneys} jogos · ${decimal(totals.averageJourneysPerGame)} por jogo`} accent />
      <StatCard label="Taxa de conclusão" value={`${decimal(totals.completionRate)}%`} detail={`${totals.journeysCompleted} zeradas · ${totals.journeysAbandoned} abandonadas`} />
      <StatCard label="Replays iniciados" value={String(totals.replaysStarted)} />
      <StatCard label="Dias para zerar" value={decimal(totals.averageDaysToComplete)} detail="Média entre início e conclusão" />
      <StatCard label="Intervalo entre replays" value={totals.averageDaysBetweenReplays === null ? '—' : `${decimal(totals.averageDaysBetweenReplays)} dias`} detail="Da conclusão até a jornada seguinte" />
      <StatCard label="Primeira vs. seguintes" value={comparison} detail="Horas médias das jornadas zeradas" />
    </div>
    <small className="stats-note">Conta jornadas, não o status atual do jogo; o período filtra pela data de início da jornada.</small>
    <div className="stats-pair">
      <Panel title="Por plataforma"><Bars label="Jornadas por plataforma" entries={data.byPlatform.map((entry) => ({ key: entry.name, label: entry.name, value: entry.journeys, display: String(entry.journeys) }))} /></Panel>
      <Panel title="Jogos com mais jornadas abandonadas">{data.mostAbandoned.length === 0 ? <p className="library-subtitle">Nenhuma jornada abandonada.</p>
        : <Bars label="Jornadas abandonadas" entries={data.mostAbandoned.map((entry) => ({ key: entry.gameId, label: entry.title, value: entry.abandoned, display: `${entry.abandoned} de ${entry.journeys}`, onOpen: () => onOpenGame(entry.gameId) }))} />}</Panel>
    </div>
    <Panel title="Jogos mais rejogados">{data.mostReplayed.length === 0 ? <p className="library-subtitle">Nenhum jogo com mais de uma jornada.</p>
      : data.mostReplayed.map((game) => <div key={game.gameId} className="report-journeys">
        <h3><button type="button" className="link-button" onClick={() => onOpenGame(game.gameId)}>{game.title}</button> <small>{game.journeys} jornadas</small></h3>
        <table className="stats-table">
          <thead><tr><th>Jornada</th><th>Plataforma</th><th>Início</th><th>Situação</th><th>Dias</th><th>Horas</th></tr></thead>
          <tbody>{game.history.map((item) => <tr key={item.id}>
            <th scope="row">{item.label ?? `#${item.sequence}`}</th><td>{item.platformName ?? '—'}</td><td>{brDate(item.startedAt)}</td>
            <td>{journeyStatusLabels[item.status]}</td><td>{item.days ?? '—'}</td><td>{item.hours > 0 ? formatHoursMinutes(item.hours) : '—'}</td>
          </tr>)}</tbody>
        </table>
      </div>)}</Panel>
  </div>;
}

const agingLabels: Record<BacklogReport['aging'][number]['key'], string> = {
  UP_TO_30: 'Menos de 30 dias', UP_TO_90: '30 a 90 dias', UP_TO_180: '3 a 6 meses', UP_TO_365: '6 meses a 1 ano', OVER_365: 'Mais de 1 ano',
};

function BacklogReportView({ onOpenGame }: { onOpenGame: (gameId: string) => void }) {
  const { data, failed } = useReport<BacklogReport>('/reports/backlog');
  if (failed) return <ErrorState>Não foi possível carregar o relatório de biblioteca e backlog.</ErrorState>;
  if (!data) return <LoadingState>Carregando relatório…</LoadingState>;
  const { totals } = data;
  const hoursLabel = (hours: number) => formatHoursMinutes(hours);
  const rank = (entries: BacklogReport['byGenre']) => entries.map((entry) => ({ key: entry.id ?? entry.name, label: entry.name, value: entry.games, display: `${entry.games} · ${hoursLabel(entry.estimatedHours)}` }));
  if (totals.backlogCount === 0) return <EmptyState title="Backlog vazio" description="Nenhum jogo com status Backlog." />;
  return <div className="report-body">
    <div className="stats-grid">
      <StatCard label="Jogos no backlog" value={String(totals.backlogCount)} detail={`${totals.neverStarted} nunca iniciados`} accent />
      <StatCard label="Horas que faltam" value={hoursLabel(totals.estimatedRemainingHours)} detail={totals.withoutEstimate > 0 ? `${totals.withoutEstimate} jogos sem estimativa` : 'Estimativa pessoal ou da história principal'} />
      <StatCard label="Idade média" value={totals.averageAgeDays === null ? '—' : `${decimal(totals.averageAgeDays)} dias`} detail="Desde o cadastro do jogo" />
      <StatCard label="Desejados x biblioteca" value={`${totals.desiredCount} / ${totals.ownedCount}`} detail="Desejados / jogos que você possui" />
    </div>
    <small className="stats-note">Retrato do estado atual da biblioteca: o período não se aplica a este relatório. Jogos arquivados ficam de fora.</small>
    <div className="stats-pair">
      <Panel title="Envelhecimento do backlog"><Bars label="Jogos por tempo de espera" entries={data.aging.map((entry) => ({ key: entry.key, label: agingLabels[entry.key], value: entry.games, display: String(entry.games) }))} /></Panel>
      <Panel title="Por ano de lançamento">{data.byReleaseYear.length === 0 ? <p className="library-subtitle">Nenhum jogo com ano de lançamento.</p>
        : <Bars label="Backlog por ano de lançamento" entries={data.byReleaseYear.map((entry) => ({ key: entry.year, label: String(entry.year), value: entry.games, display: String(entry.games) }))} />}</Panel>
      <Panel title="Por gênero"><Bars label="Backlog por gênero" entries={rank(data.byGenre)} /><small className="stats-note">Jogos e horas que faltam; um jogo com vários gêneros conta em cada um.</small></Panel>
      <Panel title="Por plataforma"><Bars label="Backlog por plataforma" entries={rank(data.byPlatform)} /></Panel>
    </div>
    <Panel title="Esperando há mais tempo"><Bars label="Dias no backlog" entries={data.oldest.map((entry) => ({ key: entry.gameId, label: entry.title, value: entry.ageDays, display: `${entry.ageDays} dias`, onOpen: () => onOpenGame(entry.gameId) }))} /></Panel>
  </div>;
}
