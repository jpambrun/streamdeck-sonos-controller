FROM node:18
RUN apt update &&  apt install -y libusb-1.0-0-dev libudev-dev libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
COPY package*.json ./
RUN npm install
COPY . .
CMD [ "node", "index.js" ]
