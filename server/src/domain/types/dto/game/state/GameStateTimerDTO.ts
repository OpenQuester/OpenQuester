/**
 * State timer that allows to track time for each state
 *
 * @param startedAt - Date when the timer started (e.g. question state "showing" started)
 * @param durationMs - Initial duration of the timer in milliseconds (e.g. 30 seconds)
 * @param elapsedMs - Track elapsed time in milliseconds in case of game pause or
 * if someone starts answering (while someone answers we do not track "show question" time)
 *
 * For example: Someone chooses a question -> we receive event and start timer. With that
 * we return back event that question is chosen and send timer together with question data.
 * If game paused while showing question, we can track elapsed time and send back
 * event with pause and updated timer object.
 *
 * When game is resumed we update startedAt date to current, so, for instance,
 * initial time for question is 30 sec and game was paused for 10 seconds,
 * so we send back event with updated timer object with startedAt date set to
 * current date and elapsedMs time set to 10 seconds, therefore, the timer
 * will continue for 20 seconds more until it's oot.
 */
export interface GameStateTimerDTO {
  startedAt: Date;
  durationMs: number;
  elapsedMs: number;
  resumedAt: Date | null;
}
