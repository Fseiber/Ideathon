import dotenv from 'dotenv'; dotenv.config();
import { PrismaClient } from '@prisma/client';
import { Keypair } from '@stellar/stellar-sdk';
import { createLot } from '../src/services/lotService.js';
import { hashPassword } from '../src/utils/password.js';
const prisma = new PrismaClient();
const publicKey = (env) => process.env[env] || Keypair.random().publicKey();
try { await prisma.party.upsert({ where: { id: 1 }, update: { name: 'Molino Arrocero Demo', role: 'MOLINO', stellarPublicKey: publicKey('STELLAR_MILL_PUBLIC') }, create: { id: 1, name: 'Molino Arrocero Demo', role: 'MOLINO', stellarPublicKey: publicKey('STELLAR_MILL_PUBLIC') } }); await prisma.party.upsert({ where: { id: 2 }, update: { name: 'Comprador Asunción SA', role: 'COMPRADOR', stellarPublicKey: publicKey('STELLAR_BUYER_PUBLIC') }, create: { id: 2, name: 'Comprador Asunción SA', role: 'COMPRADOR', stellarPublicKey: publicKey('STELLAR_BUYER_PUBLIC') } }); if (await prisma.lot.count({ where: { millId: 1 } }) === 0) await createLot(1, 1000, prisma, undefined, { variety: 'Largo fino', province: 'Corrientes', presentation: 'Bolsas 25 kg', brokenPct: 5, moisturePct: 13, pricePerTonCents: 60000 });
  // COMEX F1: admin inicial desde .env (sin contraseñas en el código) y empresa molino de demostración.
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase(); const adminPassword = process.env.ADMIN_PASSWORD || '';
  if (adminEmail && adminPassword && await prisma.user.count() === 0) { if (adminPassword.length < 10) throw new Error('ADMIN_PASSWORD debe tener al menos 10 caracteres'); await prisma.user.create({ data: { email: adminEmail, name: 'Administrador', roles: 'ADMIN,COMEX', passwordHash: await hashPassword(adminPassword) } }); console.log(`Usuario admin creado: ${adminEmail}`); }
  const demoMill = await prisma.company.findFirst({ where: { name: 'Molino Arrocero Demo' } }) || await prisma.company.create({ data: { name: 'Molino Arrocero Demo', roles: 'MOLINO,EXPORTADOR', country: 'Argentina', province: 'Corrientes', notes: 'Empresa de demostración' } });
  const seedLot = await prisma.lot.findFirst({ where: { millId: 1 }, orderBy: { id: 'asc' } });
  if (seedLot && seedLot.supplierCompanyId === null) await prisma.lot.update({ where: { id: seedLot.id }, data: { supplierCompanyId: demoMill.id } });
} finally { await prisma.$disconnect(); }
