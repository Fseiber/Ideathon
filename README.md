# AgroFlow

AgroFlow es un prototipo B2B para cotizar y seguir operaciones de arroz del NEA, con lotes tokenizados y liquidación DvP sobre Stellar testnet. Los datos y actores de demo conviven con órdenes y lotes reales del backend de prueba.

## Arquitectura

- `/server`: API Express, Prisma/SQLite, cotización, escrow y operaciones Stellar.
- `/client`: TanStack Start + React 19 + Tailwind/shadcn; consume `/server` mediante el proxy `/api`.
- Contrato HTTP: [`docs/API.md`](docs/API.md).

## Cómo correr

### Backend

```sh
cd server
npm install
cp .env.example .env
npx prisma migrate deploy
npm run seed
npm run dev
```

En PowerShell, usar `Copy-Item .env.example .env` en lugar de `cp`. El backend escucha en `http://localhost:4000`.

### Frontend

En otra terminal:

```sh
cd client
npm install
npm run dev
```

El frontend usa el proxy de Vite hacia `http://localhost:4000`.

## Variables de entorno

La plantilla completa está en [`server/.env.example`](server/.env.example). Variables disponibles:

`DATABASE_URL`, `PORT`, `STELLAR_MODE`, `STELLAR_NETWORK`, `STELLAR_ISSUER_SECRET`, `STELLAR_ISSUER_PUBLIC`, `STELLAR_ESCROW_SECRET`, `STELLAR_ESCROW_PUBLIC`, `STELLAR_MILL_SECRET`, `STELLAR_MILL_PUBLIC`, `STELLAR_BUYER_SECRET`, `STELLAR_BUYER_PUBLIC`, `AGENT_MODE`, `AGENT_TIMEOUT_MS`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `DEMO_PRICE_PER_TON_USD`, `DEMO_FREIGHT_USD`, `DEMO_EXPORT_DUTY_PCT`, `HEDERA_MODE`, `HEDERA_OPERATOR_ID`, `HEDERA_OPERATOR_KEY`, `HEDERA_KEY_TYPE`, `HEDERA_TOPIC_ID`.

## Recorrido de demo

1. Seleccionar el rol comprador o productor en la barra lateral.
2. Publicar un lote desde **Mis lotes** o usar el lote seed del molino.
3. Pedir una cotización desde el Marketplace o el Asistente.
4. Fondear la orden como comprador.
5. Confirmar el despacho como productor.
6. Confirmar la recepción y liquidar como comprador.
7. Revisar eventos, hashes y verificación en **Trazabilidad**.

## Evidencia testnet

La liquidación DvP de referencia está disponible en [StellarExpert](https://stellar.expert/explorer/testnet/tx/cc7285369074b567c81bad73016da164e7e8ab52084352e787a715c4d87f551b). El smoke test también escribe `server/demo-evidence.json` cuando se ejecuta con una configuración real.

## Limitaciones

- La custodia es operada por la plataforma; no es una billetera del comprador.
- USDC y ARROZ son activos de prueba emitidos por la plataforma, no USDC de Circle.
- Las operaciones usan Stellar testnet, nunca mainnet.
- La entrega física se simula mediante confirmaciones de API.
- Hedera es opcional y puede estar apagado (`HEDERA_MODE=off`).
- Los datos de demo no representan empresas, precios ni operaciones reales.

## Hoja de ruta

- Activo identificable por lote.
- Firma del comprador con billetera propia.
- Soroban y multifirma.
- Matching conectado a órdenes reales.
- Documentación comercial conectada.
- Conciliación financiera conectada.
