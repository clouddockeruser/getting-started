FROM nikolaik/python-nodejs:latest
COPY . .
RUN yarn install --production
CMD [ "node", "./server.js" ]