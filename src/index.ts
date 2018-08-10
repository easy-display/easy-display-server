import {Request, Response} from "express";
import {Socket} from "socket.io";
import {
    ClientType,
    EVENT_DESKTOP_TO_MOBILE,
    EVENT_MOBILE_TO_DESKTOP,
    EVENT_SERVER_TO_DESKTOP,
    EVENT_SERVER_TO_MOBILE
} from "./constants";

const app = require('express')();
const server = require('http').Server(app);
const io = require('socket.io')(server);

const bodyParser = require('body-parser');
app.use( bodyParser.json() );

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



app.post('/api/v1/connection', (req: Request, res: Response) => {

    const token = Math.random().toString(36).substring(2);

    redisClient.hset(`conn:${token}`,"created", Date());
    redisClient.hset(`conn:${token}`,"version", req.body.version);

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

interface ICurrentSocketType {
    [id: string]: Socket;
}

const currentSockets: ICurrentSocketType = {};

export let staticFiles = (req: Request, res: Response) => {
    const file =  __dirname + '/index.html';
    res.sendFile(file);
};

app.get("/", staticFiles);

const isValidTokenPromise = (token: string) : Promise<boolean> => {
    return new Promise((resolve, reject) => {

        redisClient.hget(`conn:${token}`,"created",(err: Error,created: string) => {
            if (err){
                return reject(err);
            }
            if (created !== null) {
                resolve(true);
            } else {
                reject(new Error("bad auth"));
            }
        });
    });
};


const emitDataFor = ((clientType: ClientType, token: string, eventName: string, data: any) => {

    console.log(`emitDataFor: clientType:${clientType}, token:${token}, event:${eventName}, data: ${data}`);
    redisClient.hget(`conn:${token}`,clientType ,(err: Error,socketId: string) => {
        const socket = currentSockets[socketId as string];
        if (socket){
            socket.emit(eventName, data);
        } else {
            console.log(`missing socket for: clientType:${clientType},token:${token}`);
        }
    });

});

io.of("/mobile/0.1").on('connection', function (socket: Socket) {
    const clientType = socket.handshake.query["client_type"];
    const token = socket.handshake.query["token"];
    const socketId = socket.id;
    console.log(`mobile connection token: "${token}" , clientType: "${clientType}", socket: ${socketId}...`);
    isValidTokenPromise(token).then(() => {
        socket.emit( EVENT_SERVER_TO_MOBILE, { message: 'connection_success' });

        socket.on('disconnect', function () {
            console.log("mobile disconnected");
            const data = { message: 'mobile_connection_lost' };
            emitDataFor(ClientType.Desktop, token ,EVENT_SERVER_TO_DESKTOP, data );
        });

        socket.on(EVENT_MOBILE_TO_DESKTOP, (data) => {
            emitDataFor(ClientType.Desktop, token ,EVENT_MOBILE_TO_DESKTOP, data);
        });
        currentSockets[socketId] = socket;
        redisClient.hset(`conn:${token}`,"mobile", socketId);
    }).catch(reason => {
        socket.emit('event_to_client', { message: reason });
        socket.disconnect(true);
    });

});

io.of("/desktop/0.1").on('connection', function (socket: Socket) {
    const clientType = socket.handshake.query["client_type"];
    const token = socket.handshake.query["token"];
    const socketId = socket.id;
    isValidTokenPromise(token).then( () => {
        console.log(`desktop connection success, token: "${token}", clientType: "${clientType}", `);
        socket.emit( EVENT_SERVER_TO_DESKTOP, { message: 'connection_success' });
        currentSockets[socketId] = socket;
        redisClient.hset(`conn:${token}`,"desktop", socketId);

        socket.on('disconnect', function () {
            console.log("desktop disconnected");
            const data = { message: 'desktop_connection_lost' };
            emitDataFor(ClientType.Mobile, token ,EVENT_SERVER_TO_MOBILE, data );
        });

        socket.on(EVENT_DESKTOP_TO_MOBILE, function (data) {
            console.log(EVENT_DESKTOP_TO_MOBILE , " " , data);

            emitDataFor(ClientType.Mobile,token, EVENT_DESKTOP_TO_MOBILE ,data);

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
