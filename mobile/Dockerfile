FROM --platform=linux/arm64 node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci && npm cache clean --force

COPY . .

EXPOSE 8081
EXPOSE 8097

ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL:-https://finance.shashankakumar.com/api}
ENV EXPO_PUBLIC_WS_URL=${EXPO_PUBLIC_WS_URL:-wss://finance.shashankakumar.com/ws}

CMD npx expo start --host 0.0.0.0 --port 8081
