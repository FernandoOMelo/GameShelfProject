export type MainChallengeRecord = { title: string; listId: string };

export interface MainChallengeRepository {
  get(): Promise<MainChallengeRecord | undefined>;
  set(input: MainChallengeRecord): Promise<void>;
  clear(): Promise<void>;
}
