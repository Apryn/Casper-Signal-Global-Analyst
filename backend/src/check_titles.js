import 'dotenv/config';
import axios from 'axios';

const urls = [
  'https://www.youtube.com/watch?v=cgdTq0wrmP0',
  'https://www.youtube.com/watch?v=-NpffO7WsMY'
];

for (const url of urls) {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 10000
    });
    const title = res.data.match(/<title>([^<]+)<\/title>/)?.[1] || '(no title)';
    const isLive = res.data.includes('"isLive":true') || res.data.includes('"isLive": true');
    console.log(url);
    console.log('  Title:', title);
    console.log('  isLive:', isLive);
  } catch(e) {
    console.log(url, 'ERROR:', e.message);
  }
}
process.exit(0);
