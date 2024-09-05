Addimport { GameServer } from './GameServer';

const server = GameServer.getInstance();

const SERVER_CONFIG = {
    PORT: 3000,
};

server.express.get('/', (req, res) => {
    res.send('Hello from Node TS!');
});

server.express.listen(SERVER_CONFIG.PORT, () => {
    console.info(`Node.js TS server running on port [${SERVER_CONFIG.PORT}]`);
});
