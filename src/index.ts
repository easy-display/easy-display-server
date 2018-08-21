import express, { Request, Response } from "express";

// import {Socket} from "socket.io";
import {
    ClientType, DESKTOP_CONNECTION_LOST, DESKTOP_CONNECTION_SUCCESS,
    EVENT_DESKTOP_TO_MOBILE,
    EVENT_MOBILE_TO_DESKTOP,
    EVENT_SERVER_TO_DESKTOP,
    EVENT_SERVER_TO_MOBILE,
    MOBILE_CONNECTION_LOST,
    MOBILE_CONNECTION_SUCCESS,
} from "./constants";

import bodyParser from "body-parser";

import express_graphql from "express-graphql";
import { buildSchema } from "graphql";

import redis from "redis";

const app = express();

const server = require("http").Server(app);

import socketIo, { Socket } from "socket.io";

const io = socketIo(server);
app.use(bodyParser.json());

// GraphQL schema
const schema = buildSchema(`
    type Query {
        message: String
    }
`);

const root = {
    message: () => "Hello World!",
};
app.use("/graphql", express_graphql({
    graphiql: true,
    rootValue: root,
    schema,
}));

app.get("/api/app/info", (req: Request, res: Response) => {
    const pjson = require("../package.json");
    res.send({ version: pjson.version });
});

const apiHost = () => {
    const development = "api-staging.easydisplay.info";
    // const development = "macbook-air.duckdns.org:9000";
    return process.env.NODE_ENV === "production" ? "api-production.easydisplay.info" : development;
};


const apiScheme = () => {
    const development = "https";
    // const scheme = "http";
    return process.env.NODE_ENV === "production" ? "api-production.easydisplay.info" : development;
};


app.post("/api/v1/connection", (req: Request, res: Response) => {

    const token = Math.random().toString(36).substring(2);

    redisClient.hset(`conn:${token}`, "created", Date());
    redisClient.hset(`conn:${token}`, "version", req.body.version);

    res.send({
        host: apiHost(),
        scheme: apiScheme(),
        token,
        version: "0.1",
    });
});

// server-side

server.listen(process.env.NODE_PORT);

const redisClient = redis.createClient({
    detect_buffers: true,
    host: process.env.REDIS_HOST,
    port: +process.env.REDIS_PORT,
    password: process.env.REDIS_PASS,
    db: process.env.REDIS_DB
});

interface ICurrentSocketType {
    [id: string]: Socket;
}

const currentSockets: ICurrentSocketType = {};

export let staticFiles = (req: Request, res: Response) => {
    const file =  __dirname + "/index.html";
    res.sendFile(file);
};

app.get("/", staticFiles);

const isValidTokenPromise = (token: string): Promise<boolean> => {
    return new Promise((resolve, reject) => {

        redisClient.hget(`conn:${token}`, "created", (err: Error, created: string) => {
            if (err) {
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
    redisClient.hget(`conn:${token}`, clientType , (err: Error, socketId: string) => {
        const socket = currentSockets[socketId as string];
        if (socket) {
            socket.emit(eventName, data);
        } else {
            console.log(`missing socket for: clientType:${clientType},token:${token}`);
        }
    });

});

io.of("/mobile/0.1").on("connection", (socket: Socket) => {
    const clientType = socket.handshake.query.client_type;
    const token = socket.handshake.query.token;
    const socketId = socket.id;
    console.log(`mobile connection token: "${token}" , clientType: "${clientType}", socket: ${socketId}...`);
    isValidTokenPromise(token).then(() => {

        socket.emit(EVENT_SERVER_TO_MOBILE, [{ name: MOBILE_CONNECTION_SUCCESS, dataString: "", dataNumber: 0 }]);

        socket.on("disconnect", () => {
            console.log("mobile disconnected !!!");
            const data = [{ name: MOBILE_CONNECTION_LOST, dataString: "", dataNumber: 0 }];
            emitDataFor(ClientType.Desktop, token , EVENT_SERVER_TO_DESKTOP, data);
        });

        socket.on(EVENT_MOBILE_TO_DESKTOP, (data) => {
            const json = JSON.parse(data);
            emitDataFor(ClientType.Desktop, token , EVENT_MOBILE_TO_DESKTOP, json);
        });
        currentSockets[socketId] = socket;
        redisClient.hset(`conn:${token}`, "mobile", socketId);
    }).catch((reason) => {
        socket.emit("event_to_client", { message: reason });
        socket.disconnect(true);
    });

});

io.of("/desktop/0.1").on("connection", (socket: Socket) => {
    const clientType = socket.handshake.query.client_type;
    const token = socket.handshake.query.token;
    const socketId = socket.id;
    isValidTokenPromise(token).then(() => {
        console.log(`desktop connection success, token: "${token}", clientType: "${clientType}", `);
        socket.emit(EVENT_SERVER_TO_DESKTOP, [{ name: DESKTOP_CONNECTION_SUCCESS, dataString: "", dataNumber: 0 }]);
        currentSockets[socketId] = socket;
        redisClient.hset(`conn:${token}`, "desktop", socketId);

        socket.on("disconnect", () => {
            console.log("desktop disconnected");
            const data = [{ name: DESKTOP_CONNECTION_LOST , dataString: "" , dataNumber: 0 }];
            emitDataFor(ClientType.Mobile, token , EVENT_SERVER_TO_MOBILE, data);
        });

        socket.on(EVENT_DESKTOP_TO_MOBILE, (data) => {
            console.log(EVENT_DESKTOP_TO_MOBILE , " " , data);

            emitDataFor(ClientType.Mobile, token, EVENT_DESKTOP_TO_MOBILE , data);

        });

    }).catch((reason) => {
        console.error(reason);
        socket.emit("event_to_client", [{ message: "connection_failure", description: reason }]);
        socket.disconnect(true);
    });

    /*
    // socket.emit('event_to_client', { hello: 'world' });
    socket.on('event_to_server', function (data) {
        console.log(data);
        // socket.emit('event_to_client', { hello: 'world' });
    });*/
});
