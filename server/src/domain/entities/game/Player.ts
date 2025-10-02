import { PlayerDTO } from "domain/types/dto/game/player/PlayerDTO";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PlayerMeta } from "domain/types/socket/game/PlayerMeta";

export class Player {
  private _meta: PlayerMeta;
  private _slot: number | null;
  private _role: PlayerRole;
  private _status: PlayerGameStatus;
  private _restrictionData: {
    muted: boolean;
    restricted: boolean;
    banned: boolean;
  };
  private _score: number = 0;
  private _mediaDownloaded: boolean = false;

  constructor(data: PlayerDTO) {
    this._meta = data.meta;
    this._slot = data.slot;
    this._role = data.role;
    this._status = data.status;
    this._restrictionData = data.restrictionData;
    this._score = data.score;
    this._mediaDownloaded = data.mediaDownloaded ?? false;
  }

  // Metadata
  public get meta(): PlayerMeta {
    return {
      id: this._meta.id,
      username: this._meta.username,
      avatar: this._meta.avatar ?? null,
    };
  }

  public updateMeta(meta: PlayerMeta): void {
    this._meta = meta;
  }

  public toDTO(): PlayerDTO {
    return {
      meta: this._meta,
      role: this._role,
      status: this._status,
      score: this._score,
      slot: this._slot,
      restrictionData: this._restrictionData,
      mediaDownloaded: this._mediaDownloaded,
    };
  }

  // Role
  public get role() {
    return this._role;
  }

  public set role(role: PlayerRole) {
    this._role = role;
  }

  // Slot
  public get gameSlot() {
    return this._slot;
  }

  public set gameSlot(slot: number | null) {
    this._slot = slot;
  }

  // Status
  public get gameStatus() {
    return this._status;
  }

  public set gameStatus(status: PlayerGameStatus) {
    this._status = status;
  }

  // Score
  public get score(): number {
    return this._score;
  }

  public set score(amount: number) {
    this._score = amount;
  }

  // Restrictions
  public get isMuted(): boolean {
    return this._restrictionData.muted;
  }

  public set isMuted(value: boolean) {
    this._restrictionData.muted = value;
  }

  public get isRestricted(): boolean {
    return this._restrictionData.restricted;
  }

  public set isRestricted(value: boolean) {
    this._restrictionData.restricted = value;
  }

  public get isBanned(): boolean {
    return this._restrictionData.banned;
  }

  public set isBanned(value: boolean) {
    this._restrictionData.banned = value;
  }

  // Media Download Status
  public get mediaDownloaded(): boolean {
    return this._mediaDownloaded;
  }

  public set mediaDownloaded(value: boolean) {
    this._mediaDownloaded = value;
  }
}
