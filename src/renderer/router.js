import Vue from 'vue'
import VueRouter from 'vue-router'
import GatewaySettings from '../renderer/components/GatewaySettings/GatewaySettings.vue'
import GatewayHistory from '../renderer/components/GatewayHistory/GatewayHistory.vue'
import NetworkScan from '../renderer/components/NetworkScan/NetworkScan.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: '/gateway-settings',
    component: GatewaySettings,
    children: [
      {
        path: 'gateway-history',
        component: GatewayHistory
      },
      {
        path: 'network-scan',
        component: NetworkScan
      }
    ]
  }
]

const router = new VueRouter({
  routes
})

export default router