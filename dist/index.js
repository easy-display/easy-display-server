"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app = require('express')();
const server = require('http').Server(app);
const io = require('socket.io')(server);
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
const isValidTokenPromise = (token, userId) => {
    return new Promise((resolve, reject) => {
        const isValid = userId == 99 && token == "Az_678987";
        if (isValid) {
            resolve();
        }
        else {
            reject(new Error("bad auth"));
        }
    });
};
io.of("/mobile/0.1").on('connection', function (socket) {
    const userId = socket.handshake.query["user_id"];
    const clientType = socket.handshake.query["client_type"];
    const token = socket.handshake.query["token"];
    const socketId = socket.id;
    console.log(`mobile connection userId:"${userId}", clientType: "${clientType}", token: "${token}" , socket: ${socketId}...`);
    isValidTokenPromise(token, userId).then(() => {
        socket.emit('event_server_to_mobile', { message: 'connection_success' });
        currentSockets[socketId] = socket;
        redisClient.hset(`user:${userId}`, "mobile", socketId);
    }).catch(reason => {
        socket.emit('event_to_client', { message: reason });
        socket.disconnect(true);
    });
});
io.of("/desktop/0.1").on('connection', function (socket) {
    const userId = socket.handshake.query["user_id"];
    const clientType = socket.handshake.query["client_type"];
    const token = socket.handshake.query["token"];
    const socketId = socket.id;
    isValidTokenPromise(token, userId).then(() => {
        console.log(`desktop connection success, userId:"${userId}", clientType: "${clientType}", token: "${token}"`);
        socket.emit('event_server_to_desktop', { message: 'connection_success' });
        currentSockets[socketId] = socket;
        redisClient.hset(`user:${userId}`, "desktop", socketId);
        socket.on('event_desktop_to_mobile', function (data) {
            console.log("event_desktop_to_mobile: ", data);
            // const mobileSocketId = redisClient.hget(`user:${userId}`,"mobile");
            redisClient.hget(`user:${userId}`, "mobile", function (err, mobileSocketId) {
                const mobileSocket = currentSockets[mobileSocketId];
                mobileSocket.emit('event_desktop_to_mobile', data);
            });
        });
    }).catch(reason => {
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