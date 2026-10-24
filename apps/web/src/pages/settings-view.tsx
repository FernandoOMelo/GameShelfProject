import { useEffect, useState, type FormEvent } from 'react';
import type { Game, Platform } from '@gameshelf/contracts';
import { Button } from '@gameshelf/ui';
import { AchievistSyncPanel } from './achievist-sync-panel';
import { PlatformsPanel } from './platforms-panel';
import { BackupCard } from './backup-card';
import { apiUrl } from './shared';

/**
 * Área de configurações (ADR-029). Tudo que configura o app — e não é visão do
 * dia a dia — vive aqui: catálogo de plataformas, integração com o Achievist,
 * backup e meta semanal. O Painel ficou só com leitura e análise.
 */
export function SettingsView({ platforms, games, weeklyHours, onPlatformsChanged, onRefresh }: {
  platforms: Platform[];
  games: Game[];
  /** Horas disponíveis por semana já salvas (meta semanal). */
  weeklyHours: number;
  onPlatformsChanged: () => void;
  onRefresh: () => Promise<void>;
}) {
  return <section className="settings-page" aria-labelledby="settings-title">
    <div><p className="eyebrow">CONFIGURAÇÕES</p><h1 id="settings-title">Configurações</h1><p className="library-subtitle">Catálogo de plataformas, integrações externas e preferências.</p></div>

    <PlatformsPanel platforms={platforms} onChanged={onPlatformsChanged} />

    <AchievistSyncPanel games={games} platforms={platforms} onLinked={() => void onRefresh()} />

    <BackupCard onImported={() => window.location.reload()} />

    <WeeklyGoalForm weeklyHours={weeklyHours} onSaved={() => onRefresh()} />
  </section>;
}

/** Meta semanal: quantas horas por semana estão disponíveis para jogar. */
export function WeeklyGoalForm({ weeklyHours, onSaved }: { weeklyHours: number; onSaved: () => void }) {
  const [weeklyMinutes, setWeeklyMinutes] = useState(String(weeklyHours ? Math.round(weeklyHours * 60) : 0));
  const [feedback, setFeedback] = useState('');
  useEffect(() => { setWeeklyMinutes(String(Math.round(weeklyHours * 60))); }, [weeklyHours]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`${apiUrl}/planning/settings`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ weeklyMinutes: Number(weeklyMinutes) }),
    });
    if (!response.ok) { setFeedback('Não foi possível salvar a meta semanal.'); return; }
    onSaved();
    setFeedback('Meta semanal salva.');
  }

  return <form className="weekly-goal-form panel" onSubmit={(event) => void save(event)}>
    <h2>Meta semanal</h2>
    <label className="form-field">Minutos disponíveis por semana
      <input aria-label="Minutos disponíveis por semana" type="number" min="0" max="10080" step="15" value={weeklyMinutes} onChange={(event) => setWeeklyMinutes(event.target.value)} />
    </label>
    <Button type="submit">Salvar meta</Button>
    {feedback && <p role="status">{feedback}</p>}
  </form>;
}
