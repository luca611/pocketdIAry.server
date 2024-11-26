FROM node:18-slim

# Install Chromium and other dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libgbm1 \
    libnss3 \
    xdg-utils \
    wget

# Set Chromium path for Puppeteer
ENV CHROME_PATH=/usr/bin/chromium

# Set the working directory
WORKDIR /app

# Copy project files
COPY package*.json ./
RUN npm install
COPY . .

# Expose the port and start the app
EXPOSE 3000
CMD ["npm", "server.mjs"]