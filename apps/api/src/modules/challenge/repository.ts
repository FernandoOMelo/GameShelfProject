export type MainChallengeRecord = { title: string; listId: string };

export interface MainChallengeRepository {
  get(): Promise<MainChallengeRecord | undefined>;
  set(input: MainChallengeRecord): Promise<void>;
  clear(): Promise<void>;
}

export type ChallengeCompletionInput = { title: string; listId: string; gamesCount: number; completedAt: Date };

export type ChallengeCompletionRecord = Omit<ChallengeCompletionInput, 'listId'> & { id: string; listId: string | null };

export interface ChallengeCompletionRepository {
  listAll(): Promise<ChallengeCompletionRecord[]>;
  record(input: ChallengeCompletionInput): Promise<void>;
}
