const express = require('express')
const cors = require('cors')
const config = require('./config/env')
const bountyRoutes = require('./routes/bounty')

const app = express()

app.use(cors())
app.use(express.json())

// Routes
app.use('/api', bountyRoutes)

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'XBounty Agent Running',
    wallet: config.agent.walletAddress
  })
})

app.listen(config.port, () => {
  console.log(`XBounty backend running on port ${config.port}`)
  console.log(`Agent wallet: ${config.agent.walletAddress}`)
})
