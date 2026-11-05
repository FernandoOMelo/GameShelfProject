import type { LifecycleHint } from '@gameshelf/contracts';
import { Button } from '@gameshelf/ui';

const copy: Record<Exclude<LifecycleHint['start']['mode'], 'LINK_ACTIVE'>, { title: string; description: (title: string) => string; action: (sequence: number) => string }> = {
  OFFER_FIRST: { title: 'Iniciar a jornada?', description: (title) => `${title} ainda não tem jornada. Ela guarda datas, plataforma e sessões desta rodada.`, action: (n) => `Iniciar jornada #${n}` },
  OFFER_REPLAY: { title: 'Começar um replay?', description: (title) => `Você já zerou ${title}. Uma nova jornada guarda esta rodada à parte.`, action: (n) => `Começar replay (jornada #${n})` },
  OFFER_RESUME: { title: 'Retomar a jornada?', description: (title) => `${title} tem uma jornada pausada ou abandonada. Retomar continua na mesma.`, action: () => 'Retomar jornada' },
  OFFER_PLANNED: { title: 'Iniciar a jornada planejada?', description: (title) => `${title} tem uma jornada planejada. Ela começa agora, com a data de hoje.`, action: () => 'Iniciar jornada planejada' },
};

/**
 * Convite para iniciar a jornada (ADR-042). Não bloqueia: a sessão já está rodando
 * e o painel continua utilizável; um clique confirma, "Agora não" dispensa.
 */
export function JourneyStartDialog({ gameTitle, hint, busy, onAccept, onDismiss }: {
  gameTitle: string;
  hint: LifecycleHint['start'];
  busy?: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  if (hint.mode === 'LINK_ACTIVE') return null;
  const text = copy[hint.mode];
  const last = hint.lastSession;
  const stoppedAt = last ? [last.location, last.progress === null ? null : `${last.progress}%`].filter(Boolean).join(' · ') : '';
  return <section className="journey-offer" role="dialog" aria-modal="false" aria-labelledby="journey-offer-title">
    <h2 id="journey-offer-title">{text.title}</h2>
    <p>{text.description(gameTitle)}</p>
    {stoppedAt && <p className="journey-offer-last">Parou em: {stoppedAt}</p>}
    <div className="journey-offer-actions">
      <Button type="button" disabled={busy} onClick={onAccept}>{text.action(hint.nextSequence)}</Button>
      <button type="button" className="cancel-button" onClick={onDismiss}>Agora não</button>
    </div>
  </section>;
}
