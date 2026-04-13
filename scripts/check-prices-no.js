const https = require('https');

const url = new URL('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true');

const options = {
  hostname: url.hostname,
  path: url.pathname + url.search,
  method: 'GET',
  headers: {
    'User-Agent': 'crypto-alert-bot/1.0 (GitHub Actions)',
    'Accept': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', async () => {
    let prices;

    try {
      prices = JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse API response:', data);
      process.exit(1);
    }

    if (prices.status && prices.status.error_code) {
      console.error('CoinGecko API error:', prices.status.error_message);
      process.exit(1);
    }

    if (!prices.bitcoin || !prices.ethereum) {
      console.error('Unexpected response shape:', JSON.stringify(prices));
      process.exit(1);
    }

    const btc = prices.bitcoin.usd;
    const eth = prices.ethereum.usd;
    const btcChange = prices.bitcoin.usd_24h_change.toFixed(2);
    const ethChange = prices.ethereum.usd_24h_change.toFixed(2);

    console.log(`BTC: $${btc} (${btcChange}%) | ETH: $${eth} (${ethChange}%)`);

    await sendDiscordNotification(btc, eth, btcChange, ethChange);
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.error('HTTP request failed:', err.message);
  process.exit(1);
});

req.end();

async function sendDiscordNotification(btc, eth, btcChange, ethChange) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('No DISCORD_WEBHOOK_URL set');
    process.exit(1);
  }

  const btcEmoji = parseFloat(btcChange) >= 0 ? '🟢' : '🔴';
  const ethEmoji = parseFloat(ethChange) >= 0 ? '🟢' : '🔴';

  const payload = {
    username: 'Crypto Bot',
    embeds: [
      {
        title: '📊 Crypto Price Update',
        color: 0x00b0f4,
        fields: [
          {
            name: 'Bitcoin (BTC)',
            value: `$${btc.toLocaleString()} ${btcEmoji} ${btcChange}% (24h)`,
            inline: true
          },
          {
            name: 'Ethereum (ETH)',
            value: `$${eth.toLocaleString()} ${ethEmoji} ${ethChange}% (24h)`,
            inline: true
          }
        ],
        footer: { text: 'Powered by CoinGecko' },
        timestamp: new Date().toISOString()
      }
    ]
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.status === 204) {
    console.log('Notification sent successfully.');
  } else {
    console.error(`Discord returned unexpected status: ${res.status}`);
    process.exit(1);
  }
}