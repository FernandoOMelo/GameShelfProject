export type GameListRecord = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  gameIds: string[];
};

export interface GameListRepository {
  list(): Promise<GameListRecord[]>;
  find(id: string): Promise<GameListRecord | undefined>;
  create(name: string): Promise<GameListRecord>;
  rename(id: string, name: string): Promise<GameListRecord | undefined>;
  delete(id: string): Promise<boolean>;
  addGame(listId: string, gameId: string): Promise<void>;
  removeGame(listId: string, gameId: string): Promise<boolean>;
}
