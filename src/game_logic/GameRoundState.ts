import { BusinessError } from "../responses/BusinessError";
import { 
    Bomb, 
    CardCombination, 
    CardCombinationType, 
    createCombination, 
    SingleCard,
    UnexpectedCombinationType
} from "./CardCombinations";
import { CardInfo, specialCards } from "./CardInfo";
import { Deck } from "./Deck";
import { PLAYER_KEYS, PlayerKey, RoundScore } from "./GameState";
import { PlayerState } from "./PlayerState";

/** Possible player bet points */
export enum GameBet {
    NONE = 0,
    TICHU = 100,
    GRAND_TICHU = 200
}
class PlayerCards {
    player1 = Array<CardInfo>();
    player2 = Array<CardInfo>();
    player3 = Array<CardInfo>();
    player4 = Array<CardInfo>();
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

export class GameRoundState {
    players: { [playerKey in PlayerKey]: PlayerState } = {
        player1: new PlayerState('player1'),
        player2: new PlayerState('player2'),
        player3: new PlayerState('player3'),
        player4: new PlayerState('player4')
    }
    deck = new Deck();
    tradingPhaseCompleted = false;
    currentPlayerIndex = -1;
    pendingMahjongRequest = '';
    pendingDragonToBeGiven = false;
    pendingBombToBePlayed = false;
    tableState: TableState = new TableState();
    gameRoundWinnerKey: PlayerKey | '' = '';

    constructor() {
        this.handCards();
    }

    /**
     * Hands the Deck cards to the players (in round-robin order).
     */
    private handCards() {
        let tempHands = new PlayerCards();
        let i = 0;
        let card;
        while ((card = this.deck.cards.pop()) !== undefined) {
            tempHands[PLAYER_KEYS[i++]].push(card)
            i %= PLAYER_KEYS.length;
        }
        PLAYER_KEYS.forEach(k => this.players[k].handCards(tempHands[k]));
    }

    makeCardTrades() {
        for (let i = 0; i < PLAYER_KEYS.length; i++) {
            const teammate = this.players[PLAYER_KEYS[
                (i + 2) % PLAYER_KEYS.length
            ]];
            const rightOp = this.players[PLAYER_KEYS[
                (i + 1) % PLAYER_KEYS.length
            ]];
            const leftOp = this.players[PLAYER_KEYS[
                (i > 0) ? (i - 1) : (PLAYER_KEYS.length - 1)
            ]];
            this.players[PLAYER_KEYS[i]].incomingTrades = {
                teammate: teammate.tradeDecisions.teammate,
                left: leftOp.tradeDecisions.right,
                right: rightOp.tradeDecisions.left,
            }
        }
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
            if (selectedCombination.type === this.tableState.currentCombination.type) {
                return this.tableState.currentCombination.compareCombination(selectedCombination) < 0;
            }
            return false;
        }
        return true;
    }

    /**
     * Performs all the checks that are demanded when there is a pending Mahjong request.
     * Throws if any checks are not passed.
     * @param selectedCards The current player's selected cards.
     * @param combination The combination to be played.
     */
    private throwIfMahjongRequestCheckFailed(selectedCards: CardInfo[], combination: CardCombination) {
        // If there is a pending mahjong request, the player must play the Mahjong
        if (!selectedCards.some(card => card.name === specialCards.MAHJONG)) {
            throw new BusinessError("The Mahjong must be played after a Mahjong request");
        }
        if (!this.isPlayable(combination)) {
            throw new BusinessError("This combination cannot be played");
        }
    }

    /**
    * Performs all the checks that are demanded when there is a pending Bomb to be played.
    * Throws if any checks are not passed.
    * @param combination The combination to be played.
    */
    private throwIfPendingBombCheckFailed(combination: CardCombination) {
        if (combination instanceof Bomb) {
            const tableCombination = this.tableState.currentCombination;
            if (tableCombination !== null && tableCombination instanceof Bomb) {
                if (Bomb.compareBombs(tableCombination, combination) >= 0) {
                    throw new BusinessError("The selected combination cannot be played");
                }
            }
        }
        else {
            throw new BusinessError("A bomb must be played");
        }
    }

    /**
     * Returns `true` if the currently selected combination complies with the Mahjong request,
     * `false` otherwise.
     * @param allPlayerCards The target player's cards, **both** selected and non-selected.
     * @param selectedCombination The combination that is created from the **selected** cards.
     * @param selectedCards The selected cards.
     */
    private isMahjongCompliant(
        allPlayerCards: Array<CardInfo>,
        selectedCombination: CardCombination,
        selectedCards: Array<CardInfo>
    ) {
        if (selectedCombination.type === CardCombinationType.BOMB) { return true; }
        const requestedCardName = this.tableState.requestedCardName;
        if (this.tableState.currentCombination === null) {
            // See if there is *any* valid combination with the requested card
            if (SingleCard.getStrongestRequested(selectedCards, requestedCardName) === null &&
                SingleCard.getStrongestRequested(allPlayerCards, requestedCardName) !== null) {
                return false;
            }
            return true;
        }
        else {
            switch (this.tableState.currentCombination.type) {
                case CardCombinationType.BOMB:
                    return true;
                case CardCombinationType.SINGLE:
                case CardCombinationType.COUPLE:
                case CardCombinationType.TRIPLET:
                case CardCombinationType.FULLHOUSE:
                    if (this.tableState.currentCombination.compare(allPlayerCards, requestedCardName) < 0) {
                        if (!selectedCards.some(card => card.name === requestedCardName)) {
                            return false;
                        }
                    }
                    break;
                case CardCombinationType.STEPS:
                case CardCombinationType.KENTA:
                    if (
                        this.tableState.currentCombination.compare(
                            allPlayerCards,
                            requestedCardName,
                            this.tableState.currentCombination.length
                        ) < 0
                    ) {
                        if (!selectedCards.some(card => card.name === requestedCardName)) {
                            return false;
                        }
                    }
                    break;
                default:
                    return false;
            }
            return true;
        }
    }

    /**
    * Performs all the checks that are demanded when there is an unsatisfied Mahjong request.
    * Throws if any checks are not passed.
    * 
    * @param allPlayerCards All the current player's cards.
    * @param selectedCards The current player's selected cards.
    * @param combination The combination which is created by the selected cards.
    */
    private throwIfRequestedCardCheckFailed(
        allPlayerCards: CardInfo[],
        selectedCards: CardInfo[],
        combination: CardCombination
    ) {
        if (!this.isMahjongCompliant(
            allPlayerCards,
            combination,
            selectedCards
        )) {
            throw new BusinessError("A combination which contains the requested card is required.");
        }
        if (!this.isPlayable(combination)) {
            throw new BusinessError("This combination cannot be played");
        }
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
    playCards(playerKey: PlayerKey, selectedCardKeys: string[]) {
        if (!(PLAYER_KEYS[this.currentPlayerIndex] === playerKey)) {
            throw new BusinessError(`It is not '${playerKey}' turn to play.`);
        }
        const player = this.players[playerKey];
        const playerHand = player.getCards();
        const selectedCards = player.getCardsByKeys(selectedCardKeys);

        let selectedCombination = createCombination(
            selectedCards, this.tableState.currentCards
        );
        if (selectedCombination !== null) {
            if (this.pendingMahjongRequest !== '') {
                this.throwIfMahjongRequestCheckFailed(
                    selectedCards, selectedCombination
                );
                this.tableState.requestedCardName = this.pendingMahjongRequest;
            }
            else if (this.pendingBombToBePlayed) {
                this.throwIfPendingBombCheckFailed(selectedCombination);
            }
            else if (this.tableState.requestedCardName !== '') {
                this.throwIfRequestedCardCheckFailed(
                    playerHand, selectedCards, selectedCombination
                );
            }
            else {
                if (!this.isPlayable(selectedCombination)) {
                    throw new BusinessError(
                        "The selected combination cannot be played."
                    );
                }
            }

            // Checks done, setting up new state
            player.removeCards(selectedCards);
            this.tableState.previousCards.push(...this.tableState.currentCards)
            this.tableState.currentCards = selectedCards;
            this.tableState.currentCombination = selectedCombination;
            this.tableState.currentCardsOwnerIndex = this.currentPlayerIndex;
            this.pendingDragonToBeGiven = false;
            this.pendingBombToBePlayed = false;
            this.pendingMahjongRequest = '';
            
            let nextPlayerIndex = (this.currentPlayerIndex + 1) % 4;
            if (this.tableState.currentCards[0].name === specialCards.DOGS) {
                nextPlayerIndex = (this.currentPlayerIndex + 2) % 4;
                this.tableState.currentCards = [];
                this.tableState.currentCombination = null;
            }
            if (this.pendingMahjongRequest === '') {
                if (this.tableState.requestedCardName !== "") {
                    if (this.tableState.currentCards.some(
                        card => card.name === this.tableState.requestedCardName
                    )) {
                        this.tableState.requestedCardName = "";
                    }
                }
            }
            while (this.players[PLAYER_KEYS[nextPlayerIndex]].getNumCards() === 0) {
                nextPlayerIndex = (nextPlayerIndex + 1) % 4;
            }
            if (this.gameRoundWinnerKey === '' && player.getNumCards() === 0) {
                this.gameRoundWinnerKey = playerKey;
            }
            this.currentPlayerIndex = nextPlayerIndex;
        }
        else {
            throw new BusinessError('Invalid or unplayable combination.');
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
            switch (this.tableState.currentCombination.type) {
                case CardCombinationType.BOMB:
                    return this.tableState.currentCombination.compare(
                        playerCards,
                        this.tableState.requestedCardName
                    ) >= 0;
                case CardCombinationType.SINGLE:
                case CardCombinationType.COUPLE:
                case CardCombinationType.TRIPLET:
                case CardCombinationType.FULLHOUSE:
                    if (
                        this.tableState.currentCombination.compare(
                            playerCards, this.tableState.requestedCardName
                        ) < 0
                    ) return false;
                    break;
                case CardCombinationType.STEPS:
                case CardCombinationType.KENTA:
                    if (
                        this.tableState.currentCombination.compare(
                            playerCards,
                            this.tableState.requestedCardName,
                            this.tableState.currentCombination.length
                        ) < 0
                    ) return false;
                    break;
                default:
                    throw new UnexpectedCombinationType(this.tableState.currentCombination.type);
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
        while (this.players[PLAYER_KEYS[nextPlayerIndex]].getNumCards() === 0) {
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
        this.players[PLAYER_KEYS[this.tableState.currentCardsOwnerIndex]]
            .addCardsToHeap(
                ...this.tableState.previousCards,
                ...this.tableState.currentCards
            );
        this.tableState.endTableRound();
    }

    /**
     * Returns `true` if the current game round must end, `false` otherwise.
     */
    mustEndGameRound() {
        // End the round if both players of a team have no cards left
        if (this.players[PLAYER_KEYS[0]].getNumCards() === 0 &&
            this.players[PLAYER_KEYS[2]].getNumCards() === 0) {
            return true;
        }
        if (this.players[PLAYER_KEYS[1]].getNumCards() === 0 &&
            this.players[PLAYER_KEYS[3]].getNumCards() === 0) {
            return true;
        }
        return false;
    }

    /**
     * Calculates the score for this round.
     */
    calculateGameRoundScore(): RoundScore {
        let score = new RoundScore();
        let activePlayers = PLAYER_KEYS.reduce((active, key) => {
            return active + (this.players[key].getNumCards() > 0 ? 1 : 0);
        }, 0);
        if (!this.gameRoundWinnerKey)
            throw new Error('Unexpected Error: Game Round Winner not set.');
        if (activePlayers > 1) {
            // More than 2 players are still active, but the round must end,
            // so one team has a clear round win:
            if (PLAYER_KEYS.indexOf(this.gameRoundWinnerKey) % 2 === 0) {
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
        let playerHeaps = new PlayerCards();        
        PLAYER_KEYS.forEach((key, index) => {
            if (!this.gameRoundWinnerKey)
                throw new Error('Unexpected Error: Game Round Winner not set.');
            if (this.tableState.currentCardsOwnerIndex === index) {
                if (this.tableState.currentCards[0].name !== specialCards.DRAGON) {
                    playerHeaps[key].push(
                        ...this.tableState.currentCards,
                        ...this.tableState.previousCards
                    );
                }
            }
            if (this.players[key].getNumCards() > 0) {
                if (this.tableState.currentCards[0].name === specialCards.DRAGON) {
                    playerHeaps[this.gameRoundWinnerKey].push(
                        ...this.tableState.currentCards,
                        ...this.tableState.previousCards
                    );
                }
                playerHeaps[this.gameRoundWinnerKey].push(
                    ...playerHeaps[key],
                    ...this.players[key].heap
                );
                if (index % 2 === 0) {
                    score.team13 += CardInfo.evaluatePoints(this.players[key].getCards());
                }
                else {
                    score.team02 += CardInfo.evaluatePoints(this.players[key].getCards());
                }
            }
            else {
                for (const card of this.players[key].heap) {
                    playerHeaps[key].push(card);
                }
            }
        });
        PLAYER_KEYS.forEach((key, index) => {
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
        PLAYER_KEYS.forEach((playerKey, index) => {
            if (!this.players[playerKey].bet) return;
            let contribution = 0;
            if (this.gameRoundWinnerKey === playerKey) {
                // Add the round winner's bet points
                contribution += this.players[playerKey].bet;
            }
            else {
                // For all other players, decrease their teams' points by their bet points.
                contribution -= this.players[playerKey].bet;
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