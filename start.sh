#!/bin/bash

source .env && pm2 start main.js --name discord_bot --update-env
