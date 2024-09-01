import { GameboardState } from "./GameboardState";

export class GameState {
    scoreHistory: Array<[number, number]> = [];
    team02TotalPoints = 0;
    team13TotalPoints = 0;
    winningScore: number;
    gameOver = false;
    currentGameboardState = new GameboardState();

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
                this.currentGameboardState.mustEndGameRound()
            ) ||
            this.team02TotalPoints >= this.winningScore ||
            this.team13TotalPoints >= this.winningScore
        );
    }
}
