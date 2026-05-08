<template>
  <div>
    <h1>Network Scan</h1>
    <p>This is the network scan page.</p>
    <div>
      <button @click="refreshPage">Refresh App</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'NetworkScan',
  methods: {
    refreshPage() {
      window.location.reload();
    }
  }
}
</script>

<style scoped>

</style>