import { useState, type ChangeEvent } from 'react';
import { apiUrl } from './shared';

type ImportSummary = { games: number; sessions: number; lists: number; goals: number; screenshots: number; queue: number };

export function BackupCard({ onImported }: { onImported: () => void }) {
  const [message, setMessage] = useState('');
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function exportData() {
    setBusy(true);
    setMessage('');
    setProblems([]);
    try {
      const response = await fetch(`${apiUrl}/backup/export`);
      if (!response.ok) throw new Error('export');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `gameshelf-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage('Backup exportado. As imagens ficam no volume de mídia e não vão neste arquivo.');
    } catch { setMessage('Não foi possível exportar os dados.'); } finally { setBusy(false); }
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setMessage('');
    setProblems([]);
    let payload: unknown;
    try { payload = JSON.parse(await file.text()); } catch { setMessage('O arquivo não é um JSON válido.'); return; }
    setBusy(true);
    try {
      const response = await fetch(`${apiUrl}/backup/import`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => null) as (ImportSummary & { error?: string; problems?: string[] }) | null;
      if (!response.ok) {
        setMessage(body?.error ?? 'Não foi possível importar o backup.');
        setProblems(body?.problems ?? []);
        return;
      }
      setMessage(`Backup importado: ${body!.games} jogos, ${body!.sessions} sessões, ${body!.lists} listas e ${body!.goals} metas.`);
      onImported();
    } catch { setMessage('Não foi possível importar o backup.'); } finally { setBusy(false); }
  }

  return <section className="panel backup-card" aria-labelledby="backup-title">
    <h2 id="backup-title">Backup dos dados</h2>
    <p className="panel-figure">Exporte tudo em um arquivo JSON. Para restaurar, importe o arquivo em uma biblioteca vazia.</p>
    <div className="challenge-actions">
      <button type="button" className="gameshelf-button" disabled={busy} onClick={() => void exportData()}>Exportar dados</button>
      <label className="session-edit backup-import">Importar backup<input aria-label="Importar backup" type="file" accept="application/json,.json" disabled={busy} onChange={(event) => void importData(event)} /></label>
    </div>
    {message && <p role="status" className="session-feedback">{message}</p>}
    {problems.length > 0 && <ul className="backup-problems" role="alert">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>}
    <small>O arquivo não inclui as imagens (capas e screenshots). Para um backup completo, use também o script de backup, que copia o banco e o volume de mídia.</small>
  </section>;
}
