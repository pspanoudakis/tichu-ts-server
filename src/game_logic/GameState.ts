import { BusinessError } from "../responses/BusinessError";
import { GameRoundState } from "./GameRoundState"; 
import { GameWinnerResult } from "./GameWinnerResult";

const _PLAYER_KEYS = {
    PLAYER1: 'player1',
    PLAYER2: 'player2',
    PLAYER3: 'player3',
    PLAYER4: 'player4',
} as const;

export type PlayerKey = typeof _PLAYER_KEYS[keyof typeof _PLAYER_KEYS];

const TEAM_KEYS = {
    TEAM_02: 'TEAM_02',
    TEAM_13: 'TEAM_13',
} as const;

export type TeamKey = typeof TEAM_KEYS[keyof typeof TEAM_KEYS];

export const TEAM_PLAYERS = {
    [TEAM_KEYS.TEAM_02]: [_PLAYER_KEYS.PLAYER1, _PLAYER_KEYS.PLAYER3],
    [TEAM_KEYS.TEAM_13]: [_PLAYER_KEYS.PLAYER2, _PLAYER_KEYS.PLAYER4],
} as const;

export const PLAYER_KEYS = [
    _PLAYER_KEYS.PLAYER1,
    _PLAYER_KEYS.PLAYER2,
    _PLAYER_KEYS.PLAYER3,
    _PLAYER_KEYS.PLAYER4
] as const;

export class RoundScore {
    team02 = 0;
    team13 = 0;
}

export class GameState {
    private _result?: GameWinnerResult;
    scoreHistory: RoundScore[] = [];
    team02TotalPoints = 0;
    team13TotalPoints = 0;
    winningScore: number;
    gameOver = false;
    status: 'INIT' | 'IN_PROGRESS' | 'OVER' = 'INIT';
    currentRound = new GameRoundState();

    constructor(winningScore: number = 1) {
        this.winningScore = winningScore;
    }

    /**
     * Returns `true` if the game must end because the winning score
     * has been reached, `false` otherwise.
     */
    mustEndGame() {
        return (
            (
                this.winningScore === 0 &&
                this.currentRound.mustEndGameRound()
            ) ||
            this.team02TotalPoints >= this.winningScore ||
            this.team13TotalPoints >= this.winningScore
        );
    }

    endGameRound() {
        const score = this.currentRound.endGameRoundOrElseThrow();
        this.scoreHistory.push(score);
        this.team02TotalPoints += score.team02;
        this.team13TotalPoints += score.team13;
        if (score.team02 > score.team13) {
            this._result = TEAM_KEYS.TEAM_02;
        } else if (score.team02 < score.team13) {
            this._result = TEAM_KEYS.TEAM_13;
        } else {
            this._result = 'TIE';
        }
        this.gameOver = true;
        return score;
    }

    get result() {
        if (!this._result)
            throw new BusinessError('Game Result not decided yet.');
        return this._result;
    }
}
