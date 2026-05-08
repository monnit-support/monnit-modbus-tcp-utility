<template>
  <div>
    <h1>Gateway History</h1>
    <p>This is the gateway history page.</p>
    <div>
      <p>
        Sensor Data Time: {{ sensorDataTime }}
        <button @click="updateSensorDataTime">Refresh</button>
      </p>
    </div>
    <button @click="refreshApp">Refresh App</button>
  </div>
</template>

<script>
export default {
  name: 'GatewayHistory',
  data() {
    return {
      sensorDataTime: 'Loading...',
      actualSensorDataTime: null // Placeholder for actual sensor data time
    }
  },
  mounted() {
    this.updateSensorDataTime();
  },
  methods: {
    updateSensorDataTime() {
      this.sensorDataTime = 'Loading...'; // Reset the time
      // Simulate fetching the sensor data time from an API or store
      // Replace this with your actual data fetching logic
      setTimeout(() => {
        // Assuming you have the actual sensor data time in a variable called 'actualSensorDataTime'
        // For example:
        this.actualSensorDataTime = new Date(); // Replace with your actual data source
        this.sensorDataTime = this.actualSensorDataTime.toLocaleTimeString();
      }, 1000); // Update after 1 second
    },
    refreshApp() {
      location.reload();
    }
  }
}
</script>

<style scoped>

</style>