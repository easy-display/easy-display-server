"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("./constants");
const app = require('express')();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const bodyParser = require('body-parser');
app.use(bodyParser.json());
const express_graphql = require('express-graphql');
const { buildSchema } = require('graphql');
// GraphQL schema
const schema = buildSchema(`
    type Query {
        message: String
    }
`);
const root = {
    message: () => 'Hello World!'
};
app.use('/graphql', express_graphql({
    schema: schema,
    rootValue: root,
    graphiql: true
}));
app.post('/api/v1/connection', (req, res) => {
    const token = Math.random().toString(36).substring(2);
    redisClient.hset(`conn:${token}`, "created", Date());
    redisClient.hset(`conn:${token}`, "version", req.body.version);
    res.send({
        token: token,
        scheme: "http",
        host: "macbook-air.duckdns.org:8999",
        version: "0.1"
    });
});
// server-side
server.listen(8999);
const redis = require("redis");
const redisClient = redis.createClient({
    detect_buffers: true,
    host: 'localhost',
    port: 6383
});
const currentSockets = {};
exports.staticFiles = (req, res) => {
    const file = __dirname + '/index.html';
    res.sendFile(file);
};
app.get("/", exports.staticFiles);
const isValidTokenPromise = (token) => {
    return new Promise((resolve, reject) => {
        redisClient.hget(`conn:${token}`, "created", (err, created) => {
            if (err) {
                return reject(err);
            }
            if (created !== null) {
                resolve(true);
            }
            else {
                reject(new Error("bad auth"));
            }
        });
    });
};
const emitDataFor = ((clientType, token, eventName, data) => {
    console.log(`emitDataFor: clientType:${clientType}, token:${token}, event:${eventName}, data: ${data}`);
    redisClient.hget(`conn:${token}`, clientType, (err, socketId) => {
        const socket = currentSockets[socketId];
        if (socket) {
            socket.emit(eventName, data);
        }
        else {
            console.log(`missing socket for: clientType:${clientType},token:${token}`);
        }
    });
});
io.of("/mobile/0.1").on('connection', function (socket) {
    const clientType = socket.handshake.query["client_type"];
    const token = socket.handshake.query["token"];
    const socketId = socket.id;
    console.log(`mobile connection token: "${token}" , clientType: "${clientType}", socket: ${socketId}...`);
    isValidTokenPromise(token).then(() => {
        socket.emit(constants_1.EVENT_SERVER_TO_MOBILE, { message: 'connection_success' });
        socket.on('disconnect', function () {
            console.log("mobile disconnected");
            socket.emit('mobile disconnected');
        });
        socket.on(constants_1.EVENT_MOBILE_TO_DESKTOP, (data) => {
            emitDataFor("desktop", token, constants_1.EVENT_MOBILE_TO_DESKTOP, data);
            /*
            redisClient.hget(`conn:${token}`,"desktop",(err: Error,mobileSocketId: string) => {
                const desktopSocket = currentSockets[mobileSocketId as string];
                desktopSocket.emit(EVENT_MOBILE_TO_DESKTOP, data);
            });
            */
        });
        currentSockets[socketId] = socket;
        redisClient.hset(`conn:${token}`, "mobile", socketId);
    }).catch(reason => {
        socket.emit('event_to_client', { message: reason });
        socket.disconnect(true);
    });
});
io.of("/desktop/0.1").on('connection', function (socket) {
    const clientType = socket.handshake.query["client_type"];
    const token = socket.handshake.query["token"];
    const socketId = socket.id;
    isValidTokenPromise(token).then(() => {
        console.log(`desktop connection success, token: "${token}", clientType: "${clientType}", `);
        socket.emit(constants_1.EVENT_SERVER_TO_DESKTOP, { message: 'connection_success' });
        currentSockets[socketId] = socket;
        redisClient.hset(`conn:${token}`, "desktop", socketId);
        socket.on('disconnect', function () {
            console.log("desktop disconnected");
            socket.emit('desktop disconnected');
        });
        socket.on(constants_1.EVENT_DESKTOP_TO_MOBILE, function (data) {
            console.log(constants_1.EVENT_DESKTOP_TO_MOBILE, " ", data);
            emitDataFor("mobile", token, constants_1.EVENT_DESKTOP_TO_MOBILE, data);
            /*
            // const mobileSocketId = redisClient.hget(`user:${userId}`,"mobile");
            redisClient.hget(`conn:${token}`,"mobile",function(err: Error,mobileSocketId: string){
                const mobileSocket = currentSockets[mobileSocketId as string];
                mobileSocket.emit( EVENT_DESKTOP_TO_MOBILE, data);
            });
            */
        });
    }).catch(reason => {
        console.error(reason);
        socket.emit('event_to_client', { message: 'connection_failure', description: reason });
        socket.disconnect(true);
    });
    /*
    // socket.emit('event_to_client', { hello: 'world' });
    socket.on('event_to_server', function (data) {
        console.log(data);
        // socket.emit('event_to_client', { hello: 'world' });
    });*/
});
//# sourceMappingURL=index.js.map