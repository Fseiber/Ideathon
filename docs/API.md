# API de AgroFlow

Contrato derivado de `server/src/routes/*.js`, `server/src/services/orderService.js`, `lotService.js`, `chatService.js` y `app.js`. El servidor expone 13 endpoints documentados bajo `/api`.

## Base y autenticación

- Base local: `http://localhost:4000/api`.
- La autenticación es simulada mediante el header `x-party-id`.
- `x-party-id: 1` representa al `MOLINO` (productor); `x-party-id: 2` representa al `COMPRADOR`.
- `/health` y `/parties` no requieren autenticación. `/lots`, `/orders` y `/chat` sí.
- Los recursos autenticados identifican a la party por el header, sin tokens ni sesiones.

Todos los errores tienen esta forma:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "tons debe ser un entero entre 1 y 100000" } }
```

Códigos usados por el servidor: `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `INSUFFICIENT_STOCK` (409), `INVALID_STATE` (409), `NOT_SEALED` (409), `STELLAR_ERROR` (502), `HEDERA_ERROR` (502) e `INTERNAL_ERROR` (500). `INTERNAL_ERROR` es la respuesta genérica para errores no tipados.

## Convenciones

- Los montos monetarios de órdenes son enteros en centavos de USDC: `1350000` representa USD 13.500.
- `tons` es entero.
- `incoterm` es `FOB` o `CFR`.
- Los porcentajes de derechos de exportación son números, no centavos.
- Los hashes Stellar aparecen como `txHash` hexadecimal de 64 caracteres cuando existe una transacción.

## Health

### `GET /api/health`

Rol: ninguno.

Respuesta real de ejemplo:

```json
{
  "ok": true,
  "stellarMode": "testnet",
  "hederaMode": "off",
  "agentMode": "stub",
  "db": "ok",
  "issuerPublic": "GAAGN2LNYHGIL4REVQKXPVLUVMRFXJERQDQA7CA3TYPJN3532GISKYVS",
  "escrowPublic": "GASAI6VN2UVJXRJO624EXV6SSRE4VLGPDR45A6CWETD5HEFCSSXKL6KW"
}
```

`issuerPublic` y `escrowPublic` son `null` cuando Stellar no está en modo `testnet`.

## Parties

### `GET /api/parties`

Rol: ninguno.

Respuesta:

```json
[
  { "id": 1, "name": "Molino Arrocero Demo", "role": "MOLINO", "stellarPublicKey": "GBTNXTJJ6TX7NUGVVHIT5ZNOMHSQZN2J56SX6IWQBGP6TBIX4EMAF4XX" },
  { "id": 2, "name": "Comprador Asunción SA", "role": "COMPRADOR", "stellarPublicKey": "GATFOBOR43K2IMR3CBKDFHZP6CMUB4MOF56EGC7GSI2YBX5OF4RIJW62" }
]
```

## Lots

### `GET /api/lots`

Rol: cualquier party autenticada.

Respuesta serializada:

```json
[
  {
    "id": 1,
    "product": "Arroz largo fino",
    "variety": "Largo fino",
    "province": "Corrientes",
    "presentation": "Bolsas 25 kg",
    "brokenPct": null,
    "moisturePct": null,
    "pricePerTonCents": 60000,
    "tonsTotal": 1000,
    "tonsAvailable": 820,
    "mintTxHash": "b9a49d5b8647ae7047b9f2b89134ddd2bba391949ff8dae3d028fd2dfdb7fa98",
    "explorerUrl": "https://stellar.expert/explorer/testnet/tx/b9a49d5b8647ae7047b9f2b89134ddd2bba391949ff8dae3d028fd2dfdb7fa98",
    "createdAt": "2026-10-16T01:40:25.476Z"
  }
]
```

### `POST /api/lots`

Rol requerido: `MOLINO` (`x-party-id: 1`).

Body:

```json
{
  "tons": 100,
  "product": "Arroz largo fino",
  "variety": "Largo fino",
  "province": "Corrientes",
  "presentation": "Bolsas 25 kg",
  "brokenPct": 3,
  "moisturePct": 13,
  "pricePerTonUsd": 650
}
```

`tons` es obligatorio, entero entre 1 y 100000. `product` es opcional. `variety`, `province` y `presentation` son opcionales, de 2 a 60 caracteres. `brokenPct` y `moisturePct` son opcionales, de 0 a 100. `pricePerTonUsd` es opcional, mayor que 0 y menor o igual que 100000; se guarda como `pricePerTonCents`.

Respuesta `201`: igual a un elemento de `GET /api/lots`. La operación mintea ARROZ mediante Stellar según `STELLAR_MODE`.

## Orders

### `POST /api/orders`

Rol requerido: `MOLINO`; además `millId` debe ser la party autenticada.

Body:

```json
{
  "millId": 1,
  "buyerId": 2,
  "destination": "Asunción, PY",
  "tons": 20,
  "pricePerTonUsd": 600,
  "incoterm": "CFR",
  "freightUsd": 1500,
  "exportDutyPct": 5
}
```

`pricePerTonUsd` es opcional: si se omite, se usa el precio del lote seleccionado. Si se envía, mantiene el override explícito del molino.

Respuesta `201` (campos principales):

```json
{
  "id": "c884a4c1-6a72-4fd3-9eed-204f89a1fbd8",
  "millId": 1,
  "buyerId": 2,
  "destination": "Asunción, PY",
  "tons": 20,
  "lotId": 1,
  "pricePerTonCents": 60000,
  "incoterm": "CFR",
  "freightCents": 150000,
  "subtotalCents": 1200000,
  "totalCents": 1350000,
  "advanceCents": 405000,
  "balanceCents": 945000,
  "exportDutyPct": 5,
  "exportDutyCents": 60000,
  "status": "COTIZADA",
  "tokenCode": "ARROZ",
  "events": [],
  "seal": null
}
```

### `GET /api/orders`

Rol requerido: cualquier party autenticada que tenga órdenes propias como molino o comprador.

Respuesta: array de órdenes serializadas con el mismo formato de `POST /api/orders`, incluyendo eventos ordenados por creación.

### `GET /api/orders/:id`

Rol requerido: molino o comprador asociado a la orden.

Respuesta: una orden serializada.

### `POST /api/orders/:id/fund`

Rol requerido: `COMPRADOR`; debe ser el `buyerId` de la orden.

Body: ninguno.

Respuesta: orden serializada. Cambia `COTIZADA` a `FONDEADA`, reserva stock y puede crear `FUND_ESCROW`, `LOCK_TOKENS` y `RELEASE_ADVANCE`.

### `POST /api/orders/:id/dispatch`

Rol requerido: `MOLINO`; debe ser el `millId` de la orden.

Body: ninguno.

Respuesta: orden serializada en estado `DESPACHADA`, con evento `DISPATCHED`.

### `POST /api/orders/:id/confirm-delivery`

Rol requerido: `COMPRADOR`; debe ser el `buyerId` de la orden.

Body: ninguno.

Respuesta: orden serializada en estado `COMPLETADA` después de enviar la liquidación DvP. Crea `SETTLE_DVP`; si Hedera está activo puede crear también `SEAL_HEDERA` o `SEAL_ERROR`.

### `POST /api/orders/:id/seal`

Rol requerido: molino o comprador asociado a la orden.

Body: ninguno.

Respuesta: orden serializada. Solo puede sellar una orden `COMPLETADA` que tenga liquidación. El sello, si existe, tiene `hash`, `topicId`, `sequenceNumber`, `hashscanUrl` y `mode`.

### `GET /api/orders/:id/verify`

Rol requerido: molino o comprador asociado a la orden.

Respuesta cuando está sellada:

```json
{ "valid": true, "hash": "...64 hex...", "sealedHash": "...64 hex...", "onChain": null }
```

`onChain` solo se consulta contra Hedera cuando `HEDERA_MODE=testnet`; en otros modos puede ser `null`.

## Chat

### `POST /api/chat`

Rol requerido: `COMPRADOR` (`x-party-id: 2`).

Body: entre 1 y 30 mensajes; cada `role` es `user` o `assistant`, cada `content` tiene entre 1 y 1000 caracteres y el último mensaje debe ser `user`.

```json
{
  "messages": [{ "role": "user", "content": "Necesito 20 toneladas para Asunción, CFR" }]
}
```

Respuesta cuando crea una cotización: `{ "reply": "...", "order": { "...": "orden serializada" }, "agent": "stub" }`. `agent` puede ser `stub` o `gemini`. Si faltan datos, `order` es `null`.

## Estados y eventos

Flujo normal:

```text
COTIZADA -> PROCESANDO -> FONDEADA -> PROCESANDO -> DESPACHADA -> PROCESANDO -> COMPLETADA
```

`PROCESANDO` es un estado transitorio durante acciones externas. Las operaciones exitosas pueden quedar en `FONDEADA`, `DESPACHADA` o `COMPLETADA`; los errores de una acción restauran el estado anterior según el servicio.

Eventos serializados:

- `FUND_ESCROW`: pago USDC depositado en escrow.
- `LOCK_TOKENS`: ARROZ bloqueado en escrow.
- `RELEASE_ADVANCE`: anticipo liberado al molino.
- `DISPATCHED`: despacho confirmado.
- `SETTLE_DVP`: liquidación atómica de saldo USDC y ARROZ.
- `SEAL_HEDERA`: sello creado en Hedera.
- `SEAL_ERROR`: fallo de sello reintentable.
- `ERROR`: fallo de una operación.

Cada evento expone `type`, `txHash`, `explorerUrl`, `note` y `createdAt`. `txHash` y `explorerUrl` son `null` para eventos sin transacción Stellar.

## Evidencia testnet

Una corrida real del smoke produjo la liquidación DvP `cc7285369074b567c81bad73016da164e7e8ab52084352e787a715c4d87f551b`:

[Ver SETTLE_DVP en StellarExpert](https://stellar.expert/explorer/testnet/tx/cc7285369074b567c81bad73016da164e7e8ab52084352e787a715c4d87f551b)
