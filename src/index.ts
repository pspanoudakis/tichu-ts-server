import { ClientEventType, RoomCreatedEvent } from './events/ClientEvents';
import { GameServer } from './GameServer';

const gs = GameServer.getInstance();

const SERVER_CONFIG = {
    PORT: 8080,
};

gs.express.post('/', (req, res) => {
    const request = req.body as RoomCreatedEvent;
    const sessionId = `session_${String(new Date().getTime())}`;
    gs.addSession(sessionId, request);
    const playerKey = gs.sessions.get(sessionId)?.addPlayerOrElseThrow({
        eventType: ClientEventType.JOIN_GAME,
        data: {
            playerNickname: request.data.playerNickname
        }
    })
    res.send({
        sessionId,
        playerKey
    });
});

gs.express.get('/', (req, res) => {
    res.send('Hello from Node TS!');
});

gs.express.listen(SERVER_CONFIG.PORT, () => {
    console.info(`Node.js TS server running on port [${SERVER_CONFIG.PORT}]`);
});
