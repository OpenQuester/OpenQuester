export interface ICache {
  /** Returns deserialized (parsed) object of type T */
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMilliseconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  scan(pattern: string): Promise<string[]>;
}
