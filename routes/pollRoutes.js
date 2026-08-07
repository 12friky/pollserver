import express from 'express'
import Poll from '../models/Poll.js'
import Vote from '../models/Vote.js'

const router = express.Router()

// GET CURRENT POLL
router.get('/current', async (req, res) => {
  try {
    const poll = await Poll.findOne({
      status: 'active',
    }).sort({
      createdAt: -1,
    })

    if (!poll) {
      return res.status(404).json({
        message: 'No active poll found.',
      })
    }

    res.json({
      success: true,
      poll,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: 'Unable to fetch poll.',
    })
  }
})

// GET POLL RESULTS
router.get('/:id/results', async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id)

    if (!poll) {
      return res.status(404).json({
        message: 'Poll not found.',
      })
    }

    const totalVotes = poll.options.reduce(
      (total, option) => total + option.votes,
      0
    )

    const results = poll.options.map((option) => ({
      id: option.id,
      label: option.label,
      votes: option.votes,
      percentage:
        totalVotes === 0
          ? 0
          : Math.round((option.votes / totalVotes) * 100),
    }))

    res.json({
      success: true,
      totalVotes,
      results,
    })
  } catch (error) {
    res.status(500).json({
      message: 'Unable to fetch results.',
    })
  }
})

// SUBMIT VOTE
router.post('/:id/vote', async (req, res) => {
  try {
    const { optionId, voterId } = req.body

    if (!optionId || !voterId) {
      return res.status(400).json({
        message: 'optionId and voterId are required.',
      })
    }

    const poll = await Poll.findById(req.params.id)

    if (!poll) {
      return res.status(404).json({
        message: 'Poll not found.',
      })
    }

    if (poll.status !== 'active') {
      return res.status(400).json({
        message: 'This poll is closed.',
      })
    }

    const optionExists = poll.options.some(
      (option) => option.id === optionId
    )

    if (!optionExists) {
      return res.status(400).json({
        message: 'Invalid poll option.',
      })
    }

    // Check whether this voter already voted
    const existingVote = await Vote.findOne({
      pollId: poll._id,
      voterId,
    })

    if (existingVote) {
      return res.status(409).json({
        message: 'You have already voted in this poll.',
      })
    }

    // Store vote
    await Vote.create({
      pollId: poll._id,
      optionId,
      voterId,
    })

    // Increment option vote count
    await Poll.updateOne(
      {
        _id: poll._id,
        'options.id': optionId,
      },
      {
        $inc: {
          'options.$.votes': 1,
        },
      }
    )

    res.status(201).json({
      success: true,
      message: 'Vote submitted successfully.',
    })
  } catch (error) {
    // Handles MongoDB duplicate index race condition
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'You have already voted in this poll.',
      })
    }

    console.error(error)

    res.status(500).json({
      message: 'Unable to submit vote.',
    })
  }
})

export default router