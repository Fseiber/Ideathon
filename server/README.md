# AgroFlow backend

API B2B de cotizaciones y escrow USDC sobre Stellar testnet.

## Desarrollo local

```sh
npm install
npx prisma migrate deploy
npm run seed
npm run dev
```

Antes de esos comandos, copiar `.env.example` a `.env` y completar solo las variables necesarias. El modo predeterminado de la plantilla es `STELLAR_MODE=mock`. Para testnet, completar las credenciales Stellar y ejecutar `npm run stellar:setup`.

Las rutas están bajo `/api`; las operaciones autenticadas requieren `x-party-id`. Los montos se expresan en centavos enteros de USDC.

## Tests y demo

```sh
npm test
```

Con el servidor levantado, el smoke test mock puede ejecutarse con:

```sh
npm run smoke -- --base http://localhost:4000 --allow-mock
```

Para una demo real, completar las credenciales de Stellar en `.env`, ejecutar `npm run stellar:setup`, reiniciar la base con `npm run demo:reset` y levantar el servidor. Hedera es opcional: configurar y ejecutar `npm run hedera:setup` solo si se desea sello HCS. Luego ejecutar `npm run smoke`. El script consulta balances y operaciones en Horizon cuando `STELLAR_MODE=testnet`, y genera `demo-evidence.json`.

`npm run demo:reset` vuelve a crear la base y ejecuta el seed configurado por Prisma. En testnet el stock on-chain del molino se acumula; el stock válido es el de la DB.
