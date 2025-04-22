export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('id');
  
    if (!appId) {
      return new Response(JSON.stringify({ error: 'App ID is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  
    try {
      const response = await fetch(`https://itunes.apple.com/lookup?id=${appId}`);
      const data = await response.json();
  
      return new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to fetch app details' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  } 