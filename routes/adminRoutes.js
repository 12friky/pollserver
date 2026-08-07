import express from 'express'
import jwt from 'jsonwebtoken'
import argon2 from 'argon2'
import Poll from '../models/Poll.js'
import protectAdmin from '../middleware/auth.js'

const router = express.Router()

// ADMIN LOGIN
router.post('/login', async (req, res) => {
  try {
    const { id, email, password } = req.body

    if ((!id && !email) || !password) {
      return res.status(400).json({
        message: 'Admin ID or email and password are required.',
      })
    }

    const adminId = process.env.ADMIN_ID
    const adminEmail = process.env.ADMIN_EMAIL
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH

    const isValidId = id && adminId && id === adminId
    const isValidEmail = email && adminEmail && email === adminEmail

    if (!isValidId && !isValidEmail) {
      return res.status(401).json({
        message: 'Invalid credentials.',
      })
    }

    const validPassword = await argon2.verify(
      adminPasswordHash,
      password
    )

    if (!validPassword) {
      return res.status(401).json({
        message: 'Invalid credentials.',
      })
    }

    const token = jwt.sign(
      {
        role: 'admin',
        email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '2h',
      }
    )

    res.cookie('adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 * 1000,
    })

    res.json({
      success: true,
      message: 'Admin login successful.',
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: 'Login failed.',
    })
  }
})

// ADMIN LOGOUT
router.post('/logout', (req, res) => {
  res.clearCookie('adminToken')

  res.json({
    success: true,
    message: 'Logged out successfully.',
  })
})

// GET POLL FOR ADMIN
router.get('/poll', protectAdmin, async (req, res) => {
  try {
    const poll = await Poll.findOne().sort({
      createdAt: -1,
    })

    res.json({
      success: true,
      poll,
    })
  } catch (error) {
    res.status(500).json({
      message: 'Unable to load poll.',
    })
  }
})

// CREATE OR UPDATE POLL
router.put('/poll', protectAdmin, async (req, res) => {
  try {
    const {
      question,
      status,
      options,
    } = req.body

    if (!question?.trim()) {
      return res.status(400).json({
        message: 'Poll question is required.',
      })
    }

    if (!['active', 'closed'].includes(status)) {
      return res.status(400).json({
        message: 'Invalid poll status.',
      })
    }

    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({
        message: 'At least two options are required.',
      })
    }

    const cleanedOptions = options.map((option) => ({
      id: option.id,
      icon: option.icon || '👍',
      label: option.label.trim(),
      sub: option.sub?.trim() || 'New response',
      votes: Number(option.votes) || 0,
    }))

    let poll = await Poll.findOne().sort({
      createdAt: -1,
    })

    if (!poll) {
      poll = await Poll.create({
        question: question.trim(),
        status,
        options: cleanedOptions,
      })
    } else {
      poll.question = question.trim()
      poll.status = status

      /*
       * Preserve existing vote counts.
       *
       * If an administrator edits the option text,
       * existing votes shouldn't disappear.
       */
      poll.options = cleanedOptions.map((newOption) => {
        const existingOption = poll.options.find(
          (oldOption) => oldOption.id === newOption.id
        )

        return {
          ...newOption,
          votes: existingOption
            ? existingOption.votes
            : 0,
        }
      })

      await poll.save()
    }

    res.json({
      success: true,
      message: 'Poll saved successfully.',
      poll,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: 'Unable to save poll.',
    })
  }
})

export default router