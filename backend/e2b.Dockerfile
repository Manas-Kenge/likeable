FROM node:iron-trixie-slim

# Update and install dependencies
RUN apt-get update && apt-get install -y curl git && rm -rf /var/lib/apt/lists/*

# Copy the pre-configured Vite + React + shadcn project
COPY my-app /home/user/app

WORKDIR /home/user/app

# Install dependencies
RUN npm install