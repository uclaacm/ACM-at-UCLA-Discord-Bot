#!/bin/bash

. .env && pm2 start main.js --name discord_bot
