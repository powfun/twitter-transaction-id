/**
 * Tests for the transaction ID generation functionality
 *
 * This file contains test cases to verify the functionality of the
 * transaction ID generation process using Node.js and typescript-node (tsx).
 */
import { handleXMigration, create, generateTransactionId } from "./index";

/**
 * 简单的断言函数，用于替代外部断言库
 */
function assertEquals(actual: any, expected: any, message?: string): void {
  if (actual !== expected) {
    throw new Error(message || `断言失败: 期望 ${expected}，实际得到 ${actual}`);
  }
}

async function testTransactionId() {
  const totalRequests = 25;
  let successfulRequests = 0;
  let notFoundErrors = 0;

  const url = "https://api.x.com/graphql/1VOOyvKkiI3FMmkeDNxM9A/UserByScreenName?variables=%7B%22screen_name%22%3A%22elonmusk%22%7D&features=%7B%22hidden_profile_subscriptions_enabled%22%3Atrue%2C%22profile_label_improvements_pcf_label_in_post_enabled%22%3Atrue%2C%22rweb_tipjar_consumption_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22subscriptions_verification_info_is_identity_verified_enabled%22%3Atrue%2C%22subscriptions_verification_info_verified_since_enabled%22%3Atrue%2C%22highlights_tweets_tab_ui_enabled%22%3Atrue%2C%22responsive_web_twitter_article_notes_tab_enabled%22%3Atrue%2C%22subscriptions_feature_can_gift_premium%22%3Atrue%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%7D&fieldToggles=%7B%22withAuxiliaryUserLabels%22%3Atrue%7D"
  const headers = {
    'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
    'content-type': 'application/json',
    'Referer': 'https://x.com/',
    'Cache-Control': 'no-cache',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    'Accept-Language': 'en-US',
    'X-Twitter-Client-Language': 'en-US',
  }
  // Act: Generate multiple transaction IDs and test them
  console.log(`Running ${totalRequests} API requests...`);
  const document = await handleXMigration();
  const guestToken = document.documentElement.outerHTML.match(/gt=([0-9]+);/)?.[1] || null;
  const {
    key, animationKey
  } = await create(document);  

  for (let i = 0; i < totalRequests; i++) {
    // Generate transaction ID with the fresh ClientTransaction instance
    const transactionId = await generateTransactionId(
      "GET",
      "/graphql/1VOOyvKkiI3FMmkeDNxM9A/UserByScreenName",
      key, animationKey
    );
    

    // Execute the request
    try {
      console.log(`Request ${i + 1}/${totalRequests}: Executing API call...`);
      const response = await fetch(url, {
        headers: {
          ...headers,
          'x-guest-token': guestToken,
          "x-client-transaction-id": transactionId,
        },
      });
      await response.text();

      if (response.ok) {
        successfulRequests++;
        console.log(`Request ${i + 1}/${totalRequests}: Success`);
      } else {
        console.error(
          `Request ${i + 1}/${totalRequests}: Failed with status: ${
            response.status
          }`
        );
        if (response.status === 404) {
          notFoundErrors++;
        }
      }
    } catch (error) {
      console.error(`Request ${i + 1}/${totalRequests}: Error:`, error);
    }

    // Small delay between requests to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(
    `Successful requests: ${successfulRequests}/${totalRequests} (${(
      (successfulRequests / totalRequests) *
      100
    ).toFixed(2)}%)`
  );
  console.log(
    `404 Not Found errors: ${notFoundErrors}/${totalRequests} (${(
      (notFoundErrors / totalRequests) *
      100
    ).toFixed(2)}%)`
  );

  if (
    notFoundErrors > totalRequests / 2 ||
    notFoundErrors === totalRequests
  ) {
    console.warn(
      "Possible rate limiting detected. Try opening any user profile page in Chrome to verify."
    );
    console.warn(
      "If rate limiting is occurring, errors will also appear in the browser."
    );
  }

  // Assert: Verify all requests were successful (100% success rate)
  assertEquals(
    successfulRequests,
    totalRequests,
    `All ${totalRequests} requests must succeed. Only ${successfulRequests} succeeded.`
  );
}

// 直接运行测试
(async () => {
  try {
    console.log("Starting transaction ID generation test...");
    await testTransactionId();
    console.log("✅ Test passed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
})();
