FROM node:24-bookworm-slim

RUN apt-get update && apt-get install -y curl git && rm -rf /var/lib/apt/lists/*

# E2B provides this account; create it for ordinary Docker builds too.
RUN id -u user >/dev/null 2>&1 || useradd --create-home --shell /bin/bash user
RUN mkdir -p /home/user/app
COPY my-app /home/user/app
RUN chown -R user:user /home/user/app

WORKDIR /home/user/app
USER user
RUN npm ci --no-audit --no-fund

# Catch invalid starter code before publishing a template.
RUN npm run build
