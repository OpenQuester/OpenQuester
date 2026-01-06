export abstract class ICache {
  /** Returns deserialized (parsed) object of type T */
  abstract get<T>(key: string): Promise<T | null>;
  abstract set<T>(
    key: string,
    value: T,
    ttlMilliseconds?: number
  ): Promise<void>;
  abstract delete(key: string): Promise<void>;
  abstract scan(pattern: string): Promise<string[]>;
}
