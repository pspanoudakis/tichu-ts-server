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

export enum GameStatus{
    INIT = 'INIT',
    IN_PROGRESS = 'IN_PROGRESS',
    OVER = 'OVER'
}

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
    private _scoreHistory = Array<RoundScore>();
    private _team02TotalPoints = 0;
    private _team13TotalPoints = 0;
    readonly winningScore: number;
    private _status: GameStatus = GameStatus.INIT;
    currentRound = new GameRoundState();

    constructor(winningScore: number = 1) {
        this.winningScore = winningScore;
    }

    get result() {
        if (!this._result)
            throw new BusinessError('Game Result not decided yet.');
        return this._result;
    }

    get scoreHistory(): readonly RoundScore[] {
        return this._scoreHistory;
    }

    get team02TotalPoints() {
        return this._team02TotalPoints;
    }

    get team13TotalPoints() {
        return this._team13TotalPoints;
    }

    get isGameOver() {
        return this._status === GameStatus.OVER;
    }

    get status() {
        return this._status;
    }

    startGame() {
        if (this._status === GameStatus.IN_PROGRESS)
            throw new BusinessError('Game already started.');
        this._status = GameStatus.IN_PROGRESS;
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
            this._team02TotalPoints >= this.winningScore ||
            this._team13TotalPoints >= this.winningScore
        );
    }

    endGameRound() {
        const score = this.currentRound.endGameRoundOrElseThrow();
        this._scoreHistory.push(score);
        this._team02TotalPoints += score.team02;
        this._team13TotalPoints += score.team13;
        if(this.mustEndGame()) {
            if (score.team02 > score.team13) {
                this._result = TEAM_KEYS.TEAM_02;
            } else if (score.team02 < score.team13) {
                this._result = TEAM_KEYS.TEAM_13;
            } else {
                this._result = 'TIE';
            }
            this._status = GameStatus.OVER;
        }
        return score;
    }

    startNewRound() {
        if (!this.currentRound.isOver) {
            throw new BusinessError(
                `The current round has not been completed yet.`
            );
        }
        this.currentRound = new GameRoundState();
    }

    onPlayerLeft(playerKey: PlayerKey) {
        switch (this._status) {
            case GameStatus.INIT:
                break;
            case GameStatus.IN_PROGRESS:
                if (TEAM_KEYS['TEAM_02'].includes(playerKey)) {
                    this._result = "TEAM_13";
                } else if (TEAM_KEYS['TEAM_13'].includes(playerKey)) {
                    this._result = "TEAM_02";
                } else {
                    throw new Error(
                        `Unexpected player key on disconnected player: ${playerKey}`
                    );
                }
                this._status = GameStatus.OVER;
                break;        
            default:
                throw new Error(
                    `Unexpected game status during client disconnection: ${this._status}`
                );
        }
    }
}
