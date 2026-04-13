const https = require('https');

const url = new URL('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true');

const options = {
  hostname: url.hostname,
  path: url.pathname + url.search,
  method: 'GET',
  headers: {
    'User-Agent': 'crypto-alert-bot/1.0 (GitHub Actions)',  // ← this is the fix
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

    const BTC_THRESHOLD = parseFloat(process.env.ALERT_THRESHOLD_BTC || '0');

    if (BTC_THRESHOLD === 0 || btc < BTC_THRESHOLD) {
      sendDiscordNotification(btc, eth, btcChange, ethChange);
    } else {
      console.log(`BTC at $${btc} — above threshold $${BTC_THRESHOLD}, no alert sent.`);
    }
  });
});

req.on('error', (err) => {
  console.error('HTTP request failed:', err.message);
  process.exit(1);
});

req.end();
function sendSlackNotification(btc, eth, btcChange, ethChange) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) { console.error('No SLACK_WEBHOOK_URL set'); process.exit(1); }

  const payload = JSON.stringify({
    text: `*Crypto Price Update*\n• BTC: $${btc.toLocaleString()} (${btcChange}% 24h)\n• ETH: $${eth.toLocaleString()} (${ethChange}% 24h)`
  });

  // POST to Slack webhook
  const urlObj = new URL(webhookUrl);
  const options = { hostname: urlObj.hostname, path: urlObj.pathname, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
  };
  const req = https.request(options, res => console.log(`Slack responded: ${res.statusCode}`));
  req.on('error', err => console.error(err));
  req.write(payload);
  req.end();
}

function sendDiscordNotification(btc, eth, btcChange, ethChange) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) { console.error('No DISCORD_WEBHOOK_URL set'); process.exit(1); }

  const payload = JSON.stringify({
    username: 'Crypto Bot',
    embeds: [
      {
        title: '📈 Crypto Price Update',
        color: 0x00b0f4,  // blue color bar on the embed
        fields: [
          {
            name: 'Bitcoin (BTC)',
            value: `$${btc.toLocaleString()} — ${btcChange}% (24h)`,
            inline: true
          },
          {
            name: 'Ethereum (ETH)',
            value: `$${eth.toLocaleString()} — ${ethChange}% (24h)`,
            inline: true
          }
        ],
        footer: { text: 'Powered by CoinGecko' },
        timestamp: new Date().toISOString()
      }
    ]
  });

  const urlObj = new URL(webhookUrl);
  const options = {
    hostname: urlObj.hostname,
    path: urlObj.pathname + urlObj.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = require('https').request(options, res => {
    console.log(`Discord responded: ${res.statusCode}`);
  });
  req.on('error', err => console.error(err));
  req.write(payload);
  req.end();
}