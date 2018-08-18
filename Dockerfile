FROM node:10.5.0-alpine

RUN  apk update \
  &&  apk add ca-certificates wget curl \
  &&  update-ca-certificates

RUN wget -O /usr/local/bin/confd https://github.com/kelseyhightower/confd/releases/download/v0.16.0/confd-0.16.0-linux-amd64

RUN chmod +x /usr/local/bin/confd

COPY . /code/

ADD ./docker/confd/ /confd/

COPY ./docker/docker-node-entrypoint /docker-node-entrypoint

WORKDIR /code/

RUN npm install

ENTRYPOINT ["/bin/sh" , "-c" , "/docker-node-entrypoint" ]

CMD [ "node" ]