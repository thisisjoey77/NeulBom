#!/bin/bash

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Run the signed build
npm run prebuild && CSC_LINK="$APPLE_CERTIFICATE" CSC_KEY_PASSWORD="$APPLE_CERTIFICATE_PASSWORD" APPLE_ID="$APPLE_ID" APPLE_PASSWORD="$APPLE_PASSWORD" APPLE_TEAM_ID="$APPLE_TEAM_ID" electron-builder --mac
