#!/usr/bin/env bash

readonly REGISTRY="registry.docker.easydisplay.info";

docker login ${REGISTRY};

rm -rf dist/*

npm run build

readonly APP_VERSION=$(cat package.json  | grep version | cut -f 4 -d '"');

readonly PROJECT_NAME="easydisplay/backend-http-api";

readonly IMAGE_NAME="${PROJECT_NAME}:${APP_VERSION}";

readonly REMOTE_TAG="${1}";

readonly REMOTE_IMAGE_NAME="${PROJECT_NAME}:${REMOTE_TAG}";

docker build --tag ${IMAGE_NAME} -f ./Dockerfile .;

echo "\n\n\n\n\t\t • tagging: ${IMAGE_NAME} as: ${REGISTRY}/${REMOTE_IMAGE_NAME} \n\n\n\n";

docker tag ${IMAGE_NAME} ${REGISTRY}/${REMOTE_IMAGE_NAME};

docker push ${REGISTRY}/${REMOTE_IMAGE_NAME};

