# Game Client App

Next.js frontend for Fog of War: Galactic Conquest.

This app talks to the deployed Solana program through the local SDK in `../sdk`.
It supports:

- wallet connection
- match discovery
- match creation
- lobby and board views
- queued order submission
- turn resolution and visibility requests

## Development

From the `app/` directory:

```bash
npm install
npm run dev
```

The app expects devnet by default and uses:

- `NEXT_PUBLIC_RPC_URL` for the Solana RPC endpoint
- `NEXT_PUBLIC_CLUSTER_OFFSET` for the Arcium cluster offset
- `NEXT_PUBLIC_NETWORK` for the network label (`devnet` by default)

## Notes

- Encrypted flows depend on MXE readiness on the target Arcium cluster.
- The UI waits for queued computations to finalize before refreshing match state.
- The SDK now retries transient Arcium/RPC wait failures and surfaces clearer callback error messages.
