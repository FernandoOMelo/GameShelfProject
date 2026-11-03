import { useCallback, useEffect, useState } from 'react';
import type { IntegrationHealth } from '@gameshelf/contracts';
import { apiUrl } from './shared';

const formatDateTime = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));

/**
 * Saúde das integrações (IGDB, RAWG, Achievist): configurada ou não, resultado
 * da última chamada e um teste sob demanda. Evita abrir o .env para saber se
 * a integração está funcionando (ADR-040).
 */
export function IntegrationHealthPanel() {
  const [items, setItems] = useState<IntegrationHealth[] | 'failed' | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/integrations/health`);
      if (!response.ok) throw new Error('falhou');
      setItems(await response.json() as IntegrationHealth[]);
    } catch { setItems('failed'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function test(item: IntegrationHealth) {
    setTesting(item.key);
    try {
      const response = await fetch(`${apiUrl}/integrations/health/${item.key}/test`, { method: 'POST' });
      if (response.ok) {
        const updated = await response.json() as IntegrationHealth;
        setItems((current) => Array.isArray(current) ? current.map((entry) => entry.key === updated.key ? updated : entry) : current);
      }
    } finally { setTesting(null); }
  }

  return <section className="panel integration-health" aria-labelledby="integration-health-title">
    <div className="section-heading"><h2 id="integration-health-title">Saúde das integrações</h2></div>
    {items === null && <p className="session-empty">Verificando…</p>}
    {items === 'failed' && <p role="alert" className="session-feedback">Não foi possível consultar a API.</p>}
    {Array.isArray(items) && <ul className="goal-list">{items.map((item) => <li key={item.key}>
      <div className="goal-heading">
        <strong>{item.name}</strong>
        <span>
          <span className={`status-pill ${item.configured ? (item.lastOk === false ? 'status-abandoned' : 'status-completed') : 'status-paused'}`} style={{ position: 'static' }}>{!item.configured ? 'Não configurada' : item.lastOk === false ? 'Com falha' : item.lastOk ? 'Funcionando' : 'Configurada'}</span>
          <button type="button" className="session-edit" disabled={testing !== null} onClick={() => void test(item)}>{testing === item.key ? 'Testando…' : `Testar ${item.name.split(' ')[0]}`}</button>
        </span>
      </div>
      <small>
        {item.configured ? 'Credenciais presentes no servidor.' : `Defina ${item.envVars.join(', ')} no .env do servidor.`}
        {item.lastCheckedAt ? ` Última chamada em ${formatDateTime(item.lastCheckedAt)}: ${item.lastMessage}` : ' Nenhuma chamada desde que a API subiu.'}
        {item.lastOk === false && item.lastSuccessAt ? ` Último sucesso em ${formatDateTime(item.lastSuccessAt)}.` : ''}
      </small>
    </li>)}</ul>}
  </section>;
}
