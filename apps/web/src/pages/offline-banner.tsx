import { useCallback, useEffect, useRef, useState } from 'react';
import {
  discardPending, enqueueSession, finishOpenPending, flushPending, isOpenCreate, loadPending,
  type EnqueueResult, type NewPending, type PendingSession,
} from './offline-sessions';
import { formatDateTime } from './shared';

export function useOfflineSessions(onSynced: () => void) {
  const [pending, setPending] = useState<PendingSession[]>(() => loadPending());
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  const [notice, setNotice] = useState('');
  const [syncs, setSyncs] = useState(0);
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  const flush = useCallback(async () => {
    if (!loadPending().some((item) => !item.error)) return;
    const result = await flushPending();
    setPending(result.items);
    if (result.synced > 0) {
      setNotice(`${result.synced} ${result.synced === 1 ? 'operação enviada' : 'operações enviadas'} ao servidor.`);
      setSyncs((count) => count + 1);
      onSyncedRef.current();
    }
  }, []);

  useEffect(() => {
    const goOnline = () => { setOnline(true); void flush(); };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    void flush();
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, [flush]);

  const enqueue = useCallback((item: NewPending): EnqueueResult => {
    const result = enqueueSession(item);
    if (result.ok) { setPending(result.items); setNotice(''); }
    return result;
  }, []);

  const finishOpen = useCallback((clientId: string) => setPending(finishOpenPending(clientId, new Date().toISOString())), []);
  const discard = useCallback((clientId: string) => setPending(discardPending(clientId)), []);
  // `syncs` muda a cada envio bem-sucedido, para as telas recarregarem o que dependem do servidor.
  return { pending, online, notice, syncs, enqueue, finishOpen, discard, flush };
}

// Mensagem para quando a operação não pôde ser guardada no aparelho.
export function enqueueFailureMessage(result: Extract<EnqueueResult, { ok: false }>): string {
  if (result.reason === 'open') return 'Já há uma sessão em andamento sem conexão para este jogo.';
  if (result.reason === 'full') return 'Há operações demais aguardando envio. Reconecte antes de registrar outras.';
  return 'Sem conexão e não foi possível guardar a operação neste aparelho.';
}

const time = (iso: string) => formatDateTime(iso);

export function OfflineBanner({ pending, online, notice, onFinishOpen, onDiscard, onRetry }: {
  pending: PendingSession[];
  online: boolean;
  notice: string;
  onFinishOpen: (clientId: string) => void;
  onDiscard: (clientId: string) => void;
  onRetry: () => void;
}) {
  const open = pending.filter(isOpenCreate);
  const waiting = pending.filter((item) => !item.error && !isOpenCreate(item));
  const failed = pending.filter((item) => item.error);
  if (online && !pending.length && !notice) return null;
  return <aside className="offline-banner" aria-label="Estado da conexão">
    {!online && <p role="status"><strong>Sem conexão.</strong> Você pode consultar o que já foi carregado e iniciar ou encerrar sessões; elas serão enviadas quando a conexão voltar.</p>}
    {open.map((item) => <p key={item.clientId} role="status">Sessão de <strong>{item.gameTitle}</strong> em andamento sem conexão, iniciada em {time(item.payload.startedAt)}. <button type="button" className="session-edit" onClick={() => onFinishOpen(item.clientId)}>Encerrar agora</button></p>)}
    {waiting.length > 0 && <p role="status">{waiting.length} {waiting.length === 1 ? 'operação aguardando envio' : 'operações aguardando envio'}: {waiting.map((item) => item.gameTitle).join(', ')}.{online && <> <button type="button" className="session-edit" onClick={onRetry}>Enviar agora</button></>}</p>}
    {failed.length > 0 && <ul className="offline-failed" role="alert">{failed.map((item) => <li key={item.clientId}>Sessão de {item.gameTitle} não enviada: {item.error} <button type="button" className="session-delete" onClick={() => onDiscard(item.clientId)}>Descartar</button></li>)}</ul>}
    {notice && <p role="status">{notice}</p>}
  </aside>;
}
