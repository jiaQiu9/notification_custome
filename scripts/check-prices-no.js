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
  res.on('end', () => {
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

    sendDiscordNotification(btc, eth, btcChange, ethChange);
  });
});

req.on('error', (err) => {
  console.error('HTTP request failed:', err.message);
  process.exit(1);
});

req.end();

function sendDiscordNotification(btc, eth, btcChange, ethChange) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('No DISCORD_WEBHOOK_URL set');
    process.exit(1);
  }

  const btcEmoji = btcChange >= 0 ? '🟢' : '🔴';
  const ethEmoji = ethChange >= 0 ? '🟢' : '🔴';

  const payload = JSON.stringify({
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
  });

  const webhookParsed = new URL(webhookUrl);
  const reqOptions = {
    hostname: webhookParsed.hostname,
    path: webhookParsed.pathname + webhookParsed.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const discordReq = https.request(reqOptions, (res) => {
    console.log(`Discord responded: ${res.statusCode}`);
    if (res.statusCode !== 204) {
      console.error('Discord did not return 204 — check your webhook URL');
    }
  });

  discordReq.on('error', (err) => {
    console.error('Failed to send Discord notification:', err.message);
    process.exit(1);
  });

  discordReq.write(payload);
  discordReq.end();
}