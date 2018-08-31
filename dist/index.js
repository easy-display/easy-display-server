"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
// import {Socket} from "socket.io";
const constants_1 = require("./constants");
const body_parser_1 = __importDefault(require("body-parser"));
const express_graphql_1 = __importDefault(require("express-graphql"));
const graphql_1 = require("graphql");
const redis_1 = __importDefault(require("redis"));
const socket_io_1 = __importDefault(require("socket.io"));
const path = __importStar(require("path"));
const types_1 = require("./types");
const app = express_1.default();
const server = require("http").Server(app);
const io = socket_io_1.default(server);
app.use(body_parser_1.default.json());
// GraphQL schema
const schema = graphql_1.buildSchema(`
    type Query {
        message: String
    }
`);
const root = {
    message: () => "Hello World!",
};
app.use("/graphql", express_graphql_1.default({
    graphiql: true,
    rootValue: root,
    schema,
}));
app.get("/api/app/info", (req, res) => {
    const pjson = require("../package.json");
    res.send({ version: pjson.version });
});
const environmeent = () => {
    if (process.env.NODE_ENV == "production") {
        return types_1.IApiEnvironment.Production;
    }
    else if (process.env.NODE_ENV == "staging") {
        return types_1.IApiEnvironment.Staging;
    }
    else {
        return types_1.IApiEnvironment.Development;
    }
};
const apiConnection = () => {
    switch (environmeent()) {
        case types_1.IApiEnvironment.Production:
            return { host: "api-production.easydisplay.info", scheme: "https", "version": "0.1" };
        case types_1.IApiEnvironment.Staging:
            return { host: "api-staging.easydisplay.info", scheme: "https", "version": "0.1" };
        case types_1.IApiEnvironment.Development:
            return { host: "macbook-air.duckdns.org:9000", scheme: "http", "version": "0.1" };
    }
};
app.post("/api/v1/connection", (req, res) => {
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
const redisClient = redis_1.default.createClient({
    detect_buffers: true,
    host: process.env.REDIS_HOST,
    port: +process.env.REDIS_PORT,
    password: process.env.REDIS_PASS,
    db: process.env.REDIS_DB
});
const currentSockets = {};
exports.staticFiles = (req, res) => {
    const file = __dirname + "/index.html";
    res.sendFile(file);
};
app.get("/", exports.staticFiles);
app.use("/socket.io", express_1.default.static(path.join(__dirname, "node_modules/socket.io-client/dist/")));
const PromiseIsValidToken = (token) => {
    return new Promise((resolve, reject) => {
        redisClient.hget(`conn:${token}`, "created_at", (err, found) => {
            if (err) {
                return reject(err);
            }
            if (found !== null) {
                resolve(true);
            }
            else {
                reject(new Error(constants_1.INVALID_TOKEN));
            }
        });
    });
};
const PromiseSocketFor = (token, clientType) => {
    return new Promise((resolve, reject) => {
        redisClient.hget(`conn:${token}`, clientType, (err, socketId) => {
            const socket = currentSockets[socketId];
            if (socket) {
                resolve(socket);
            }
            else {
                console.log(`missing socket for: clientType:${clientType},token:${token}`);
                reject(new Error(`no socket type: ${clientType}, token: ${token}`));
            }
        });
    });
};
const emitDataFor = ((clientType, token, eventName, data) => {
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
io.of("/web/0.1").on("connection", (socket) => {
    console.debug("web connected.");
    socket.on("zing", () => {
        console.debug("ping => pong");
        socket.emit("zong");
    });
    socket.on("disconnect", () => {
        console.log("web disconnected.");
    });
});
io.of("/mobile/0.1").on("connection", (socket) => {
    const clientType = socket.handshake.query.client_type;
    const token = socket.handshake.query.token;
    const socketId = socket.id;
    console.log(`mobile connection token: "${token}" , clientType: "${clientType}", socket: ${socketId}...`);
    PromiseIsValidToken(token).then(() => {
        socket.emit(constants_1.EVENT_SERVER_TO_MOBILE, [{ name: constants_1.MOBILE_CONNECTION_SUCCESS, dataString: "", dataNumber: 0 }]);
        socket.on("disconnect", () => {
            console.log("mobile disconnected !!!");
            const data = [{ name: constants_1.MOBILE_CONNECTION_LOST, dataString: "", dataNumber: 0 }];
            emitDataFor(constants_1.ClientType.Desktop, token, constants_1.EVENT_SERVER_TO_DESKTOP, data);
            delete (currentSockets[socket.id]);
            redisClient.hdel(`conn:${token}`, constants_1.ClientType.Mobile);
        });
        socket.on(constants_1.EVENT_MOBILE_TO_DESKTOP, (data) => {
            const json = JSON.parse(data);
            emitDataFor(constants_1.ClientType.Desktop, token, constants_1.EVENT_MOBILE_TO_DESKTOP, json);
        });
        currentSockets[socketId] = socket;
        redisClient.hset(`conn:${token}`, "mobile", socketId);
    }).catch((reason) => {
        console.info("mobile connection-failure", reason);
        const msg = { name: constants_1.EVENT_CONNECTION_FAILURE, dataString: reason.message, dataNumber: 0 };
        socket.emit(constants_1.EVENT_SERVER_TO_MOBILE, [msg]);
        console.info("EVENT_SERVER_TO_MOBILE", msg);
        socket.disconnect(true);
    });
});
io.of("/desktop/0.1").on("connection", (socket) => {
    const clientType = socket.handshake.query.client_type;
    const token = socket.handshake.query.token;
    const socketId = socket.id;
    PromiseIsValidToken(token).then(() => {
        console.log(`desktop connection success, token: "${token}", clientType: "${clientType}"`);
        currentSockets[socketId] = socket;
        redisClient.hset(`conn:${token}`, constants_1.ClientType.Desktop, socketId, (isSet) => {
            PromiseSocketFor(token, constants_1.ClientType.Mobile).then((mobSocket) => {
                socket.emit(constants_1.EVENT_SERVER_TO_DESKTOP, [{ name: constants_1.DESKTOP_CONNECTION_SUCCESS_IPAD_PAIRED, dataString: "", dataNumber: 0 }]);
            }).catch((err) => {
                socket.emit(constants_1.EVENT_SERVER_TO_DESKTOP, [{ name: constants_1.DESKTOP_CONNECTION_SUCCESS_IPAD_PAIRING_REQUIRED, dataString: "", dataNumber: 0 }]);
            });
        });
        socket.on("disconnect", (reason) => {
            console.log("desktop disconnected", reason);
            const data = [{ name: constants_1.DESKTOP_CONNECTION_LOST, dataString: "", dataNumber: 0 }];
            emitDataFor(constants_1.ClientType.Mobile, token, constants_1.EVENT_SERVER_TO_MOBILE, data);
            delete (currentSockets[socket.id]);
            redisClient.hdel(`conn:${token}`, constants_1.ClientType.Desktop);
        });
        socket.on(constants_1.EVENT_DESKTOP_TO_MOBILE, (data) => {
            console.log(constants_1.EVENT_DESKTOP_TO_MOBILE, " ", data);
            emitDataFor(constants_1.ClientType.Mobile, token, constants_1.EVENT_DESKTOP_TO_MOBILE, data);
        });
    }).catch((reason) => {
        console.info("desktop connection-failure", reason);
        const msg = { name: constants_1.EVENT_CONNECTION_FAILURE, dataString: reason.message, dataNumber: 0 };
        socket.emit(constants_1.EVENT_SERVER_TO_DESKTOP, [msg]);
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