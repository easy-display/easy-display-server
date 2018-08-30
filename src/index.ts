import express, {Request, Response} from "express";
// import {Socket} from "socket.io";
import {
    ClientType,
    DESKTOP_CONNECTION_LOST, DESKTOP_CONNECTION_SUCCESS_IPAD_PAIRED, DESKTOP_CONNECTION_SUCCESS_IPAD_PAIRING_REQUIRED,
    EVENT_CONNECTION_FAILURE,
    EVENT_DESKTOP_TO_MOBILE,
    EVENT_MOBILE_TO_DESKTOP,
    EVENT_SERVER_TO_DESKTOP,
    EVENT_SERVER_TO_MOBILE,
    INVALID_TOKEN,
    MOBILE_CONNECTION_LOST,
    MOBILE_CONNECTION_SUCCESS,
} from "./constants";

import bodyParser from "body-parser";

import express_graphql from "express-graphql";
import {buildSchema} from "graphql";

import redis from "redis";
import socketIo, {Socket} from "socket.io";
import * as path from "path";
import {IApiConnection, IApiEnvironment} from "./types";

const app = express();

const server = require("http").Server(app);

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



const environmeent = (): IApiEnvironment =>  {
    if (process.env.NODE_ENV == "production") {
        return IApiEnvironment.Production;
    } else if (process.env.NODE_ENV == "staging") {
        return IApiEnvironment.Staging;
    } else {
        return IApiEnvironment.Development;
    }
};
const apiConnection = (): IApiConnection =>  {
    switch (environmeent()) {
        case IApiEnvironment.Production:
            return {host: "api-production.easydisplay.info", scheme: "https", "version": "0.1"};
        case IApiEnvironment.Staging:
            return {host: "api-staging.easydisplay.info", scheme: "https", "version": "0.1"};
        case IApiEnvironment.Development:
            return {host: "macbook-air.duckdns.org:9000", scheme: "http", "version": "0.1"};
    }
};


app.post("/api/v1/connection", (req: Request, res: Response) => {

    const token = Math.random().toString(36).substring(2);

    redisClient.hset(`conn:${token}`, "created_at", Date());
    redisClient.hset(`conn:${token}`, "version", req.body.version);

    res.send({
        host: apiConnection().host,
        scheme: apiConnection().scheme,
        token,
        version: apiConnection().version,
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

app.use("/socket.io", express.static(path.join(__dirname, "node_modules/socket.io-client/dist/")));



const isValidTokenPromise = (token: string): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        redisClient.hget(`conn:${token}`, "created_at", (err: Error, found: string) => {
            if (err) {
                return reject(err);
            }
            if (found !== null) {
                resolve(true);
            } else {
                reject(new Error(INVALID_TOKEN));
            }
        });
    });
};


const PromiseSocketFor = (token: String, clientType: ClientType): Promise<Socket> => {
    return new Promise((resolve, reject) => {
        redisClient.hget(`conn:${token}`, clientType, (err: Error, socketId: string) => {
            const socket = currentSockets[socketId as string];
            if (socket) {
                resolve(socket);
            } else {
                console.log(`missing socket for: clientType:${clientType},token:${token}`);
                reject(new Error(`no socket type: ${clientType}, token: ${token}`));
            }
        });
    });

};

const emitDataFor = ((clientType: ClientType, token: string, eventName: string, data: any) => {

    console.log(`emitDataFor: clientType:${clientType}, token:${token}, event:${eventName}, data:`, data);
    PromiseSocketFor(token, clientType).then((socket) => {
        socket.emit(eventName, data);
    }).catch((err) => {
        console.log(err);
    });
    /*
    redisClient.hget(`conn:${token}`, clientType , (err: Error, socketId: string) => {
        const socket = currentSockets[socketId as string];
        if (socket) {
            socket.emit(eventName, data);
        } else {
            console.log(`missing socket for: clientType:${clientType},token:${token}`);
        }
    });
    */

});

io.of("/web/0.1").on("connection", (socket: Socket) => {
    console.debug("web connected.");
    socket.on("zing", () => {
        console.debug("ping => pong");
        socket.emit("zong");
    });
    socket.on("disconnect", () => {
        console.log("web disconnected.");
    });
});

io.of("/mobile/0.1").on("connection", (socket: Socket) => {
    const clientType: ClientType = socket.handshake.query.client_type;
    const token = socket.handshake.query.token;
    const socketId = socket.id;
    console.log(`mobile connection token: "${token}" , clientType: "${clientType}", socket: ${socketId}...`);
    isValidTokenPromise(token).then(() => {

        socket.emit(EVENT_SERVER_TO_MOBILE, [{ name: MOBILE_CONNECTION_SUCCESS, dataString: "", dataNumber: 0 }]);

        socket.on("disconnect", () => {
            console.log("mobile disconnected !!!");
            const data = [{ name: MOBILE_CONNECTION_LOST, dataString: "", dataNumber: 0 }];
            emitDataFor(ClientType.Desktop, token , EVENT_SERVER_TO_DESKTOP, data);
            delete(currentSockets[socket.id]);
            redisClient.hdel(`conn:${token}`, ClientType.Mobile);
        });

        socket.on(EVENT_MOBILE_TO_DESKTOP, (data) => {
            const json = JSON.parse(data);
            emitDataFor(ClientType.Desktop, token , EVENT_MOBILE_TO_DESKTOP, json);
        });
        currentSockets[socketId] = socket;
        redisClient.hset(`conn:${token}`, "mobile", socketId);
    }).catch((reason) => {
        console.info("mobile connection-failure", reason);
        const msg = { name: EVENT_CONNECTION_FAILURE, dataString: reason.message, dataNumber: 0 };
        socket.emit(EVENT_SERVER_TO_MOBILE, [ msg ]);
        socket.disconnect(true);
    });

});

io.of("/desktop/0.1").on("connection", (socket: Socket) => {
    const clientType: ClientType = socket.handshake.query.client_type;
    const token = socket.handshake.query.token;
    const socketId = socket.id;
    isValidTokenPromise(token).then(() => {
        console.log(`desktop connection success, token: "${token}", clientType: "${clientType}"`);
        currentSockets[socketId] = socket;

        redisClient.hset(`conn:${token}`, ClientType.Desktop, socketId, (isSet) => {
            PromiseSocketFor(token, ClientType.Mobile).then((mobSocket) => {
                socket.emit(EVENT_SERVER_TO_DESKTOP, [{ name: DESKTOP_CONNECTION_SUCCESS_IPAD_PAIRED, dataString: "", dataNumber: 0 }]);
            }).catch((err) => {
                socket.emit(EVENT_SERVER_TO_DESKTOP, [{ name: DESKTOP_CONNECTION_SUCCESS_IPAD_PAIRING_REQUIRED, dataString: "", dataNumber: 0 }]);
            });
        });

        socket.on("disconnect", (reason) => {
            console.log("desktop disconnected", reason);
            const data = [{ name: DESKTOP_CONNECTION_LOST , dataString: "" , dataNumber: 0 }];
            emitDataFor(ClientType.Mobile, token , EVENT_SERVER_TO_MOBILE, data);
            delete(currentSockets[socket.id]);
            redisClient.hdel(`conn:${token}`, ClientType.Desktop);
        });

        socket.on(EVENT_DESKTOP_TO_MOBILE, (data) => {
            console.log(EVENT_DESKTOP_TO_MOBILE , " " , data);

            emitDataFor(ClientType.Mobile, token, EVENT_DESKTOP_TO_MOBILE , data);

        });

    }).catch((reason) => {
        console.info("desktop connection-failure", reason);
        const msg = { name: EVENT_CONNECTION_FAILURE, dataString: reason.message, dataNumber: 0 };
        socket.emit(EVENT_SERVER_TO_DESKTOP, [ msg ]);
        socket.disconnect(true);
    });

    /*
    // socket.emit('event_to_client', { hello: 'world' });
    socket.on('event_to_server', function (data) {
        console.log(data);
        // socket.emit('event_to_client', { hello: 'world' });
    });*/
});
