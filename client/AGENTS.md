# AgroMatch COMEX Frontend

- Proyecto: frontend de AgroMatch COMEX. Backend en `/server` (puerto 4000), contrato en `docs/API.md`.
- Las llamadas al backend se hacen SOLO del lado cliente mediante `useQuery` / `useEffect`.
- PROHIBIDO usar `loader()`, `beforeLoad()` o server functions para llamar a `/api`: corren en SSR y no pasan por el proxy.
- Los montos del backend están expresados en centavos USDC enteros; convertirlos SOLO con `centsToUsd` de `src/lib/api.ts`.
- El front NUNCA calcula precios de órdenes reales; muestra los valores entregados por el backend.
- Las pantallas sin backend (calculadora, matching, documentación, conciliación) siguen con datos demo y `DemoBadge`.
- Los datos reales llevan badge `Testnet`.
- Fuera de alcance: Soroban, Freighter, multifirma y WhatsApp real.
- No agregar plugins a `vite.config.ts`; la configuración de Lovable ya los incluye.
