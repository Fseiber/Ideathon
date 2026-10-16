import dotenv from 'dotenv'; dotenv.config();
import { PrismaClient } from '@prisma/client';
import { Keypair } from '@stellar/stellar-sdk';
import { createLot } from '../src/services/lotService.js';
const prisma = new PrismaClient();
const publicKey = (env) => process.env[env] || Keypair.random().publicKey();
try { await prisma.party.upsert({ where: { id: 1 }, update: { name: 'Molino Arrocero Demo', role: 'MOLINO', stellarPublicKey: publicKey('STELLAR_MILL_PUBLIC') }, create: { id: 1, name: 'Molino Arrocero Demo', role: 'MOLINO', stellarPublicKey: publicKey('STELLAR_MILL_PUBLIC') } }); await prisma.party.upsert({ where: { id: 2 }, update: { name: 'Comprador Asunción SA', role: 'COMPRADOR', stellarPublicKey: publicKey('STELLAR_BUYER_PUBLIC') }, create: { id: 2, name: 'Comprador Asunción SA', role: 'COMPRADOR', stellarPublicKey: publicKey('STELLAR_BUYER_PUBLIC') } }); if (await prisma.lot.count({ where: { millId: 1 } }) === 0) await createLot(1, 1000, prisma); } finally { await prisma.$disconnect(); }
