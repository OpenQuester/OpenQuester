export interface GuestCleanupBatch {
  deletedCount: number;
  retainedCount: number;
  avatarFilenames: string[];
}

export interface InactiveGuest {
  id: number;
  avatarFilename: string | null;
  keepAccount: boolean;
}
