import { GameServer } from './GameServer';

const SERVER_CONFIG = {
    PORT: 8080,
};
const gs = GameServer.getInstance();
gs.listen(SERVER_CONFIG.PORT, () => {
    console.info(`Node.js TS server running on port [${SERVER_CONFIG.PORT}]`);
});
