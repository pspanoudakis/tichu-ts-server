import { cardColorValues, NormalCardConfig, SpecialCards } from "./CardConfig";
import { CardInfo, PhoenixCard } from "./CardInfo";

/** Represents a shuffled card deck. */
export class Deck {
    cards: CardInfo[];

    constructor() {
        // Place all the special cards first
        this.cards = [
            new CardInfo(SpecialCards.Dogs),
            new PhoenixCard(),
            new CardInfo(SpecialCards.Mahjong),
            new CardInfo(SpecialCards.Dragon),
        ];
        for (const name in NormalCardConfig) {
            for (const color of cardColorValues) {
                this.cards.push(new CardInfo(name, color));
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
