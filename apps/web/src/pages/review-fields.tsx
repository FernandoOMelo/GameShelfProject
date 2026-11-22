import { useState } from 'react';
import { isReviewEmpty, reviewCriteria, type Game, type GameReview } from '@gameshelf/contracts';
import { Button } from '@gameshelf/ui';
import { reviewCriteriaLabels } from './shared';

export const emptyReview = (): GameReview => ({
  summary: null,
  gameplay: { score: null, comment: null }, setting: { score: null, comment: null },
  soundtrack: { score: null, comment: null }, story: { score: null, comment: null },
});

/** Nota 1–10 e comentário por critério (ADR-044); usado ao zerar e na edição. */
export function ReviewCriteriaFields({ review, onChange }: { review: GameReview; onChange: (review: GameReview) => void }) {
  const setCriterion = (key: typeof reviewCriteria[number], patch: Partial<GameReview[typeof key]>) =>
    onChange({ ...review, [key]: { ...review[key], ...patch } });
  return <div className="finish-criteria">
    <p className="library-subtitle">Opcional: avalie só o que quiser, de 1 a 10.</p>
    {reviewCriteria.map((key) => <div key={key} className="finish-criterion">
      <strong>{reviewCriteriaLabels[key]}</strong>
      <div role="group" aria-label={reviewCriteriaLabels[key]} className="finish-chips">{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <button key={value} type="button" className={`ach-filter${review[key].score === value ? ' is-active' : ''}`} aria-pressed={review[key].score === value} onClick={() => setCriterion(key, { score: review[key].score === value ? null : value })}>{value}</button>)}</div>
      <input aria-label={`Comentário de ${reviewCriteriaLabels[key].toLowerCase()}`} placeholder="Comentário (opcional)" maxLength={1000} value={review[key].comment ?? ''} onChange={(event) => setCriterion(key, { comment: event.target.value || null })} />
    </div>)}
  </div>;
}

export function ReviewSummaryField({ review, onChange }: { review: GameReview; onChange: (review: GameReview) => void }) {
  return <label className="form-field">Sua análise do jogo (opcional)<textarea rows={6} maxLength={5000} placeholder="O que você achou, o que ficou na memória, para quem recomenda…" value={review.summary ?? ''} onChange={(event) => onChange({ ...review, summary: event.target.value || null })} /></label>;
}

/** Edita a análise de um jogo já zerado. Esvaziar tudo remove a análise. */
export function ReviewEditDialog({ game, onSave, onClose }: {
  game: Game; onSave: (review: GameReview | null) => Promise<void>; onClose: () => void;
}) {
  const [review, setReview] = useState<GameReview>(game.review ?? emptyReview());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    setBusy(true); setError('');
    try { await onSave(isReviewEmpty(review) ? null : review); onClose(); } catch { setError('Não foi possível salvar a análise.'); setBusy(false); }
  }
  return <div className="dialog-backdrop" role="presentation"><section className="dialog finish-dialog" role="dialog" aria-modal="true" aria-labelledby="review-edit-title">
    <h2 id="review-edit-title">Análise de {game.title}</h2>
    <ReviewCriteriaFields review={review} onChange={setReview} />
    <ReviewSummaryField review={review} onChange={setReview} />
    {error && <p role="alert" className="session-feedback">{error}</p>}
    <footer className="dialog-actions">
      <button type="button" className="cancel-button" disabled={busy} onClick={onClose}>Cancelar</button>
      <Button type="button" disabled={busy} onClick={() => void save()}>Salvar</Button>
    </footer>
  </section></div>;
}
