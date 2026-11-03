import type { MissionInput, MissionUpdate } from '@gameshelf/contracts';

export type MissionRecord = {
  id: string;
  title: string;
  description: string | null;
  kind: MissionInput['kind'];
  listId: string | null;
  target: number | null;
  startsOn: string;
  dueDate: string | null;
  done: boolean;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export interface MissionRepository {
  list(): Promise<MissionRecord[]>;
  /** A primeira missão criada vira a principal; `isPrimary` troca a principal. */
  create(input: MissionInput): Promise<MissionRecord>;
  update(id: string, input: MissionUpdate): Promise<MissionRecord | undefined>;
  remove(id: string): Promise<boolean>;
}
