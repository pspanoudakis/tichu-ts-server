import { GameServer } from './GameServer';

const SERVER_CONFIG = {
    PORT: 8080,
};
const gs = GameServer.getInstance();
gs.listen(SERVER_CONFIG.PORT);
