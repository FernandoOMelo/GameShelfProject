export interface PlanningSettingsRepository {
  getWeeklyMinutes(): Promise<number>;
  setWeeklyMinutes(weeklyMinutes: number): Promise<void>;
}
