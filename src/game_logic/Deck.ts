import {    
    CardColors,
    CardInfo,
    letterValues,
    PhoenixCard,
    specialCards
} from "./CardInfo";

/** Represents a shuffled card deck. */
export class Deck {
    cards: Array<CardInfo>

    constructor() {
        // Place all the special cards first
        this.cards = [
            new CardInfo(specialCards.DOGS),
            new PhoenixCard(),
            new CardInfo(specialCards.MAHJONG),
            new CardInfo(specialCards.DRAGON),
        ];

        // For each other card name, place 1 card for each color
        for (let i = 2; i <= 10; i++) {
            for (const color of Object.values(CardColors)) {
                this.cards.push(new CardInfo(i.toString(), color));
            }
        }
        for (const letter of letterValues.keys()) {
            for (const color of Object.values(CardColors)) {
                this.cards.push(new CardInfo(letter, color));
            }
        }
        this.shuffle();
    }

    /**
     * https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
     */
    private shuffle() {
        let currentIndex = this.cards.length;
        let randomIndex = -1;

        // While there remain elements to shuffle...
        while (0 !== currentIndex) {
            // Pick a remaining element...
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;

            // And swap it with the current element.
            [this.cards[currentIndex], this.cards[randomIndex]] =
                [this.cards[randomIndex], this.cards[currentIndex]];
        }
    }
}
