import { CardCombination } from "./CardCombinations";
import { CardInfo, specialCards } from "./CardInfo";
import { Deck } from "./Deck";

export const playerKeys = ['player1', 'player2', 'player3', 'player4'];

/** Possible player bet points */
export enum GameBet {
    NONE = 0,
    TICHU = 100,
    GRAND_TICHU = 200
}

interface PlayerCards {
    [playerKey: string]: Array<CardInfo>
}

class RoundScore {
    team02 = 0;
    team13 = 0;
}

class TableState {
    previousCards: Array<CardInfo> = [];
    currentCards: Array<CardInfo> = [];
    currentCombination: CardCombination | null = null;
    currentCardsOwnerIndex: number = -1;
    requestedCardName: string = '';
}

export class GameboardState {
    deck = new Deck();
    playerHands: PlayerCards = {};
    playerHeaps: PlayerCards = {};
    playerTrades: {
        [playerKey: string]: Array<[string, CardInfo]>
    } = {};
    playerBets: {
        [playerKey: string]: GameBet
    } = {};
    sentTrades = 0;
    receivedTrades = 0;
    tradingPhaseCompleted = false;
    currentPlayerIndex = -1;
    pendingMahjongRequest = '';
    pendingDragonToBeGiven = false;
    pendingBombToBePlayed = false;
    tableState: TableState = new TableState();
    gameRoundWinnerKey = '';

    constructor() {
        this.handCards();
    }

    /**
     * Hands the Deck cards to the players (in round-robin order).
     */
    private handCards() {
        for (const key of playerKeys) {
            this.playerHands[key] = [];
        }
        let i = 0;
        let card;
        while ((card = this.deck.cards.pop()) !== undefined) {
            this.playerHands[playerKeys[i++]].push(card)
            i %= playerKeys.length;
        }
    }

    /**
     * Performs the desired player card trades and sets the Gameboard
     * component state accordingly.
     */
    makeCardTrades() {
        let playerHands: PlayerCards = {
            player1: [],
            player2: [],
            player3: [],
            player4: [],
        };
        playerKeys.forEach((key, index) => {
            for (const card of this.playerHands[key]) {
                if (!card.isSelected) {
                    playerHands[key].push(card);
                    if (card.name === specialCards.MAHJONG) {
                        this.currentPlayerIndex = index;
                    }
                }
            }
            for (const [, card] of this.playerTrades[key]) {
                playerHands[key].push(card);
                if (card.name === specialCards.MAHJONG) {
                    this.currentPlayerIndex = index;
                }
            }
        });
        this.playerHands = playerHands;
    }

    /**
     * Returns `true` if the current game round must end, `false` otherwise.
     */
    mustEndGameRound() {
        // End the round if both players of a team have no cards left
        if (this.playerHands[playerKeys[0]].length === 0 &&
            this.playerHands[playerKeys[2]].length === 0) {
            return true;
        }
        if (this.playerHands[playerKeys[1]].length === 0 &&
            this.playerHands[playerKeys[3]].length === 0) {
            return true;
        }
        return false;
    }

    /**
     * Calculates the score for this round.
     */
    calculateRoundScore(): RoundScore {
        let score = new RoundScore();
        let activePlayers = playerKeys.reduce((active, key) => {
            return active + (this.playerHands[key].length > 0 ? 1 : 0);
        }, 0);
        if (activePlayers > 1) {
            // More than 2 players are still active, but the round must end,
            // so one team has a clear round win:
            if (playerKeys.indexOf(this.gameRoundWinnerKey) % 2 === 0) {
                score.team02 += 200;
            }
            else {
                score.team13 += 200;
            }
        }
        else {
            // No clear round win, so evaluate the points based on each player's collected cards
            this.evaluateTeamPoints(score);
        }
        // Take the player bets into account as well
        this.evaluatePlayerBets(score);
        return score;
    }

    /**
     * Evaluates each team's points from the collected cards of each player.
     * @param gameboard: The Gameboard component.
     * @param points: A {@link RoundScore} object, with a slot to store each
     * team's points.
     */
    private evaluateTeamPoints(score: RoundScore) {
        let playerHeaps: PlayerCards = {
            player1: [],
            player2: [],
            player3: [],
            player4: []
        };
        const winnerKey = this.gameRoundWinnerKey;
        playerKeys.forEach((key, index) => {
            if (this.tableState.currentCardsOwnerIndex === index) {
                if (this.tableState.currentCards[0].name !== specialCards.DRAGON) {
                    playerHeaps[key].push(...this.tableState.currentCards,
                        ...this.tableState.previousCards);
                }
            }
            if (this.playerHands[key].length > 0) {
                if (this.tableState.currentCards[0].name === specialCards.DRAGON) {
                    playerHeaps[winnerKey].push(...this.tableState.currentCards,
                        ...this.tableState.previousCards);
                }
                playerHeaps[winnerKey].push(...playerHeaps[key], ...this.playerHeaps[key]);
                if (index % 2 === 0) {
                    score.team13 += CardInfo.evaluatePoints(this.playerHands[key]);
                }
                else {
                    score.team02 += CardInfo.evaluatePoints(this.playerHands[key]);
                }
            }
            else {
                for (const card of this.playerHeaps[key]) {
                    playerHeaps[key].push(card);
                }
            }
        });
        playerKeys.forEach((key, index) => {
            if (index % 2 === 0) {
                score.team02 += CardInfo.evaluatePoints(playerHeaps[key]);
            }
            else {
                score.team13 += CardInfo.evaluatePoints(playerHeaps[key]);
            }
        });
    }

    /**
     * Evaluates each team's points after taking the player bets into account.
     * @param gameboard The Gameboard component.
     * @param points A {@link RoundScore} object, with a slot to store each
     * team's points.
     */
    private evaluatePlayerBets(score: RoundScore) {
        playerKeys.forEach((playerKey, index) => {
            if (!this.playerBets[playerKey]) return;
            let contribution = 0;
            if (this.gameRoundWinnerKey === playerKey) {
                // Add the round winner's bet points
                contribution += this.playerBets[playerKey];
            }
            else {
                // For all other players, decrease their teams' points by their bet points.
                contribution -= this.playerBets[playerKey];
            }
            if (index % 2 === 0) {
                score.team02 += contribution;
            }
            else {
                score.team13 += contribution;
            }
        });
    }
};