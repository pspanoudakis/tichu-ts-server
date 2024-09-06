import { CreateRoomEvent } from './events/ClientEvents';
import { GameServer } from './GameServer';

const responseCreator = (res: any, bodyCreator: () => any) => {
    try {
        res.send(bodyCreator()).status(200);
    } catch (error) {
        res.send({ error: String(error) }).status(500);
    }
}

const gs = GameServer.getInstance();

const SERVER_CONFIG = {
    PORT: 8080,
};

gs.express.post('/', (req, res) => {
    // validate... (zod?)
    responseCreator(res, () => 
        gs.handleCreateRoomEvent(req.body as CreateRoomEvent)
    );
});

gs.express.get('/', (req, res) => {
    res.send('Hello from Node TS!');
});

gs.express.listen(SERVER_CONFIG.PORT, () => {
    console.info(`Node.js TS server running on port [${SERVER_CONFIG.PORT}]`);
});
