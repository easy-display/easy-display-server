#!/usr/bin/env bash

rm -rf dist/*

npm run build

readonly IMAGE_NAME="easydisplay/backend-http-api";

readonly REGISTRY="registry.docker.easydisplay.info";

docker build --tag ${IMAGE_NAME} -f ./Dockerfile .;
