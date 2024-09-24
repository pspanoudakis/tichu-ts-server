export const CardColor = {
    BLACK: 'black',
    RED: 'red',
    BLUE: 'blue',
    GREEN: 'green'
} as const;

type NumericCardName = 
    '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10';

type LetterCardName = 'J' | 'Q' | 'K' | 'A';
export const LetterCardValues: {
    [l in LetterCardName]: number
} = {
    'J': 11,
    'Q': 12,
    'K': 13,
    'A': 14,
} as const;

type SpecialCardName =
    'Dogs' | 'Phoenix' | 'Mahjong' | 'Dragon';
export const SpecialCards: {
    [name in SpecialCardName]: string
} = {
    Dogs: 'Dogs',
    Dragon: 'Dragon',
    Mahjong: 'Mahjong',
    Phoenix: 'Phoenix',
} as const;

type NormalCardName = NumericCardName | LetterCardName;

const NormalCardConfig: {
    [name in NormalCardName]: {
        [color in typeof CardColor[keyof typeof CardColor]]: {
            key: string,
            img: string,
        }
    }
} = {
    "2": {
        red: {
            key: "red_2",
            img: "red_2.png"
        },
        black: {
            key: "black_2",
            img: "black_2.png"
        },
        blue: {
            key: "blue_2",
            img: "blue_2.png"
        },
        green: {
            key: "green_2",
            img: "green_2.png"
        },
    },
    "3": {
        red: {
            key: "red_3",
            img: "red_3.png"
        },
        black: {
            key: "black_3",
            img: "black_3.png"
        },
        blue: {
            key: "blue_3",
            img: "blue_3.png"
        },
        green: {
            key: "green_3",
            img: "green_3.png"
        },
    },
    "4": {
        red: {
            key: "red_4",
            img: "red_4.png"
        },
        black: {
            key: "black_4",
            img: "black_4.png"
        },
        blue: {
            key: "blue_4",
            img: "blue_4.png"
        },
        green: {
            key: "green_4",
            img: "green_4.png"
        },
    },
    "5": {
        red: {
            key: "red_5",
            img: "red_5.png"
        },
        black: {
            key: "black_5",
            img: "black_5.png"
        },
        blue: {
            key: "blue_5",
            img: "blue_5.png"
        },
        green: {
            key: "green_5",
            img: "green_5.png"
        },
    },
    "6": {
        red: {
            key: "red_6",
            img: "red_6.png"
        },
        black: {
            key: "black_6",
            img: "black_6.png"
        },
        blue: {
            key: "blue_6",
            img: "blue_6.png"
        },
        green: {
            key: "green_6",
            img: "green_6.png"
        },
    },
    "7": {
        red: {
            key: "red_7",
            img: "red_7.png"
        },
        black: {
            key: "black_7",
            img: "black_7.png"
        },
        blue: {
            key: "blue_7",
            img: "blue_7.png"
        },
        green: {
            key: "green_7",
            img: "green_7.png"
        },
    },
    "8": {
        red: {
            key: "red_8",
            img: "red_8.png"
        },
        black: {
            key: "black_8",
            img: "black_8.png"
        },
        blue: {
            key: "blue_8",
            img: "blue_8.png"
        },
        green: {
            key: "green_8",
            img: "green_8.png"
        },
    },
    "9": {
        red: {
            key: "red_9",
            img: "red_9.png"
        },
        black: {
            key: "black_9",
            img: "black_9.png"
        },
        blue: {
            key: "blue_9",
            img: "blue_9.png"
        },
        green: {
            key: "green_9",
            img: "green_9.png"
        },
    },
    "10": {
        red: {
            key: "red_10",
            img: "red_10.png"
        },
        black: {
            key: "black_10",
            img: "black_10.png"
        },
        blue: {
            key: "blue_10",
            img: "blue_10.png"
        },
        green: {
            key: "green_10",
            img: "green_10.png"
        },
    },
    "J": {
        red: {
            key: "red_J",
            img: "red_J.png"
        },
        black: {
            key: "black_J",
            img: "black_J.png"
        },
        blue: {
            key: "blue_J",
            img: "blue_J.png"
        },
        green: {
            key: "green_J",
            img: "green_J.png"
        },
    },
    "Q": {
        red: {
            key: "red_Q",
            img: "red_Q.png"
        },
        black: {
            key: "black_Q",
            img: "black_Q.png"
        },
        blue: {
            key: "blue_Q",
            img: "blue_Q.png"
        },
        green: {
            key: "green_Q",
            img: "green_Q.png"
        },
    },
    "K": {
        red: {
            key: "red_K",
            img: "red_K.png"
        },
        black: {
            key: "black_K",
            img: "black_K.png"
        },
        blue: {
            key: "blue_K",
            img: "blue_K.png"
        },
        green: {
            key: "green_K",
            img: "green_K.png"
        },
    },
    "A": {
        red: {
            key: "red_A",
            img: "red_A.png"
        },
        black: {
            key: "black_A",
            img: "black_A.png"
        },
        blue: {
            key: "blue_A",
            img: "blue_A.png"
        },
        green: {
            key: "green_A",
            img: "green_A.png"
        },
    },
} as const;

const SpecialCardConfig: {
    [name in SpecialCardName]: {
        img: string
    }
} = {
    Dogs: {
        img: 'dogs.png'
    },
    Dragon: {
        img: 'dragon.png'
    },
    Phoenix: {
        img: 'phoenix.png'
    },
    Mahjong: {
        img: 'mahjong.png'
    },
} as const;

const CardKeyToImgMap: ReadonlyMap<string, string> = new Map(Object.entries({
        ...Object.values(NormalCardConfig).reduce<
            { [key: string]: string }
        >((acc, v) => {
            Object.values(CardColor).forEach(c => acc[v[c].key] = v[c].img)
            return acc;
        }, {}),
        ...Object.entries(SpecialCardConfig).reduce<
            { [key: string]: string }
        >((acc, [k, v]) => {
            acc[k] = v.img
            return acc;
        }, {})
    })
);

export function getCardImgByKey(key: string) {
    return CardKeyToImgMap.get(key);
}