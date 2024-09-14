import { PlayerKey } from "./game_logic/GameState";
import { BusinessError } from "./responses/BusinessError";

export class GameClient {
    readonly playerKey: PlayerKey;
    private _nickname = '';
    private _hasJoinedGame = false;

    constructor(playerKey: PlayerKey) {
        this.playerKey = playerKey;
    }

    get nickname() {
        return this._nickname;
    }

    set nickname(n: string) {
        if (!this._hasJoinedGame)
            throw new BusinessError(
                'Cannot set nickname before client joins.')
            ;
        if (this._nickname)
            throw new BusinessError(
                'Nickname has already been set.'
            );
        this._nickname = n;
    }

    get hasJoinedGame() {
        return this._hasJoinedGame;
    }

    joinGame() {
        if (this._hasJoinedGame)
            throw new BusinessError('This client has already joined.');
        this._hasJoinedGame = true;
    }
};
