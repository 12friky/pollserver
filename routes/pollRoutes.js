import express from 'express'
import Poll from '../models/Poll.js'
import Vote from '../models/Vote.js'
import { generatePollSocialPreview, getSocialPreviewUrl } from '../utils/socialPreview.js'

const router = express.Router()

const findPollByIdentifier = async (identifier) => {
  if (!identifier) return null

  return Poll.findOne({
    $or: [{ _id: identifier }, { pollId: identifier }],
  })
}

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
      shareImageUrl: getSocialPreviewUrl(req, poll),
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
    const poll = await findPollByIdentifier(req.params.id)

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

// CHECK WHETHER THIS VOTER HAS ALREADY VOTED IN THIS POLL
router.get('/:id/vote-status', async (req, res) => {
  try {
    const { voterId } = req.query

    if (!voterId) {
      return res.status(400).json({
        message: 'voterId is required.',
      })
    }

    const poll = await findPollByIdentifier(req.params.id)

    if (!poll) {
      return res.status(404).json({
        message: 'Poll not found.',
      })
    }

    const existingVote = await Vote.findOne({
      pollId: poll.pollId || poll._id.toString(),
      voterId,
    })

    res.json({
      success: true,
      hasVoted: Boolean(existingVote),
      pollId: poll.pollId || poll._id.toString(),
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: 'Unable to check vote status.',
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

    const poll = await findPollByIdentifier(req.params.id)

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

    const pollIdentifier = poll.pollId || poll._id.toString()

    // Check whether this voter already voted in this specific poll
    const existingVote = await Vote.findOne({
      pollId: pollIdentifier,
      voterId,
    })

    if (existingVote) {
      return res.status(409).json({
        message: 'You have already voted in this poll.',
      })
    }

    // Store vote
    await Vote.create({
      pollId: pollIdentifier,
      pollRef: poll._id,
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