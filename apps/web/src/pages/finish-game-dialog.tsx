import { useState } from 'react';
import { isReviewEmpty, reviewCriteria, type FinishResult, type Game, type GameReview } from '@gameshelf/contracts';
import { Button } from '@gameshelf/ui';
import { difficultyLabels, reviewCriteriaLabels } from './shared';

const STEPS = ['Nota', 'Dificuldade', 'Extras', 'Critérios', 'Análise', 'Resumo'] as const;
const emptyReview = (): GameReview => ({
  summary: null,
  gameplay: { score: null, comment: null }, setting: { score: null, comment: null },
  soundtrack: { score: null, comment: null }, story: { score: null, comment: null },
});
const difficulties = ['C', 'B', 'A', 'AA', 'AAA'] as const;
const brDate = (value: string | null) => value ? value.split('-').reverse().join('/') : '—';

/**
 * Assistente de "Zerar" (ADR-042). A conclusão já está gravada quando ele abre; as
 * etapas só enriquecem a ficha e todas podem ser puladas. Fechar nunca desfaz.
 */
export function FinishGameDialog({ result, onChangeDate, onSave, onClose }: {
  result: FinishResult;
  /** Refaz a conclusão com outra data (desfaz e grava de novo). */
  onChangeDate: (date: string) => Promise<FinishResult>;
  onSave: (values: Partial<Game>) => Promise<void>;
  onClose: (result: FinishResult) => void;
}) {
  const [current, setCurrent] = useState(result);
  const [step, setStep] = useState(0);
  const [rating, setRating] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<Game['difficulty']>(null);
  const [condition, setCondition] = useState('');
  const [favorite, setFavorite] = useState(result.game.favorite);
  const [gameOfYear, setGameOfYear] = useState(false);
  const [review, setReview] = useState<GameReview>(emptyReview);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const last = step === STEPS.length - 1;

  async function changeDate(date: string) {
    if (!date || date === current.game.completedAt) return;
    setBusy(true); setError('');
    try { setCurrent(await onChangeDate(date)); } catch { setError('Não foi possível mudar a data (ela não pode ser anterior ao início).'); } finally { setBusy(false); }
  }

  const setCriterion = (key: typeof reviewCriteria[number], patch: Partial<GameReview[typeof key]>) =>
    setReview((value) => ({ ...value, [key]: { ...value[key], ...patch } }));

  async function next() {
    if (!last) { setStep(step + 1); return; }
    const values: Partial<Game> = {
      ...(rating === null ? {} : { rating }), ...(difficulty === null ? {} : { difficulty }),
      ...(condition.trim() ? { completionCondition: condition.trim() } : {}),
      ...(favorite === current.game.favorite ? {} : { favorite }), ...(gameOfYear ? { gameOfYear: true } : {}),
      ...(isReviewEmpty(review) ? {} : { review }),
    };
    if (Object.keys(values).length === 0) { onClose(current); return; }
    setBusy(true); setError('');
    try { await onSave(values); onClose(current); } catch { setError('Não foi possível salvar. A conclusão já está gravada.'); setBusy(false); }
  }

  return <div className="dialog-backdrop" role="presentation"><section className="dialog finish-dialog" role="dialog" aria-modal="true" aria-labelledby="finish-title">
    <h2 id="finish-title">{current.game.title} zerado!</h2>
    <p className="library-subtitle">Em {brDate(current.game.completedAt)} <label className="finish-date">Alterar data <input type="date" aria-label="Data de conclusão" max={new Date().toISOString().slice(0, 10)} value={current.game.completedAt ?? ''} disabled={busy} onChange={(event) => void changeDate(event.target.value)} /></label></p>
    <p className="finish-step">{step + 1} de {STEPS.length} · {STEPS[step]}</p>
    {step === 0 && <div role="group" aria-label="Nota" className="finish-chips">{Array.from({ length: 11 }, (_, index) => index + 1).map((value) => <button key={value} type="button" className={`ach-filter${rating === value ? ' is-active' : ''}`} aria-pressed={rating === value} onClick={() => setRating(rating === value ? null : value)}>{value}</button>)}</div>}
    {step === 1 && <div role="group" aria-label="Dificuldade" className="finish-chips">{difficulties.map((value) => <button key={value} type="button" className={`ach-filter${difficulty === value ? ' is-active' : ''}`} aria-pressed={difficulty === value} onClick={() => setDifficulty(difficulty === value ? null : value)}>{difficultyLabels[value] ?? value}</button>)}</div>}
    {step === 2 && <div className="finish-extras">
      <label className="form-field">Condição de zeramento (opcional)<input value={condition} maxLength={300} onChange={(event) => setCondition(event.target.value)} /></label>
      <label className="form-check"><input type="checkbox" checked={favorite} onChange={(event) => setFavorite(event.target.checked)} /> Favorito</label>
      <label className="form-check"><input type="checkbox" checked={gameOfYear} onChange={(event) => setGameOfYear(event.target.checked)} /> Jogo do ano</label>
    </div>}
    {step === 3 && <div className="finish-criteria">
      <p className="library-subtitle">Opcional: avalie só o que quiser, de 1 a 10.</p>
      {reviewCriteria.map((key) => <div key={key} className="finish-criterion">
        <strong>{reviewCriteriaLabels[key]}</strong>
        <div role="group" aria-label={reviewCriteriaLabels[key]} className="finish-chips">{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <button key={value} type="button" className={`ach-filter${review[key].score === value ? ' is-active' : ''}`} aria-pressed={review[key].score === value} onClick={() => setCriterion(key, { score: review[key].score === value ? null : value })}>{value}</button>)}</div>
        <input aria-label={`Comentário de ${reviewCriteriaLabels[key].toLowerCase()}`} placeholder="Comentário (opcional)" maxLength={1000} value={review[key].comment ?? ''} onChange={(event) => setCriterion(key, { comment: event.target.value || null })} />
      </div>)}
    </div>}
    {step === 4 && <label className="form-field">Sua análise do jogo (opcional)<textarea rows={6} maxLength={5000} placeholder="O que você achou, o que ficou na memória, para quem recomenda…" value={review.summary ?? ''} onChange={(event) => setReview((value) => ({ ...value, summary: event.target.value || null }))} /></label>}
    {step === 5 && <dl className="finish-summary">
      <div><dt>Zerado em</dt><dd>{brDate(current.game.completedAt)}</dd></div>
      <div><dt>Nota</dt><dd>{rating ?? '—'}</dd></div>
      <div><dt>Dificuldade</dt><dd>{difficulty ? difficultyLabels[difficulty] ?? difficulty : '—'}</dd></div>
      <div><dt>Favorito</dt><dd>{favorite ? 'Sim' : 'Não'}</dd></div>
      {reviewCriteria.map((key) => <div key={key}><dt>{reviewCriteriaLabels[key]}</dt><dd>{review[key].score ?? '—'}</dd></div>)}
      <div><dt>Análise</dt><dd>{review.summary?.trim() ? 'Escrita' : '—'}</dd></div>
    </dl>}
    {error && <p role="alert" className="session-feedback">{error}</p>}
    <footer className="dialog-actions">
      {!last && <button type="button" className="cancel-button" disabled={busy} onClick={() => setStep(step + 1)}>Pular</button>}
      <Button type="button" disabled={busy} onClick={() => void next()}>{last ? 'Concluir' : 'Próximo'}</Button>
    </footer>
  </section></div>;
}
