import { useState, type ChangeEvent } from 'react';
import type { SessionScreenshot } from '@gameshelf/contracts';
import { apiUrl } from './shared';

const accepted = ['image/jpeg', 'image/png', 'image/webp'];
const maxBytes = 8 * 1024 * 1024;

// Carrega as imagens só quando o usuário abre a seção, para não fazer uma requisição por sessão.
export function SessionScreenshots({ gameId, sessionId }: { gameId: string; sessionId: string }) {
  const base = `${apiUrl}/games/${gameId}/sessions/${sessionId}/screenshots`;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SessionScreenshot[] | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || items) return;
    try {
      const response = await fetch(base);
      const body = response.ok ? await response.json() as SessionScreenshot[] : null;
      if (!Array.isArray(body)) throw new Error('invalid');
      setItems(body);
    } catch { setItems([]); setMessage('Não foi possível carregar as imagens.'); }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!accepted.includes(file.type)) { setMessage('Use uma imagem JPEG, PNG ou WebP.'); return; }
    if (file.size > maxBytes) { setMessage('A imagem deve ter até 8 MB.'); return; }
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(base, { method: 'POST', headers: { 'content-type': file.type }, body: file });
      if (!response.ok) {
        const error = await response.json().catch(() => null) as { error?: string } | null;
        setMessage(error?.error ?? 'Não foi possível enviar a imagem.');
        return;
      }
      const created = await response.json() as SessionScreenshot;
      setItems((current) => [...(current ?? []), created]);
    } catch { setMessage('Não foi possível enviar a imagem.'); } finally { setBusy(false); }
  }

  async function remove(item: SessionScreenshot) {
    const response = await fetch(`${base}/${item.id}`, { method: 'DELETE' });
    if (!response.ok) { setMessage('Não foi possível excluir a imagem.'); return; }
    setMessage('');
    setItems((current) => (current ?? []).filter((entry) => entry.id !== item.id));
  }

  return <div className="session-screenshots">
    <button type="button" className="session-edit" aria-expanded={open} onClick={() => void toggle()}>{open ? 'Ocultar imagens' : `Imagens${items ? ` (${items.length})` : ''}`}</button>
    {open && <div className="screenshot-panel">
      {items?.length ? <ul className="screenshot-grid">{items.map((item) => <li key={item.id}>
        <a href={item.url} target="_blank" rel="noreferrer"><img src={item.url} alt="Screenshot da sessão" loading="lazy" /></a>
        <button type="button" className="session-delete" onClick={() => void remove(item)}>Excluir imagem</button>
      </li>)}</ul> : items && <p className="session-empty">Nenhuma imagem nesta sessão.</p>}
      <label className="screenshot-upload">Adicionar imagem<input aria-label="Adicionar imagem à sessão" type="file" accept={accepted.join(',')} disabled={busy} onChange={(event) => void upload(event)} /></label>
      {message && <p role="alert" className="session-feedback">{message}</p>}
    </div>}
  </div>;
}
