FROM alpine
RUN apk add --update --no-cache python3 && ln -sf python3 /usr/bin/python
RUN apk add --update nodejs
COPY . .
CMD [ "node", "./server.js" ]