import dotenv from 'dotenv'
import connectDB from './config/db.js'
import Poll from './models/Poll.js'

dotenv.config()

// Seed a simple active poll if none exists
await connectDB()

const existing = await Poll.findOne({ status: 'active' })
if (existing) {
  console.log('Active poll already exists:', existing._id.toString())
  process.exit(0)
}

const seed = {
  question: 'Do you support the current environmental policies?',
  status: 'active',
  options: [
    { id: 'opt-yes', icon: '👍', label: 'Yes', sub: 'Support', votes: 5 },
    { id: 'opt-no', icon: '👎', label: 'No', sub: 'Do not support', votes: 2 },
  ],
}

const created = await Poll.create(seed)
console.log('Seeded poll:', created._id.toString())
process.exit(0)
