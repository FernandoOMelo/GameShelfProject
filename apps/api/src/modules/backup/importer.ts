import type { BackupData } from '@gameshelf/contracts';

export class LibraryNotEmptyError extends Error {
  constructor() {
    super('A importação só é permitida em uma biblioteca vazia.');
    this.name = 'LibraryNotEmptyError';
  }
}

export interface BackupImporter {
  // Grava tudo em uma transação, preservando ids. Lança LibraryNotEmptyError se já houver dados.
  importAll(data: BackupData): Promise<void>;
}
