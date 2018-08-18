#!/usr/bin/env bash

IMAGE_NAME="arabiaweather/mawdoo3";



readonly NETWORK_NAME="easydisplay";
docker network inspect ${NETWORK_NAME} > /dev/null || echo "docker network: ${NETWORK_NAME} does not exist, creating... \ndocker network create -d bridge custom"
docker network inspect ${NETWORK_NAME} > /dev/null || docker network create -d bridge ${NETWORK_NAME};


readonly IMAGE_NAME="easydisplay/backend-http-api";

readonly REGISTRY="registry.docker.easydisplay.info";

CONTAINER_NAME="easydisplay-backend-http-api";


export NODE_PORT="8000";


docker run                                      \
    --rm                                        \
    --interactive                               \
    --tty                                       \
    --env-file ./docker/env                     \
    --name ${CONTAINER_NAME}                    \
    --network ${NETWORK_NAME}                   \
    --publish ${NODE_PORT}:${NODE_PORT}         \
    --volume ${PWD}/:/code:cached               \
    --volume ${PWD}/docker/confd/:/confd:cached \
    ${IMAGE_NAME}