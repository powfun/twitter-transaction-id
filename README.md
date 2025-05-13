# Twitter Transaction ID

Generate client transaction IDs for X (formerly Twitter) API requests. This library helps you create the required `x-client-transaction-id` header value needed for authenticated API requests.

## Installation

```bash
# Using pnpm
pnpm add twitter-transaction-id
```

## Usage

This library is compatible with Cloudflare Workers and Node.js environments.

```ts
import { handleXMigration, create, generateTransactionId } from 'twitter-transaction-id';

async function main() {
  // Get document from X homepage
  const document = await handleXMigration();
  
  // Extract key and animationKey
  const { key, animationKey } = await create(document);
  
  // Generate a transaction ID
  const transactionId = await generateTransactionId(
    'GET', // HTTP method
    '/graphql/1VOOyvKkiI3FMmkeDNxM9A/UserByScreenName', // API path
    key,
    animationKey
  );
  
  // Use the transaction ID in your API request
  const headers = {
    'x-client-transaction-id': transactionId,
    // Other required headers
  };
  
  // Make your API request with the headers
}
```
## License

MIT 