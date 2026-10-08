import type { GoalInput } from '@gameshelf/contracts';

export type GoalRecord = { id: string; kind: GoalInput['kind']; period: GoalInput['period']; year: number; month: number; target: number };

export interface GoalRepository {
  list(): Promise<GoalRecord[]>;
  create(input: GoalInput): Promise<GoalRecord>;
  updateTarget(id: string, target: number): Promise<GoalRecord | undefined>;
  remove(id: string): Promise<boolean>;
}
