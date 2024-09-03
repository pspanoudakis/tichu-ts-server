import { Bomb, CardCombination, createCombination, UnexpectedCombinationType } from "./CardCombinations";
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

    endTableRound(requestedCardName?: string) {
        this.previousCards = [];
        this.currentCards = [];
        this.currentCombination = null;
        this.currentCardsOwnerIndex = -1;
        this.requestedCardName = requestedCardName ?? '';
    }
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
     * Returns `true` if the target combination can be played on top of the current
     * table combination.
     * @param selectedCombination The target combination to be examed.
     */
    private isPlayable(selectedCombination: CardCombination) {
        if (this.tableState.currentCombination !== null) {
            if (selectedCombination instanceof Bomb) {
                if (this.tableState.currentCombination instanceof Bomb) {
                    return Bomb.compareBombs(selectedCombination, this.tableState.currentCombination) > 0;
                }
                return true;
            }
            if (selectedCombination.combination === this.tableState.currentCombination.combination) {
                return this.tableState.currentCombination.compareCombination(selectedCombination) < 0;
            }
            return false;
        }
        return true;
    }

    /**
     * Called when a player attempts to play some cards.
     * 
     * Performs all the necessary checks for the cards to be played. If they can be played,
     * the Gameboard state will be set accordingly, otherwise they will be rejected
     * and an alert message will be displayed to indicate the reason.
     * @param playerKey The key of the player.
     * @param selectedCardKeys The keys of the cards selected by the player.
     */
    playCards(playerKey: string, selectedCardKeys: string[]) {
        let newState: NewGameboardState = {};
        newState.playerHands = {};
        newState.gameRoundWinnerKey = gameboard.state.gameRoundWinnerKey;
        let requestedCard = gameboard.state.table.requestedCardName;
        let nextPlayerIndex = (gameboard.state.currentPlayerIndex + 1) % 4;

        // GameLogic.filterNextPlayerHands(gameboard, newState, allPlayerCards, selectedCards, playerKey);
        const playerHand = this.playerHands[playerKey];
        
        if (!playerHand) throw Error(`Invalid player key: ${playerKey}`);

        const selectedCards = selectedCardKeys.map(key => {
            const card = playerHand.find(c => c.key === key);
            if (!card) throw new Error(`Player does not own a card with key: ${key}`);
            return card;
        });

        let combination = createCombination( selectedCards, this.tableState.currentCards );
        if (combination !== null) {
            if (this.pendingMahjongRequest !== '') {
                // if (!GameLogic.pendingMahjongRequestCheck(gameboard, selectedCards, combination)) {
                //     return;
                // }
                requestedCard = this.pendingMahjongRequest;
            }
            else if (this.pendingBombToBePlayed) {
                // if (!GameLogic.pendingBombCheck(gameboard, combination)) {
                //     return;
                // }
            }
            else if (this.tableState.requestedCardName !== '') {
                // if (!GameLogic.requestedCardCheck(gameboard, allPlayerCards, selectedCards, combination)) {
                //     return;
                // }
            }
            else {
                if (!this.isPlayable(this.tableState.currentCombination, combination) ) {
                    // window.alert("This combination cannot be played");
                    return;
                }
            }
            if (selectedCards[0].name === specialCards.DOGS) {
                nextPlayerIndex = (this.currentPlayerIndex + 2) % 4;
                selectedCards = [];
                combination = null;
            }
            let requestObject: RequestedCardObject = { card: requestedCard };
            if (this.pendingMahjongRequest === '') {
                // GameLogic.attemptToSatisfyRequest(requestObject, selectedCards);
            }
            while (this.playerHands[playerKeys[nextPlayerIndex]].length === 0) {
                nextPlayerIndex = (nextPlayerIndex + 1) % 4;
            }
            if (newState.gameRoundWinnerKey === '' && newState.playerHands[playerKey].length === 0) {
                newState.gameRoundWinnerKey = playerKey;
            }
            // GameLogic.setAfterPlayState(gameboard, selectedCards, newState, combination,
            //                             nextPlayerIndex, requestObject.card);
        }
        else {
            throw new Error('Invalid card combination');
        }
    }

    /**
     * Returns `true` if the player with the specified cards can pass, based on the
     * requested card and the current table combination.
     * @param playerCards The player's cards.
     */
    canPassTurn(playerCards: Array<CardInfo>) {
        if (this.tableState.requestedCardName === "") { return true; }
        if (this.tableState.currentCombination !== null) {
            switch(this.tableState.currentCombination.combination) {
                case cardCombinations.BOMB:
                    return this.tableState.currentCombination.compare(
                        playerCards,
                        this.tableState.requestedCardName
                    ) >= 0;
                case cardCombinations.SINGLE:
                case cardCombinations.COUPLE:
                case cardCombinations.TRIPLET:
                case cardCombinations.FULLHOUSE:
                    if (
                        this.tableState.currentCombination.compare(
                            playerCards, this.tableState.requestedCardName
                        ) < 0
                    ) return false;
                    break;
                case cardCombinations.STEPS:
                case cardCombinations.KENTA:
                    if (
                        this.tableState.currentCombination.compare(
                            playerCards, 
                            this.tableState.requestedCardName, 
                            this.tableState.currentCombination.length
                        ) < 0
                    ) return false;
                    break;
                default:
                    throw new UnexpectedCombinationType(tableCombination.combination);
            }
            return Bomb.getStrongestRequested(playerCards, this.tableState.requestedCardName) === null;
        }
        return false;
    }

    /**
     * Called when the current player has chosen to pass.
     * 
     * If this is acceptable, the Gameboard state will be changed (it will be the next player's turn,
     * and if the next player is the owner of the currently on-table cards, the round will end).
     * Otherwise, an alert message will be displayed, and the current player will be forced to play.
     */
    passTurn() {
        let nextPlayerIndex = (this.currentPlayerIndex + 1) % 4;
        while (this.playerHands[playerKeys[nextPlayerIndex]].length === 0) {
            if (nextPlayerIndex === this.tableState.currentCardsOwnerIndex) {
                this.endTableRound();
            }
            nextPlayerIndex = (nextPlayerIndex + 1) % 4;
        }
        if (nextPlayerIndex === this.tableState.currentCardsOwnerIndex) {
            this.endTableRound();
        }
        this.currentPlayerIndex = nextPlayerIndex;
    }

    /**
     * Forces the on-table cards owner to choose an active opponent to hand the table cards to,
     * by setting the Gameboard component state accordingly.
     */
    onPendingDragon() {
        this.currentPlayerIndex = this.tableState.currentCardsOwnerIndex;
        this.pendingDragonToBeGiven = true;
    }

    /**
     * If the current game round can end normally, sets the new Gameboard component state accordingly,
     * or sets up a Dragon card decision state
     * 
     * The currently on-table cards are handed to their owner (unless the Dragon is the top card,
     * where the owner has to choose an active opponent to hand the cards to).
     */
    endTableRound() {
        // Preparing for new round
        if (this.tableState.currentCards[0].name === specialCards.DRAGON) {
            this.onPendingDragon();
            return;
        }
        this.playerHeaps[playerKeys[this.tableState.currentCardsOwnerIndex]]?.push(
            ...this.tableState.previousCards, ...this.tableState.currentCards
        );
        this.tableState.endTableRound();
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
    calculateGameRoundScore(): RoundScore {
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
     * @param score: A {@link RoundScore} object, with a slot to store each
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
     * @param score A {@link RoundScore} object, with a slot to store each
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