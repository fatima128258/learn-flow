#!/bin/bash
cd /app
npm ci > /dev/null 2>&1
npx prisma migrate deploy > /dev/null 2>&1
node prisma/seed.js
