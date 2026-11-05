import { useCallback, useEffect, useState } from 'react';
import type { MetadataReviewResponse, MetadataSyncItem } from '@gameshelf/contracts';
import { Button, EmptyState, ErrorState, LoadingState } from '@gameshelf/ui';
import { apiUrl } from './shared';

const fieldLabels: Record<string, string> = {
  description: 'descrição', releaseYear: 'ano', developer: 'desenvolvedora', publisher: 'publicadora', coverUrl: 'capa', backgroundUrl: 'fundo',
  genreIds: 'gêneros', franchiseId: 'franquia', estimatedMainHours: 'tempo principal', estimatedCompletionistHours: 'tempo completista',
};

async function post(path: string, body?: unknown): Promise<Response> {
  return fetch(`${apiUrl}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
}

/** Contagem para o selo da aba; falha em silêncio (sem servidor, sem selo). */
export async function fetchMetadataReviewCount(): Promise<number> {
  try {
    const response = await fetch(`${apiUrl}/metadata-sync/review`);
    if (!response.ok) return 0;
    return ((await response.json()) as MetadataReviewResponse).count;
  } catch { return 0; }
}

/**
 * Jogos cujos metadados a captura automática aplicou sozinha, não achou ou
 * precisa que você escolha (ADR-043).
 */
export function MetadataReviewView({ onChanged }: { onChanged?: () => void }) {
  const [data, setData] = useState<MetadataReviewResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState('');
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/metadata-sync/review`);
      if (!response.ok) throw new Error();
      setData(await response.json() as MetadataReviewResponse);
      setFailed(false);
    } catch { setFailed(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function act(path: string, body?: unknown, done?: string) {
    const response = await post(path, body).catch(() => null);
    setMessage(response?.ok ? done ?? '' : 'Não foi possível concluir a ação.');
    await load();
    onChanged?.();
  }

  async function run() {
    setRunning(true); setMessage('');
    try {
      const response = await post('/metadata-sync/run');
      if (!response.ok) throw new Error();
      const result = await response.json() as { checked: number };
      setMessage(result.checked === 0 ? 'Nenhum jogo pendente.' : `${result.checked} jogo(s) consultado(s).`);
      await load();
      onChanged?.();
    } catch { setMessage('Não foi possível buscar agora.'); } finally { setRunning(false); }
  }

  function searchAnother(item: MetadataSyncItem) {
    const query = window.prompt('Buscar outro título no IGDB', item.title)?.trim();
    if (query) void act(`/metadata-sync/${item.gameId}/search`, { query });
  }

  return <section className="stats-page metadata-review" aria-labelledby="metadata-review-title">
    <div className="stats-head"><h1 id="metadata-review-title">Metadados a revisar</h1></div>
    <p className="library-subtitle">A API busca capa, descrição, ano, gêneros e mais sozinha. Aqui estão os jogos em que ela aplicou algo para você confirmar, ou que precisam de uma escolha.</p>
    <Button type="button" disabled={running} onClick={() => void run()}>Buscar metadados pendentes</Button>
    {message && <p role="status" className="session-feedback">{message}</p>}
    {failed && <ErrorState>Não foi possível carregar a revisão.</ErrorState>}
    {!failed && !data && <LoadingState>Carregando revisão…</LoadingState>}
    {data && data.items.length === 0 && <EmptyState title="Nada para revisar" description="Os metadados dos jogos estão em dia." />}
    {data && data.items.length > 0 && <ul className="metadata-review-list">{data.items.map((item) => {
      const applied = item.status === 'APPLIED_AUTO';
      const notFound = item.status === 'NOT_FOUND';
      const fields = item.appliedFields.map((field) => fieldLabels[field] ?? field).join(', ');
      return <li key={item.gameId} className="panel">
        <h2>{item.title}</h2>
        <p className="library-subtitle">{applied ? `Preenchido sozinho${fields ? `: ${fields}` : ''}` : notFound ? 'Nada encontrado com este título' : 'Mais de um resultado possível'}</p>
        {!applied && !notFound && <ul aria-label={`Candidatos para ${item.title}`}>{item.candidates.slice(0, 5).map((candidate) => <li key={candidate.providerId}>
          {candidate.title}{candidate.releaseYear ? ` (${candidate.releaseYear})` : ''}{candidate.developer ? ` · ${candidate.developer}` : ''}{' '}
          <button type="button" className="session-edit" onClick={() => void act(`/metadata-sync/${item.gameId}/use`, { providerId: candidate.providerId }, 'Metadados aplicados.')}>Usar este</button>
        </li>)}</ul>}
        <div className="dashboard-game-actions">
          {applied ? <>
            <Button type="button" onClick={() => void act(`/metadata-sync/${item.gameId}/confirm`, undefined, 'Confirmado.')}>Confirmar</Button>
            <button type="button" className="session-edit" onClick={() => void act(`/metadata-sync/${item.gameId}/undo`, undefined, 'Desfeito.')}>Desfazer</button>
          </> : <>
            <button type="button" className="session-edit" onClick={() => searchAnother(item)}>Buscar outro</button>
            <button type="button" className="session-edit" onClick={() => void act(`/metadata-sync/${item.gameId}/ignore`)}>Ignorar</button>
          </>}
        </div>
      </li>;
    })}</ul>}
  </section>;
}
