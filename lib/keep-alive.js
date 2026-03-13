/**
 * Simple script to ping the server every 10 minutes to prevent Render free tier from sleeping.
 */
export function startKeepAlive() {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL;
  
  if (!url) {
    console.warn('Keep-alive: No application URL found (NEXT_PUBLIC_APP_URL or RENDER_EXTERNAL_URL).');
    return;
  }

  const pingUrl = `${url.endsWith('/') ? url : url + '/'}api/keep-alive`;
  
  console.log(`Keep-alive: Starting pinger for ${pingUrl}`);

  // Ping every 10 minutes (Render sleeps after 15 minutes of inactivity)
  setInterval(async () => {
    try {
      const response = await fetch(pingUrl, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'User-Agent': 'Autoscuela-KeepAlive-Bot'
        },
      });

      if (response.ok) {
        console.log(`Keep-alive: Ping successful at ${new Date().toISOString()}`);
      } else {
        console.error(`Keep-alive: Ping failed with status ${response.status}`);
      }
    } catch (error) {
      console.error('Keep-alive: Error during ping:', error.message);
    }
  }, 10 * 60 * 1000); // 10 minutes
}
