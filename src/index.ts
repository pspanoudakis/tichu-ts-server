import express from 'express';

const app = express();
const SERVER_CONFIG = {
    PORT: 3000,
};

app.get('/', (req, res) => {
    res.send('Hello from Node TS!');
});

app.listen(SERVER_CONFIG.PORT, () => {
    console.info(`Node.js TS server running on port [${SERVER_CONFIG.PORT}]`);
});
