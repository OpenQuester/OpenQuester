---
title: Final Round Flow
weight: 20
---

# Final Round Implementation Guide

## Table of Contents

1. [Overview](#overview)
2. [Complete Game Flow: From Regular Rounds to Final Round](#complete-game-flow-from-regular-rounds-to-final-round)
3. [Final Round Architecture](#final-round-architecture)
4. [Implementation Guide by Phase](#implementation-guide-by-phase)
   - [Phase 1: Theme Elimination](#phase-1-theme-elimination)
   - [Phase 2: Bidding](#phase-2-bidding)
   - [Phase 3: Question Phase (Answering)](#phase-3-question-phase-answering)
   - [Phase 4: Reviewing](#phase-4-reviewing)
5. [Game State Management](#game-state-management)
6. [Constants and Configuration](#constants-and-configuration)
7. [TypeScript Interfaces Reference](#typescript-interfaces-reference)
8. [Error Handling](#error-handling)

## Overview

The Final Round is the culminating phase of the game where players compete through a structured three-phase process:

1. **Theme Elimination** - Players eliminate unwanted themes
2. **Bidding** - Players wager points on their confidence
3. **Question Answering** - Players answer the final question

This guide provides complete implementation details for frontend developers to build a robust Final Round interface.

## Complete Game Flow: From Regular Rounds to Final Round

### Game Progression Overview

```text
Regular Game Rounds → Final Round Transition → Final Round Phases → Game End
     │                      │                       │                 │
     ▼                      ▼                       ▼                 ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Round 1, 2, 3.. │    │ NEXT_ROUND      │    │ Theme Elimination│    │ Game Finished   │
│ Questions &     │───▶│ triggers        │───▶│ → Bidding       │───▶│ Winner declared │
│ Answers         │    │ Final Round     │    │ → Answering     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Transition to Final Round

**When:** After all regular rounds are completed

**How:** Showman clicks "Next Round" button

**Event:** `NEXT_ROUND` is emitted

**Result:** Game state changes to Final Round with `currentRound.type === "FINAL"`

**What happens during transition:**

1. **Game State Update**: `gameState.currentRound` becomes the final round
2. **Theme Display**: All final round themes are shown to players
3. **Question Data**: **Showman receives full question data for all themes** (for review purposes)
4. **Player Preparation**: Players see available themes and turn order
5. **Phase Initialization**: Theme elimination phase begins automatically
6. **Turn Assignment**: Current turn is assigned to the player with the lowest score

### Key Transition Events

```typescript
/** Code Example */

// 1. Showman triggers next round
socket.emit("next-round", {});

// 2. All clients receive updated game state
socket.on("next-round", (data: GameNextRoundEventPayload) => {
  const { gameState } = data;

  if (gameState.currentRound?.type === "FINAL") {
    // Final round has started
    // Theme elimination phase begins automatically
    // Show final round UI with theme elimination
    // Display themes to players
    // Showman sees all question data
    initializeFinalRound(gameState);
  }
});

// 3. FINAL_PHASE_COMPLETE indicates phase completion, not start
socket.on("final-phase-complete", (data: FinalPhaseCompleteEventData) => {
  // This event signals that a phase has completed
  // and the next phase is about to begin
  if (data.phase === "theme_elimination") {
    // Theme elimination phase has completed
    // Bidding phase will begin next
    prepareBiddingPhase(data);
  }
});
```

## Final Round Architecture

### Three-Phase Structure

```text
Phase 1: Theme Elimination
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Players eliminate themes in turn order (lowest score goes first)               │
│ • Only active players can eliminate (not spectators)                           │
│ • Showman can eliminate themes on behalf of the current turn player            │
│ • Showman observes and has access to all question data                         │
│ • Continues until only 1 theme remains                                         │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
Phase 2: Bidding
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Players submit bids (45-second timer)                                          │
│ • Players with score ≤ 1 automatically bid 1 point                            │
│ • Other players manually choose bid amount (1 to their current score)         │
│ • Phase ends when all eligible players have bid                                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
Phase 3: Question Answering
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Players answer the final question (75-second timer)                            │
│ • Text-based answers (max 500 characters)                                      │
│ • Only players who submitted bids can answer                                   │
│ • Phase ends when timer expires or all players submit                          │
│ • After this phase, the "Reviewing" phase begins                               │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
Phase 4: Reviewing
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Showman reviews and scores each player's answer                                │
│ • Empty answers are automatically reviewed as incorrect (auto-loss)            │
│ • Showman can review answers in any order                                      │
│ • After all answers are reviewed, the game finishes                            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### User Role Permissions

**Players:**

- Can eliminate themes when it's their turn
- Can submit bids (if score > 1)
- Can answer the final question
- See theme names only (not question content)

**Showman:**

- **Can eliminate themes on behalf of the current turn player** (acts as if the player made the elimination)
- **Sees full question data for all themes** (when final round starts)
- Reviews and scores final answers
- Controls game progression

**Spectators:**

- Cannot eliminate themes
- Cannot bid or answer
- Can only observe the game flow

## Implementation Guide by Phase

### Phase 1: Theme Elimination

#### Theme Elimination Overview

Players take turns eliminating unwanted themes until only one remains. Turn order is determined by current player scores (lowest scores go first).

**Important:** The showman can eliminate themes on behalf of the current turn player. This means both the current turn player and the showman can eliminate themes during any player's turn.

#### Theme Elimination Rules

- **Turn Order**: Players with lowest scores eliminate first
- **Participation**: Only active players can eliminate themes
- **Showman Authority**: **Showman can eliminate themes on behalf of the current turn player**
- **Spectator Restriction**: Spectators cannot eliminate themes
- **Showman Access**: **Showman sees all question data when final round starts**
- **Completion**: Phase ends when only one theme remains

#### Theme Elimination Events to Listen For

##### `NEXT_ROUND` (Final Round Start)

When final round begins, all clients receive the updated game state and theme elimination starts automatically.

```typescript
interface GameNextRoundEventPayload {
  gameState: GameState; // Contains final round data
}
```

**Example:**

```typescript
/** Code Example */

socket.on("next-round", (data: GameNextRoundEventPayload) => {
  const { gameState } = data;

  if (gameState.currentRound?.type === "FINAL") {
    // Final round started
    // Theme elimination phase begins automatically
    // Show all themes to players
    // Showman gets full question data in gameState
    initializeFinalRoundUI(gameState);
  }
});
```

##### `FINAL_PHASE_COMPLETE` (Phase Completion)

Signals that a phase has completed and the next phase is about to begin.

```typescript
interface FinalPhaseCompleteEventData {
  phase: "theme_elimination" | "bidding" | "answering";
  nextPhase?: "bidding" | "answering";
  timer?: GameStateTimerDTO;
}
```

**Example:**

```typescript
/** Code Example */

socket.on("final-phase-complete", (data: FinalPhaseCompleteEventData) => {
  if (data.phase === "theme_elimination") {
    // Theme elimination phase has completed
    // Bidding phase will begin next
    prepareBiddingPhase(data);
  } else if (data.phase === "bidding") {
    // Bidding phase has completed
    // Question answering phase will begin next
    prepareAnsweringPhase(data);
  }
});
```

##### `THEME_ELIMINATE` (Theme Eliminated)

Broadcast when a player eliminates a theme.

```typescript
interface ThemeEliminateOutputData {
  themeId: number;
  eliminatedBy: number; // Player ID
  nextPlayerId: number | null; // null if elimination complete
}
```

**Example:**

```typescript
/** Code Example */

socket.on("theme-eliminate", (data: ThemeEliminateOutputData) => {
  // Remove eliminated theme from UI
  // Show elimination animation
  // Update turn indicator

  if (data.nextPlayerId === null) {
    // All themes eliminated except one
    // Prepare for bidding phase transition
  } else {
    // Update UI to show next player's turn
    updateCurrentTurn(data.nextPlayerId);
  }
});
```

#### Theme Elimination Events to Send

##### `THEME_ELIMINATE`

Send when it's your turn to eliminate a theme.

```typescript
interface ThemeEliminateInputData {
  themeId: number;
}
```

**Example:**

```typescript
/** Code Example */

const eliminateTheme = (themeId: number) => {
  // Current turn player or showman can eliminate themes
  const isMyTurn = gameState.finalRoundData?.currentTurnPlayerId === myPlayerId;
  const isShowman = myRole === "showman";
  const isThemeAvailable =
    !gameState.finalRoundData?.eliminatedThemes.includes(themeId);

  if ((isMyTurn || isShowman) && isThemeAvailable) {
    socket.emit("theme-eliminate", { themeId });
  }
};
```

#### Theme Elimination UI Implementation

```typescript
/** Code Example */

interface ThemeEliminationState {
  availableThemes: Theme[];
  eliminatedThemes: number[];
  currentTurnPlayerId: number | null;
  isMyTurn: boolean;
  turnOrder: number[];
  playerRole: "player" | "showman" | "spectator";
}

// Pseudocode for theme elimination UI
function initializeThemeEliminationUI(state: ThemeEliminationState) {
  // Display current turn information
  showCurrentTurnPlayer(state.currentTurnPlayerId);

  // Render theme buttons
  state.availableThemes.forEach((theme) => {
    const button = createThemeButton(theme);

    // Enable button if user can eliminate this theme
    const canEliminate = canEliminateTheme(theme.id, state);
    button.disabled = !canEliminate;

    if (state.eliminatedThemes.includes(theme.id)) {
      button.addClass("eliminated");
    }

    // Show question data for showman
    if (state.playerRole === "showman" && theme.questions?.length > 0) {
      button.appendChild(createQuestionPreview(theme.questions[0]));
    }

    button.onClick = () => handleThemeClick(theme.id);
  });
}

function canEliminateTheme(
  themeId: number,
  state: ThemeEliminationState
): boolean {
  // Theme must be available
  if (state.eliminatedThemes.includes(themeId)) return false;

  // Players can eliminate on their turn
  if (state.playerRole === "player" && state.isMyTurn) return true;

  // Showman can eliminate on behalf of current turn player
  if (state.playerRole === "showman") return true;

  // Spectators cannot eliminate
  return false;
}

function handleThemeClick(themeId: number) {
  // Send elimination request
  socket.emit("theme-eliminate", { themeId });
}
```

### Phase 2: Bidding

### Bidding Phase Overview

Players submit bids for how many points they're willing to risk on the final question. Players with scores ≤ 1 receive automatic bids of 1 point.

### Bidding Phase Rules

- **Timer**: 45 seconds for manual bidding
- **Automatic Bids**: Players with score ≤ 1 automatically bid 1 point
- **Minimum Bid**: 1 point
- **Maximum Bid**: Player's current score
- **Completion**: Phase ends when all eligible players have submitted bids

### Bidding Phase Events to Listen For

#### `FINAL_PHASE_COMPLETE` (Bidding Phase Start)

Signals that theme elimination has completed and bidding phase is starting.

```typescript
interface FinalPhaseCompleteEventData {
  phase: "theme_elimination";
  nextPhase: "bidding";
  timer?: {
    durationMs: 45000; // 45 seconds
    startsAt: string; // ISO timestamp
  };
}
```

**Example:**

```typescript
/** Code Example */

socket.on("final-phase-complete", (data: FinalPhaseCompleteEventData) => {
  if (data.phase === "theme_elimination" && data.nextPhase === "bidding") {
    // Theme elimination completed, bidding phase starting
    // Show bidding UI
    // Start 45-second countdown timer
    // Enable bid input for eligible players
  }
});
```

#### `FINAL_BID_SUBMIT` (Broadcast)

Broadcast when a player submits a bid (manual or automatic).

```typescript
interface FinalBidSubmitOutputData {
  playerId: number;
  bidAmount: number;
  isAutomatic?: boolean;
}
```

**Example:**

```typescript
/** Code Example */

socket.on("final-bid-submit", (data: FinalBidSubmitOutputData) => {
  // Update UI to show player's bid
  // Show bid animation
  if (data.isAutomatic) {
    // Display automatic bid indicator
    // Show "Player X automatically bids 1 point"
  }
  // Update bid summary/leaderboard
});
```

#### `FINAL_QUESTION_DATA` (Bidding Complete)

Received when bidding phase completes and question phase begins.

```typescript
interface FinalQuestionEventData {
  questionData: {
    themeId: number;
    themeName: string;
    question: string;
    // Additional question metadata
  };
}
```

### Bidding Phase Events to Send

#### `FINAL_BID_SUBMIT` (Send)

Send when player submits their bid.

```typescript
interface FinalBidSubmitInputData {
  bid: number;
}
```

**Example:**

```typescript
/** Code Example */

// When player submits bid
const handleBidSubmit = (bidAmount: number) => {
  if (bidAmount >= 1 && bidAmount <= playerScore) {
    socket.emit("final-bid-submit", { bid: bidAmount });
  }
};
```

### Bidding Phase UI Implementation Guidelines

```typescript
/** Code Example */

// Example bidding UI state
interface BiddingState {
  timeRemaining: number;
  playerBids: Record<number, number>; // playerId -> bidAmount
  myBid: number | null;
  canBid: boolean; // false if score <= 1
  maxBid: number; // player's current score
}

// Bidding form validation
const validateBid = (bid: number) => {
  return bid >= 1 && bid <= playerScore && Number.isInteger(bid);
};
```

## Phase 3: Question Phase (Answering)

### Question Phase Overview

Players answer the final question with a text-based response. When the answering phase begins, the question data is sent to all players and a timer starts. Players submit their answers privately - other players see only that someone has answered, but not the actual answer content.

### Question Phase Rules

- **Timer**: 75 seconds for answering
- **Answer Format**: Text-based (max 255 characters)
- **Participation**: Only players who submitted bids can answer
- **Submission**: One answer per player
- **Auto-Loss**: Empty answers are treated as auto-loss
- **Privacy**: Answer content is hidden until all players submit
- **Timeout**: If timer expires, empty answers are auto-submitted for remaining players (meaning all of them automatically lost)

### Question Phase Events to Listen For

#### `FINAL_QUESTION_DATA` (Question Start)

Provides the final question data when answering phase begins.

```typescript
interface FinalQuestionEventData {
  questionData: {
    themeId: number;
    themeName: string;
    question: string;
    // Additional question metadata
  };
}
```

**Example:**

```typescript
/** Code Example */

socket.on("final-question-data", (data: FinalQuestionEventData) => {
  // Display the final question
  // Show theme name
  // Start 75-second answer timer
  // Enable answer input
});
```

#### `FINAL_ANSWER_SUBMIT` (Broadcast)

Broadcast when a player submits their answer (content is hidden).

```typescript
interface FinalAnswerSubmitOutputData {
  playerId: number;
  // Note: answerText is not included - answers are hidden until all submit
}
```

**Example:**

```typescript
/** Code Example */

socket.on("final-answer-submit", (data: FinalAnswerSubmitOutputData) => {
  // Update UI to show player has submitted
  // Show submission confirmation
  // Update answer status indicators
  // Note: Answer content is not revealed yet
});
```

#### `FINAL_AUTO_LOSS` (Auto-Loss Event)

Broadcast when a player submits an empty answer (auto-loss).

```typescript
interface FinalAutoLossEventData {
  playerId: number;
  reason: "EMPTY_ANSWER" | "TIMEOUT";
}
```

**Example:**

```typescript
/** Code Example */

socket.on("final-auto-loss", (data: FinalAutoLossEventData) => {
  // Show auto-loss indicator for player
  // Update UI to reflect automatic loss
});
```

#### `FINAL_SUBMIT_END` (Phase Complete)

Broadcast when all players have submitted answers and phase transitions to reviewing.

```typescript
interface FinalSubmitEndEventData {
  phase: "ANSWERING";
  nextPhase: "REVIEWING";
  allReviews: AnswerReviewData[];
}

interface AnswerReviewData {
  playerId: number;
  answerId: string;
  answerText: string;
  scoreChange: number;
  answerType: "CORRECT" | "WRONG" | "AUTO_LOSS";
  isCorrect: boolean;
}
```

**Example:**

```typescript
/** Code Example */

socket.on("final-submit-end", (data: FinalSubmitEndEventData) => {
  // All answers are now revealed
  // Display all player answers
  // Show review interface for showman
  // Transition to reviewing phase
  data.allReviews.forEach((review) => {
    displayAnswerForReview(review);
  });
});
```

### Question Phase Events to Send

#### `FINAL_ANSWER_SUBMIT` (Send)

Send when player submits their answer.

```typescript
interface FinalAnswerSubmitInputData {
  answerText: string; // Max 255 characters, empty string allowed (auto-loss)
}
```

**Example:**

```typescript
/** Code Example */

// When player submits answer
const handleAnswerSubmit = (answerText: string) => {
  if (answerText.length <= 255) {
    socket.emit("final-answer-submit", { answerText });
  }
};

// Handle empty answer (auto-loss)
const handleAutoLoss = () => {
  socket.emit("final-answer-submit", { answerText: "" });
};
```

### Question Phase UI Implementation Guidelines

```typescript
/** Code Example */

// Example answering UI state
interface AnsweringState {
  question: string;
  themeName: string;
  timeRemaining: number;
  myAnswer: string;
  hasSubmitted: boolean;
  submittedPlayers: number[];
  allAnswersRevealed: boolean;
  answerReviews: AnswerReviewData[];
}

// Answer validation
const validateAnswer = (answer: string) => {
  return answer.length <= 255; // Empty answers are allowed (auto-loss)
};

// Timer expiration handling
const handleTimerExpired = () => {
  // Timer expired - empty answers will be auto-submitted by server
  // Show timeout notification to user
  // Disable answer input
};

// Answer submission UI
const renderAnswerInput = (state: AnsweringState) => {
  if (state.hasSubmitted) {
    return (
      <div className="answer-submitted">
        <p>Answer submitted!</p>
        <p>Waiting for other players...</p>
      </div>
    );
  }

  return (
    <div className="answer-input">
      <textarea
        value={state.myAnswer}
        onChange={(e) => setMyAnswer(e.target.value)}
        maxLength={255}
        placeholder="Enter your answer..."
        disabled={state.timeRemaining <= 0}
      />
      <button
        onClick={() => handleAnswerSubmit(state.myAnswer)}
        disabled={state.timeRemaining <= 0}
      >
        Submit Answer
      </button>
      <p>Time remaining: {state.timeRemaining}s</p>
      <p>Characters: {state.myAnswer.length}/255</p>
    </div>
  );
};

// Answer review UI (for showman)
const renderAnswerReviews = (reviews: AnswerReviewData[]) => {
  return reviews.map((review) => (
    <div key={review.playerId} className="answer-review">
      <h4>Player {review.playerId}</h4>
      <p>Answer: {review.answerText || "(No answer)"}</p>
      <p>Type: {review.answerType}</p>
      {review.answerType === "AUTO_LOSS" && (
        <p className="auto-loss">Automatic loss (empty answer)</p>
      )}
    </div>
  ));
};
```

### Timer and Timeout Handling

The answering phase includes robust timeout handling:

1. **Timer Start**: 75-second countdown begins when answering phase starts
2. **Player Submission**: Players can submit answers anytime before timer expires
3. **Timer Expiration**: When timer reaches 0:
   - Empty answers are automatically submitted for players who haven't answered
   - Auto-loss events are sent for these players
   - Phase transitions to reviewing automatically
4. **Phase Completion**: When all players have submitted (manually or automatically):
   - All answers are revealed via `FINAL_SUBMIT_END` event
   - Game transitions to reviewing phase

## Phase 4: Reviewing

After all players have submitted their answers (or the timer expires), the game transitions to the **Reviewing** phase.

**Events:**

- `FINAL_ANSWER_REVIEW`: Showman submits a review for a player's answer.
- `QUESTION_FINISH`: Sent after all answers have been reviewed, signaling the end of the final round.
- `GAME_FINISHED`: Sent after `QUESTION_FINISH`, officially ending the game and declaring the winner.

**Flow:**

1. The `final-phase-complete` event for the `answering` phase is received, indicating the start of the review phase.
2. The showman's interface displays all the answers submitted by the players.
3. Answers that were not submitted (i.e., are empty) are automatically considered incorrect. The showman does not need to review these.
4. The showman can review the non-empty answers in any order they choose by sending a `FINAL_ANSWER_REVIEW` event for each one, specifying if the answer is correct or incorrect.
5. After the showman has reviewed all non-empty answers, the backend automatically processes any empty answers, and then sends the `QUESTION_FINISH` event.
6. Immediately following `QUESTION_FINISH`, the `GAME_FINISHED` event is sent, which includes the final scores and the winner of the game.

```typescript
/** Code Example */

// Showman reviews an answer
socket.emit("final-answer-review", {
  playerId: "player-id-to-review",
  correct: true, // or false
});

// Listen for the end of the question
socket.on("question-finish", (data) => {
  // Final round question is finished, prepare for game end
});

// Listen for the game to end
socket.on("game-finished", (data) => {
  // Game is over, display final results
  const { winner, players } = data;
  showWinner(winner, players);
});
```

## Game State Management

The `gameState` object is the single source of truth for the game's state. During the final round, several key properties are updated to reflect the current phase and player actions.

### Accessing Final Round State

The final round state is available through the main game state:

```typescript
interface GameState {
  finalRoundData?: {
    phase: "theme_elimination" | "bidding" | "answering" | "reviewing";
    turnOrder: number[];
    currentTurnPlayerId: number | null;
    bids: Record<number, number>; // playerId -> bidAmount
    answers: FinalRoundAnswer[];
    eliminatedThemes: number[];
  };
  questionState?: "ANSWERING" | "FINISHED";
  // ... other game state properties
}
```

### State Transitions

```text
Game Flow: Final Round Phase Transitions

Final Round Start → Theme Elimination → Bidding Phase → Question Phase → Game End
       │                   │                │              │               │
       ▼                   ▼                ▼              ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ NEXT_ROUND      │ │ FINAL_PHASE_    │ │ FINAL_PHASE_    │ │ FINAL_QUESTION_ │ │ GAME_FINISHED   │
│ event triggers  │ │ COMPLETE        │ │ COMPLETE        │ │ DATA            │ │ event           │
│ final round     │ │ (theme_elim)    │ │ (bidding)       │ │ (question data) │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
       │                   │                │              │               │
       ▼                   ▼                ▼              ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Show themes     │ │ THEME_ELIMINATE │ │ FINAL_BID_      │ │ FINAL_ANSWER_   │ │ Show final      │
│ Showman sees    │ │ events          │ │ SUBMIT events   │ │ SUBMIT events   │ │ scores          │
│ question data   │ │ (eliminate)     │ │ (bids)          │ │ (answers)       │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Event Flow Sequence

```text
Theme Elimination Phase:
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Server        │    │   Frontend      │    │   Other Players │
│                 │    │                 │    │                 │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ Send            │───▶│ Receive         │    │                 │
│ NEXT_ROUND      │    │ NEXT_ROUND      │    │                 │
│ (final)         │    │ (final)         │    │                 │
│                 │    │                 │    │                 │
│                 │    │ Player clicks   │    │                 │
│                 │◀───│ theme to        │    │                 │
│ Receive         │    │ eliminate       │    │                 │
│ THEME_ELIMINATE │    │ THEME_ELIMINATE │    │                 │
│                 │    │                 │    │                 │
│ Broadcast       │───▶│ Receive         │───▶│ Receive         │
│ THEME_ELIMINATE │    │ THEME_ELIMINATE │    │ THEME_ELIMINATE │
│ to all players  │    │ (update UI)     │    │ (update UI)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘

Bidding Phase:
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Server        │    │   Frontend      │    │   Other Players │
│                 │    │                 │    │                 │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ Send            │───▶│ Receive         │    │                 │
│ FINAL_PHASE_    │    │ FINAL_PHASE_    │    │                 │
│ COMPLETE        │    │ COMPLETE        │    │                 │
│ (45s timer)     │    │ (start timer)   │    │                 │
│                 │    │                 │    │                 │
│ Auto-bid for    │───▶│ Receive         │───▶│ Receive         │
│ low-score       │    │ FINAL_BID_      │    │ FINAL_BID_      │
│ players         │    │ SUBMIT          │    │ SUBMIT          │
│                 │    │ (automatic)     │    │ (automatic)     │
│                 │    │                 │    │                 │
│                 │    │ Player submits  │    │                 │
│                 │◀───│ manual bid      │    │                 │
│ Receive         │    │ FINAL_BID_      │    │                 │
│ FINAL_BID_      │    │ SUBMIT          │    │                 │
│ SUBMIT          │    │                 │    │                 │
│                 │    │                 │    │                 │
│ Broadcast       │───▶│ Receive         │───▶│ Receive         │
│ FINAL_BID_      │    │ FINAL_BID_      │    │ FINAL_BID_      │
│ SUBMIT          │    │ SUBMIT          │    │ SUBMIT          │
│                 │    │                 │    │                 │
│ Send            │───▶│ Receive         │───▶│ Receive         │
│ FINAL_QUESTION_ │    │ FINAL_QUESTION_ │    │ FINAL_QUESTION_ │
│ DATA            │    │ DATA            │    │ DATA            │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Constants and Configuration

### Timer Durations

- **Bidding Phase**: 45 seconds (`FINAL_ROUND_BID_TIME`)
- **Answering Phase**: 75 seconds (`GAME_FINAL_ANSWER_TIME`)

### Validation Rules

- **Minimum Bid**: 1 point (`FINAL_ROUND_MIN_BID`)
- **Maximum Answer Length**: 500 characters (`FINAL_ROUND_ANSWER_MAX_LENGTH`)

### Automatic Bid Rules

- Players with score ≤ 1 automatically bid 1 point
- Automatic bids are processed immediately when bidding phase starts

## TypeScript Interfaces Reference

### Complete Event Data Types

```typescript
/** Code Example */

// From domain/types/socket/events/FinalRoundEventData.ts

export interface ThemeEliminateInputData {
  themeId: number;
}

export interface ThemeEliminateOutputData {
  themeId: number;
  eliminatedBy: number;
  nextPlayerId: number | null;
}

export interface FinalBidSubmitInputData {
  bid: number;
}

export interface FinalBidSubmitOutputData {
  playerId: number;
  bidAmount: number;
  isAutomatic?: boolean;
}

export interface FinalAnswerSubmitInputData {
  answerText: string;
}

export interface FinalAnswerSubmitOutputData {
  playerId: number;
}

export interface FinalPhaseCompleteEventData {
  phase: FinalRoundPhase;
  nextPhase?: FinalRoundPhase;
  timer?: GameStateTimerDTO;
}

export interface FinalQuestionEventData {
  questionData: FinalRoundQuestionData;
}
```

### OpenAPI Schema References

The OpenAPI schema defines the following relevant types:

```json
{
  "FinalRoundPhase": {
    "type": "string",
    "enum": ["theme_elimination", "bidding", "answering", "reviewing"]
  },
  "FinalRoundGameData": {
    "type": "object",
    "properties": {
      "phase": { "$ref": "#/components/schemas/FinalRoundPhase" },
      "turnOrder": { "type": "array", "items": { "type": "integer" } },
      "currentTurnPlayerId": { "type": ["integer", "null"] },
      "bids": {
        "type": "object",
        "additionalProperties": { "type": "integer" }
      },
      "eliminatedThemes": { "type": "array", "items": { "type": "integer" } }
    }
  }
}
```

## Error Handling

### Common Error Scenarios

1. **Invalid Theme Elimination**

   - Eliminating a theme when it's not your turn
   - Eliminating an already eliminated theme

2. **Invalid Bid Submission**

   - Bidding less than 1 point
   - Bidding more than current score
   - Submitting bid when not eligible

3. **Invalid Answer Submission**
   - Answer text exceeding 500 characters
   - Submitting answer when not eligible
   - Submitting multiple answers

### Error Handling Example

```typescript
/** Code Example */

socket.on("error", (error) => {
  switch (error.code) {
    case "INVALID_THEME_ELIMINATION":
      // Show error message
      // Re-enable theme selection
      break;
    case "INVALID_BID":
      // Show validation error
      // Reset bid form
      break;
    case "INVALID_ANSWER":
      // Show answer validation error
      break;
  }
});
```
