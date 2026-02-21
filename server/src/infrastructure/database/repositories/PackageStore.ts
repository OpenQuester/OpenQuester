import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "application/di/tokens";
import { GAME_NAMESPACE, GAME_TTL_IN_SECONDS } from "domain/constants/game";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { RoundIndexEntry } from "domain/types/dto/game/RoundIndexEntry";
import { GameStateRoundDTO } from "domain/types/dto/game/state/GameStateRoundDTO";
import { GameStateThemeDTO } from "domain/types/dto/game/state/GameStateThemeDTO";
import { PackageDTO } from "domain/types/dto/package/PackageDTO";
import { PackageFileDTO } from "domain/types/dto/package/PackageFileDTO";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { PackageTagDTO } from "domain/types/dto/package/PackageTagDTO";
import { PackageThemeDTO } from "domain/types/dto/package/PackageThemeDTO";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { ShortUserInfo } from "domain/types/user/ShortUserInfo";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { RedisService } from "infrastructure/services/redis/RedisService";

/**
 * Metadata stored under the "meta" field of a package hash
 *
 * Meta data is immutable, stored in separate key for optimization purpose (separation immutable and mutable data)
 * Helps to avoid serialization/deserialization of the whole package on every action
 */
export interface PackageMetaDTO {
  id?: number;
  title: string;
  description?: string | null;
  author: ShortUserInfo;
  ageRestriction: string;
  language?: string | null;
  logo?: { file: unknown } | null;
  tags: { tag: string }[];
  createdAt: string;
}

interface PackageThemeStoreDTO {
  id: number;
  name: string;
  order: number;
  description?: string | null;
  questionIds: number[];
}

/** Round data stored under "round:{order}" field */
interface PackageRoundStoreDTO {
  id: number;
  name: string;
  order: number;
  description?: string | null;
  type: string;
  themes: PackageThemeStoreDTO[];
}

/** Theme metadata stored under "q:{id}:theme" field */
interface PackageQuestionThemeDTO {
  id: number;
  name: string;
}

/**
 * Stores and retrieves immutable package data in Redis as a dedicated hash,
 * separate from the mutable game state.
 *
 * Redis key: `game:package:{gameId}` → HASH
 *   - `meta` → JSON: package metadata (title, author, etc.)
 *   - `round:{order}` → JSON: round metadata with theme structure
 *   - `q:{id}` → JSON: full PackageQuestionDTO
 *   - `q:{id}:theme` → JSON: { id, name } theme metadata for the question
 */
@singleton()
export class PackageStore {
  private static readonly PACKAGE_KEY_PREFIX = `${GAME_NAMESPACE}:package`;

  constructor(
    private readonly redisService: RedisService,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Get the Redis key for a game's package hash.
   */
  public getPackageKey(gameId: string): string {
    return `${PackageStore.PACKAGE_KEY_PREFIX}:${gameId}`;
  }

  /**
   * Explode a PackageDTO into per-question hash fields and store in Redis.
   * Written once at game creation; never updated during gameplay.
   */
  public async storePackage(
    gameId: string,
    pack: PackageDTO,
    ttl: number = GAME_TTL_IN_SECONDS
  ): Promise<void> {
    const key = this.getPackageKey(gameId);
    const fields: Record<string, string> = {};

    // Store package metadata
    const meta: PackageMetaDTO = {
      id: pack.id,
      title: pack.title,
      description: pack.description,
      author: { id: pack.author.id, username: pack.author.username },
      ageRestriction: pack.ageRestriction,
      language: pack.language,
      logo: pack.logo,
      tags: pack.tags.map((t) => ({ tag: t.tag })),
      createdAt:
        pack.createdAt instanceof Date
          ? pack.createdAt.toISOString()
          : String(pack.createdAt),
    };
    fields["meta"] = JSON.stringify(meta);

    // Store each round and its questions
    for (const round of pack.rounds) {
      const roundStore: PackageRoundStoreDTO = {
        id: round.id!,
        name: round.name,
        order: round.order,
        description: round.description,
        type: round.type,
        themes: round.themes.map((theme) => ({
          id: theme.id!,
          name: theme.name,
          order: theme.order,
          description: theme.description,
          questionIds: theme.questions.map((q) => q.id!),
        })),
      };
      fields[`round:${round.order}`] = JSON.stringify(roundStore);

      // Store individual questions and their theme metadata
      for (const theme of round.themes) {
        const themeRef: PackageQuestionThemeDTO = {
          id: theme.id!,
          name: theme.name,
        };
        const themeRefJson = JSON.stringify(themeRef);

        for (const question of theme.questions) {
          fields[`q:${question.id}`] = JSON.stringify(question);
          fields[`q:${question.id}:theme`] = themeRefJson;
        }
      }
    }

    await this.redisService.hset(key, fields, ttl);

    this.logger.debug("Package stored in Redis", {
      prefix: LogPrefix.GAME,
      gameId,
      fieldsCount: Object.keys(fields).length,
    });
  }

  /**
   * Build a RoundIndexEntry[] from a PackageDTO.
   * Used at game creation to store a lightweight round index on the Game entity.
   */
  public static buildRoundIndex(pack: PackageDTO): RoundIndexEntry[] {
    return pack.rounds.map((round) => ({
      order: round.order,
      type: round.type,
    }));
  }

  /**
   * Retrieve a single question by ID.
   */
  public async getQuestion(
    gameId: string,
    questionId: number
  ): Promise<PackageQuestionDTO | null> {
    const key = this.getPackageKey(gameId);
    const results = await this.redisService.hmget(key, [`q:${questionId}`]);

    const [raw] = results;

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as PackageQuestionDTO;
  }

  /**
   * Retrieve a question together with its theme metadata in a single round trip.
   */
  public async getQuestionWithTheme(
    gameId: string,
    questionId: number
  ): Promise<{
    question: PackageQuestionDTO;
    theme: PackageThemeDTO;
  } | null> {
    const key = this.getPackageKey(gameId);
    const results = await this.redisService.hmget(key, [
      `q:${questionId}`,
      `q:${questionId}:theme`,
    ]);

    const [questionRaw, themeRaw] = results;
    if (!questionRaw || !themeRaw) {
      return null;
    }

    const question = JSON.parse(questionRaw) as PackageQuestionDTO;
    const themeRef = JSON.parse(themeRaw) as PackageQuestionThemeDTO;

    // Return a PackageThemeDTO-compatible object (callers only use id and name)
    const theme: PackageThemeDTO = {
      id: themeRef.id,
      name: themeRef.name,
      order: 0,
      questions: [],
    };

    return { question, theme };
  }

  /**
   * Retrieve round metadata (including theme structure) for building GameStateRoundDTO.
   */
  public async getRound(
    gameId: string,
    roundOrder: number
  ): Promise<GameStateRoundDTO | null> {
    const key = this.getPackageKey(gameId);
    const results = await this.redisService.hmget(key, [`round:${roundOrder}`]);
    const [raw] = results;

    if (!raw) {
      return null;
    }

    const roundData = JSON.parse(raw) as PackageRoundStoreDTO;

    // Need to fetch all questions for this round to build themes with question metadata
    const questionIds: number[] = [];
    for (const theme of roundData.themes) {
      questionIds.push(...theme.questionIds);
    }

    // Fetch all questions in a single HMGET
    const questionFields = questionIds.map((id) => `q:${id}`);
    const questionResults = await this.redisService.hmget(key, questionFields);

    const questionMap = new Map<number, PackageQuestionDTO>();
    for (let i = 0; i < questionIds.length; i++) {
      const raw = questionResults[i];
      if (raw) {
        questionMap.set(questionIds[i], JSON.parse(raw) as PackageQuestionDTO);
      }
    }

    // Build GameStateRoundDTO with full theme/question structure
    const themes: GameStateThemeDTO[] = roundData.themes.map((theme) => ({
      id: theme.id,
      name: theme.name,
      description: theme.description ?? null,
      order: theme.order,
      questions: theme.questionIds
        .map((qId) => {
          const q = questionMap.get(qId);
          if (!q) {
            return null;
          }
          return {
            id: q.id!,
            order: q.order,
            price: q.isHidden ? null : q.price,
            questionComment: q.questionComment ?? null,
            isPlayed: false,
          };
        })
        .filter((q): q is NonNullable<typeof q> => q !== null),
    }));

    return {
      id: roundData.id,
      name: roundData.name,
      type: roundData.type as PackageRoundType,
      description: roundData.description ?? null,
      order: roundData.order,
      themes,
    };
  }

  /**
   * Retrieve package metadata for game listings.
   */
  public async getMeta(gameId: string): Promise<PackageMetaDTO | null> {
    const key = this.getPackageKey(gameId);
    const raw = await this.redisService.hget(key, "meta");

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as PackageMetaDTO;
  }

  /**
   * Reconstruct a full PackageDTO from stored hash fields.
   * Used rarely (e.g., for package updates during lobby).
   */
  public async getFullPackage(gameId: string): Promise<PackageDTO | null> {
    const key = this.getPackageKey(gameId);
    const allFields = await this.redisService.hgetall(key);

    if (!allFields || Object.keys(allFields).length === 0) {
      return null;
    }

    const metaRaw = allFields["meta"];
    if (!metaRaw) {
      return null;
    }

    const meta = JSON.parse(metaRaw) as PackageMetaDTO;

    // Collect rounds in order
    const rounds: PackageRoundStoreDTO[] = [];
    for (const [field, value] of Object.entries(allFields)) {
      if (field.startsWith("round:")) {
        rounds.push(JSON.parse(value) as PackageRoundStoreDTO);
      }
    }
    rounds.sort((a, b) => a.order - b.order);

    // Build question map
    const questionMap = new Map<number, PackageQuestionDTO>();
    for (const [field, value] of Object.entries(allFields)) {
      if (field.startsWith("q:") && !field.includes(":theme")) {
        const q = JSON.parse(value) as PackageQuestionDTO;
        if (q.id) {
          questionMap.set(q.id, q);
        }
      }
    }

    // Build theme map for questions
    const themeMap = new Map<number, PackageQuestionThemeDTO>();
    for (const [field, value] of Object.entries(allFields)) {
      if (field.endsWith(":theme")) {
        const match = field.match(/^q:(\d+):theme$/);
        if (match) {
          themeMap.set(
            parseInt(match[1]),
            JSON.parse(value) as PackageQuestionThemeDTO
          );
        }
      }
    }

    // Reconstruct full rounds with themes and questions
    const fullRounds = rounds.map((round) => ({
      id: round.id,
      name: round.name,
      order: round.order,
      description: round.description,
      type: round.type as PackageRoundType,
      themes: round.themes.map(
        (theme): PackageThemeDTO => ({
          id: theme.id,
          name: theme.name,
          order: theme.order,
          description: theme.description,
          questions: theme.questionIds
            .map((qId) => questionMap.get(qId))
            .filter((q): q is PackageQuestionDTO => !!q),
        })
      ),
    }));

    return {
      id: meta.id,
      title: meta.title,
      description: meta.description,
      author: meta.author,
      ageRestriction: meta.ageRestriction as AgeRestriction,
      language: meta.language,
      logo: meta.logo as { file: PackageFileDTO } | null | undefined,
      rounds: fullRounds,
      tags: meta.tags as PackageTagDTO[],
      createdAt: new Date(meta.createdAt),
    };
  }

  /**
   * Delete a game's package hash from Redis.
   */
  public async deletePackage(gameId: string): Promise<void> {
    const key = this.getPackageKey(gameId);
    await this.redisService.del(key);
  }

  /**
   * Refresh the TTL on a game's package hash.
   */
  public async refreshTtl(
    gameId: string,
    ttl: number = GAME_TTL_IN_SECONDS
  ): Promise<void> {
    const key = this.getPackageKey(gameId);
    await this.redisService.expire(key, ttl);
  }
}
