FROM node:20 AS base

FROM base AS dev
RUN apt update && apt install -y \
    inetutils-ping \
    net-tools

