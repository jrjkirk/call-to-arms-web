<script lang="ts">
  import { PUBLIC_API_URL } from '$env/static/public';

  let status: string = $state('loading...');

  async function checkHealth() {
    try {
      const response = await fetch(`${PUBLIC_API_URL}/health`);
      const data = await response.json();
      status = data.status;
    } catch (error) {
      status = 'error: ' + (error as Error).message;
    }
  }

  checkHealth();
</script>

<h1>Call to Arms</h1>
<p>Backend status: <strong>{status}</strong></p>
<p><a href="/players">View all players</a></p>
<p><a href="/players">View all players</a></p>
<p><a href="/league">Old World League rankings</a></p>