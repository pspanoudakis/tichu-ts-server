import { GiveDragonEvent, RequestCardEvent } from "../schemas/events/ClientEvents";
import { BusinessError } from "./BusinessError";
import { 
    Bomb, 
    CardCombination, 
    CardCombinationType, 
    createCombination, 
    SingleCard,
    UnexpectedCombinationType
} from "./CardCombinations";
import { SpecialCards } from "./CardConfig";
import { CardInfo } from "./CardInfo";
import { Deck } from "./Deck";
import { RoundScore } from "./GameState";
import { PLAYER_KEYS, PlayerKey, TEAM_KEYS, TEAM_PLAYERS } from "./PlayerKeys";
import { PlayerState } from "./PlayerState";
import { TableState } from "./TableState";

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

export class GameRoundState {
    players: { [playerKey in PlayerKey]: PlayerState } = {
        player1: new PlayerState('player1'),
        player2: new PlayerState('player2'),
        player3: new PlayerState('player3'),
        player4: new PlayerState('player4')
    }
    private deck = new Deck();
    private _currentPlayerIndex = -1;
    private _pendingDragonToBeGiven = false;
    private pendingBombToBePlayed = false;
    private _requestedCardName: string = '';
    private table: TableState = new TableState();
    private gameRoundWinnerKey: PlayerKey | '' = '';
    private _isOver = false;

    constructor() {
        this.handCards();
    }

    get currentPlayerIndex() {
        return this._currentPlayerIndex;
    }

    get pendingDragonToBeGiven() {
        return this._pendingDragonToBeGiven;
    }

    get requestedCardName() {
        return this._requestedCardName;
    }

    get isOver() {
        return this._isOver;
    }

    get currentTableCombination() {
        return this.table.currentCombination;
    }

    get currentTableCardsOwnerIdx() {
        return this.table.currentCardsOwnerIndex;
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
        if (this.table.currentCombination !== null) {
            if (selectedCombination instanceof Bomb) {
                if (this.table.currentCombination instanceof Bomb) {
                    return Bomb.compareBombs(
                        selectedCombination, this.table.currentCombination
                    ) > 0;
                }
                return true;
            }
            if (selectedCombination.type === this.table.currentCombination.type) {
                return this.table.currentCombination
                    .compareCombination(selectedCombination) < 0;
            }
            return false;
        }
        return true;
    }

    /**
    * Performs all the checks that are demanded when there is a pending Bomb to be played.
    * Throws if any checks are not passed.
    * @param combination The combination to be played.
    */
    private throwIfPendingBombCheckFailed(combination: CardCombination) {
        if (!this.pendingBombToBePlayed) return;
        if (combination instanceof Bomb) {
            const tableCombination = this.table.currentCombination;
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
        const requestedCardName = this._requestedCardName;
        if (this.table.currentCombination === null) {
            // See if there is *any* valid combination with the requested card
            if (SingleCard.getStrongestRequested(selectedCards, requestedCardName) === null &&
                SingleCard.getStrongestRequested(allPlayerCards, requestedCardName) !== null) {
                return false;
            }
            return true;
        }
        else {
            switch (this.table.currentCombination.type) {
                case CardCombinationType.BOMB:
                    return true;
                case CardCombinationType.SINGLE:
                case CardCombinationType.COUPLE:
                case CardCombinationType.TRIPLET:
                case CardCombinationType.FULLHOUSE:
                    if (this.table.currentCombination.compare(allPlayerCards, requestedCardName) < 0) {
                        if (!selectedCards.some(card => card.name === requestedCardName)) {
                            return false;
                        }
                    }
                    break;
                case CardCombinationType.STEPS:
                case CardCombinationType.KENTA:
                    if (
                        this.table.currentCombination.compare(
                            allPlayerCards,
                            requestedCardName,
                            this.table.currentCombination.length
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
        if (!this._requestedCardName) return;
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
    playCardsOrElseThrow(player: PlayerState, selectedCardKeys: string[]) {
        if (!(PLAYER_KEYS[this._currentPlayerIndex] === player.playerKey)) {
            throw new BusinessError(`It is not '${player.playerKey}' turn to play.`);
        }
        const playerHand = player.getCards();
        const selectedCards = player.getCardsByKeys(selectedCardKeys);

        let selectedCombination = createCombination(
            selectedCards, this.table.currentCards
        );
        if (selectedCombination !== null) {
            this.throwIfPendingBombCheckFailed(selectedCombination);
            this.throwIfRequestedCardCheckFailed(
                playerHand, selectedCards, selectedCombination
            );
            if (!this.isPlayable(selectedCombination)) {
                throw new BusinessError(
                    "The selected combination cannot be played."
                );
            }

            // Checks done, setting up new state
            player.removeCards(selectedCards);
            this.table.onCardsPlayed(
                selectedCards, selectedCombination, this._currentPlayerIndex
            );
            this._pendingDragonToBeGiven = false;
            this.pendingBombToBePlayed = false;
            
            let nextPlayerIndex = (this._currentPlayerIndex + 1) % 4;
            if (this.table.currentCards[0].name === SpecialCards.Dogs) {
                nextPlayerIndex = (this._currentPlayerIndex + 2) % 4;
                // Clear table cards
                this.table.endTableRound();
            }
            if (this._requestedCardName !== "") {
                if (this.table.currentCards.some(
                    card => card.name === this._requestedCardName
                )) {
                    this._requestedCardName = "";
                }
            }
            while (this.players[PLAYER_KEYS[nextPlayerIndex]].getNumCards() === 0) {
                nextPlayerIndex = (nextPlayerIndex + 1) % 4;
            }
            if (this.gameRoundWinnerKey === '' && player.getNumCards() === 0) {
                this.gameRoundWinnerKey = player.playerKey;
            }
            this._currentPlayerIndex = nextPlayerIndex;
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
    private throwIfCannotPass(player: PlayerState) {
        if (player.playerKey !== PLAYER_KEYS[this._currentPlayerIndex])
            throw new BusinessError(`It is not this player's turn.`);
        if (this.pendingBombToBePlayed)
            throw new BusinessError('A Bomb must be played.');
        if (this._pendingDragonToBeGiven)
            throw new BusinessError('Cannot pass during a pending dragon decision.');
        if (this.table.currentCombination === null)
            throw new BusinessError('The table round starter cannot pass.');
        if (this._requestedCardName === "") return;
        const playerCards = player.getCards();
        switch (this.table.currentCombination.type) {
            case CardCombinationType.BOMB:
                if (this.table.currentCombination.compare(
                    playerCards,
                    this._requestedCardName
                ) < 0)
                    throw new BusinessError(
                        'The majong request must be satisfied by using a bomb.'
                    );
                break;
            case CardCombinationType.SINGLE:
            case CardCombinationType.COUPLE:
            case CardCombinationType.TRIPLET:
            case CardCombinationType.FULLHOUSE:
                if (this.table.currentCombination.compare(
                    playerCards, this._requestedCardName
                ) < 0)
                    throw new BusinessError('The majong request must be satisfied.');
                break;
            case CardCombinationType.STEPS:
            case CardCombinationType.KENTA:
                if (this.table.currentCombination.compare(
                    playerCards,
                    this._requestedCardName,
                    this.table.currentCombination.length
                ) < 0)
                    throw new BusinessError('The majong request must be satisfied.');
                break;
            default:
                throw new UnexpectedCombinationType(this.table.currentCombination.type);
        }
        if (Bomb.getStrongestRequested(playerCards, this._requestedCardName))
            throw new BusinessError('The majong request must be satisfied by using a bomb.');
    }

    /**
     * Called when the current player has chosen to pass.
     * 
     * If this is acceptable, the Gameboard state will be changed (it will be the next player's turn,
     * and if the next player is the owner of the currently on-table cards, the round will end).
     * Otherwise, an alert message will be displayed, and the current player will be forced to play.
     */
    passTurnOrElseThrow(player: PlayerState) {
        this.throwIfCannotPass(player);
        let nextPlayerIndex = (this._currentPlayerIndex + 1) % 4;
        while (this.players[PLAYER_KEYS[nextPlayerIndex]].getNumCards() === 0) {
            if (nextPlayerIndex === this.table.currentCardsOwnerIndex) {
                this.endTableRound();
            }
            nextPlayerIndex = (nextPlayerIndex + 1) % 4;
        }
        if (nextPlayerIndex === this.table.currentCardsOwnerIndex) {
            this.endTableRound();
        }
        this._currentPlayerIndex = nextPlayerIndex;
    }

    enablePendingBombOrElseThrow(player: PlayerState) {
        if (this.pendingBombToBePlayed)
            throw new BusinessError('A pending Bomb is about to be played.');
        if (this._pendingDragonToBeGiven)
            throw new BusinessError('Cannot drop a Bomb during a pending dragon decision.');
        const bomb = Bomb.getStrongestBomb(player.getCards());
        if (bomb === null)
            throw new BusinessError('This player has no possible bomb combinations');
        if (this.table.currentCombination instanceof Bomb &&
            Bomb.compareBombs(this.table.currentCombination, bomb) >= 0
        )
            throw new BusinessError(
                'This player cannot play a Bomb on top of the current combination.'
            );
        const playerIdx = PLAYER_KEYS.indexOf(player.playerKey);
        if (this.table.currentCombination === null && this._currentPlayerIndex !== playerIdx)
            throw new BusinessError(
                'This player cannot stop the game to play a bomb at this point.'
            );
        this.pendingBombToBePlayed = true;
        this._currentPlayerIndex = playerIdx;
    }

    setRequestedCardOrElseThrow(player: PlayerState, e: RequestCardEvent) {
        if (player.playerKey !== PLAYER_KEYS[this._currentPlayerIndex])
            throw new BusinessError(`It is not this player's turn.`);
        if (this._requestedCardName)
            throw new BusinessError('A card has already been requested.');
        if (!player.hasMahjong())
            throw new BusinessError('Cannot request a card without owning Majong');
        this._requestedCardName = e.data.requestedCardName;
    }

    giveDragonOrElseThrow(player: PlayerState, e: GiveDragonEvent) {
        if (player.playerKey !== PLAYER_KEYS[this._currentPlayerIndex])
            throw new BusinessError(`It is not this player's turn.`);
        if (!this._pendingDragonToBeGiven)
            throw new BusinessError('No pending dragon decision state stored.');
        const chosenPlayer = this.players[e.data.chosenOponentKey];
        if (!chosenPlayer)
            throw new BusinessError('Invalid player key to give dragon to.');
        chosenPlayer.addCardsToHeap(...this.table.endTableRound());
        this._pendingDragonToBeGiven = false;
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
        if (this.table.currentCards[0].name === SpecialCards.Dragon) {
            this._currentPlayerIndex = this.table.currentCardsOwnerIndex;
            this._pendingDragonToBeGiven = true;
            return;
        }
        this.players[PLAYER_KEYS[this.table.currentCardsOwnerIndex]]
            .addCardsToHeap(
                ...this.table.previousCards,
                ...this.table.currentCards
            );
        this.table = new TableState();
    }

    /**
     * Returns `true` if the current game round must end, `false` otherwise.
     */
    mustEndGameRound() {
        // End the round if both players of a team have no cards left
        return Object.values(TEAM_KEYS).some(
            tk => TEAM_PLAYERS[tk].every(
                pk => this.players[pk].getNumCards() === 0
            )
        );
    }

    endGameRoundOrElseThrow() {
        if (!this.mustEndGameRound())
            throw new BusinessError('Cannot end game round.');
        this._isOver = true;
        return this.calculateGameRoundScore();
    }

    /**
     * Calculates the score for this round.
     */
    calculateGameRoundScore(): RoundScore {
        let score: RoundScore = {
            team02: 0,
            team13: 0,
        };
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
            if (this.table.currentCardsOwnerIndex === index) {
                if (this.table.currentCards[0].name !== SpecialCards.Dragon) {
                    playerHeaps[key].push(
                        ...this.table.currentCards,
                        ...this.table.previousCards
                    );
                }
            }
            if (this.players[key].getNumCards() > 0) {
                if (this.table.currentCards[0].name === SpecialCards.Dragon) {
                    playerHeaps[this.gameRoundWinnerKey].push(
                        ...this.table.currentCards,
                        ...this.table.previousCards
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