const https = require('https');

// Fetch BTC and ETH prices in USD
const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true';

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const prices = JSON.parse(data);
    const btc = prices.bitcoin.usd;
    const eth = prices.ethereum.usd;
    const btcChange = prices.bitcoin.usd_24h_change.toFixed(2);
    const ethChange = prices.ethereum.usd_24h_change.toFixed(2);

    // Define your alert threshold
    const BTC_THRESHOLD = parseFloat(process.env.ALERT_THRESHOLD_BTC || '0');
    
    // Only notify if BTC drops below threshold OR just send a daily report
    if (BTC_THRESHOLD === 0 || btc < BTC_THRESHOLD) {
      sendSlackNotification(btc, eth, btcChange, ethChange);
      sendDiscordNotification(btc, eth, btcChange, ethChange);
    }
  });
});

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