# Use Node 20 LTS Alpine for small size
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy backend package files and install dependencies
COPY backend/package*.json ./backend/
RUN npm install --prefix ./backend --production

COPY backend ./backend
COPY frontend ./frontend

EXPOSE 3000

CMD ["node", "backend/src/server.js"]
