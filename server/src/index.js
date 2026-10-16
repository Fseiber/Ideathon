import dotenv from 'dotenv'; dotenv.config();
import { PrismaClient } from '@prisma/client';
import { createApp } from './app.js';
const prisma = new PrismaClient();
const port = Number(process.env.PORT || 4000);
createApp(prisma).listen(port, '0.0.0.0', () => console.log(`ArrozFlow API escuchando en ${port}`));
