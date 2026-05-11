<script lang="ts">
  let status: string = $state('loading...');

  async function checkHealth() {
    try {
      const response = await fetch('https://call-to-arms-api.fly.dev/health');
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