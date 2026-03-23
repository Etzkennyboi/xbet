const path = require('path')
const express = require('express')
const cors = require('cors')
const config = require('./config/env')
const bountyRoutes = require('./routes/bounty')

const app = express()

app.use(cors())
app.use(express.json())

// API Routes
app.use('/api', bountyRoutes)

// Serve Frontend (Production)
const frontendPath = path.join(__dirname, '../frontend/dist')
app.use(express.static(frontendPath))

// Catch-all for React Routing
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return // Let /api routes handle themselves
  res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
    if (err && !res.headersSent) {
      res.json({ 
        status: 'XBounty Agent Running (Backend Only)', 
        message: 'Frontend not found or not built. Running in API mode.',
        walletAddress: config.agent.walletAddress 
      })
    }
  })
})

app.listen(config.port, () => {
  console.log(`XBounty backend running on port ${config.port}`)
  console.log(`Agent wallet: ${config.agent.walletAddress}`)
})
