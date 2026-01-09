import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";

export class GameStateTimer {
  private _timer: GameStateTimerDTO | null = null;
  private _started: boolean = false;
  private _paused: boolean = false;

  constructor(private readonly durationMs: number) {
    //
  }

  /**
   * Creates a GameStateTimer from an existing DTO.
   * Useful when reconstructing timer state from persistence.
   */
  public static fromDTO(dto: GameStateTimerDTO): GameStateTimer {
    const timer = new GameStateTimer(dto.durationMs);
    timer._timer = { ...dto };
    timer._started = true;
    timer._paused = false;
    return timer;
  }

  /**
   * Starts the timer. If already started, returns the current timer value.
   * @returns The timer DTO object
   */
  public start(): GameStateTimerDTO {
    if (this._started && this._timer) {
      return this._timer;
    }

    this._timer = {
      durationMs: this.durationMs,
      elapsedMs: 0,
      startedAt: new Date(),
      resumedAt: null,
    };

    this._started = true;
    this._paused = false;

    return this._timer;
  }

  /**
   * Returns the current timer value.
   * @returns The timer DTO object or null if not started
   */
  public value(): GameStateTimerDTO | null {
    return this._timer;
  }

  /**
   * Calculates the total elapsed time in milliseconds.
   * @returns Total elapsed time in milliseconds
   */
  public getElapsedTime(): number {
    if (!this._started || !this._timer) {
      return 0;
    }

    if (this._paused) {
      return this._timer.elapsedMs;
    }

    const currentTime = Date.now();
    const startTime = new Date(this._timer.startedAt).getTime();
    return Math.min(
      this.durationMs,
      this._timer.elapsedMs + (currentTime - startTime)
    );
  }
}
