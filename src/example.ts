import { create, generateTransactionId, handleXMigration } from './index';

async function main() {
  try {
    // Get document from X homepage
    const document = await handleXMigration();
    
    // Extract key and animationKey
    const { key, animationKey } = await create(document);
    console.log('Key:', key);
    console.log('Animation Key:', animationKey);
    
    // Generate a transaction ID for an API request
    const transactionId = await generateTransactionId(
      'GET',
      '/graphql/1VOOyvKkiI3FMmkeDNxM9A/UserByScreenName',
      key,
      animationKey
    );
    
    console.log('Transaction ID:', transactionId);
    
    // Example of using the ID in a request
    const headers = {
      'x-client-transaction-id': transactionId,
      'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
      'content-type': 'application/json',
      'Referer': 'https://x.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    };
    
    console.log('Headers:', headers);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
main(); 