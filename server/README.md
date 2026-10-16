# ArrozFlow backend

API B2B de cotizaciones y escrow USDC sobre Stellar testnet.

## Desarrollo

```sh
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev
```

El modo predeterminado es `STELLAR_MODE=mock`. Para testnet, completar `.env` y ejecutar `npm run stellar:setup`.

Las rutas están bajo `/api`; las operaciones autenticadas requieren `x-party-id`. Los montos se expresan en centavos enteros de USDC.

## Demo y verificación

Con el servidor levantado, el smoke test mock puede ejecutarse con:

```sh
npm run smoke -- --base http://localhost:4000 --allow-mock
```

Para una demo real, completar las credenciales de Stellar/Hedera en `.env`, ejecutar `npm run stellar:setup`, `npm run hedera:setup`, reiniciar la base con `npm run demo:reset` y levantar el servidor. Luego ejecutar `npm run smoke`. El script consulta balances y operaciones en Horizon cuando `STELLAR_MODE=testnet`, verifica el sello y genera `demo-evidence.json`.

`npm run demo:reset` vuelve a crear la base y ejecuta el seed configurado por Prisma. En testnet el stock on-chain del molino se acumula; el stock válido es el de la DB.
