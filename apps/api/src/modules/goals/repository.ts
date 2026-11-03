import type { GoalInput, GoalUpdate } from '@gameshelf/contracts';

export type GoalRecord = {
  id: string;
  kind: GoalInput['kind'];
  period: 'YEAR' | 'MONTH';
  year: number;
  month: number;
  target: number;
  title: string | null;
  description: string | null;
  listId: string | null;
  dueDate: string | null;
  done: boolean;
  createdAt: Date;
};

export interface GoalRepository {
  list(): Promise<GoalRecord[]>;
  create(input: GoalInput): Promise<GoalRecord>;
  update(id: string, input: GoalUpdate): Promise<GoalRecord | undefined>;
  remove(id: string): Promise<boolean>;
}
