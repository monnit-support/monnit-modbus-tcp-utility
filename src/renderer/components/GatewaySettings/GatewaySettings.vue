<template>
  <div class="gateway-settings-container">
    <h1>Gateway Settings</h1>
    <div class="tabs">
      <router-link to="/gateway-settings/network-scan">Network Scan</router-link>
      <router-link to="/gateway-settings/gateway-history">Gateway History</router-link>
    </div>
    <router-view/>
  </div>
</template>

<script>
export default {
  name: 'GatewaySettings'
}
</script>

<style scoped>
.gateway-settings-container {
  background-color: white;
}

.tabs {
  display: flex;
  justify-content: space-around;
  padding: 10px;
}

.tabs a {
  text-decoration: none;
  color: blue;
  padding: 5px 10px;
  border: 1px solid blue;
  border-radius: 5px;
}
</style>