import mongoose from 'mongoose'

const optionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },

    icon: {
      type: String,
      default: '👍',
      maxlength: 10,
    },

    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    sub: {
      type: String,
      default: 'New response',
      trim: true,
      maxlength: 200,
    },

    votes: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
)

const pollSchema = new mongoose.Schema(
  {
    pollId: {
      type: String,
      unique: true,
      sparse: true,
    },

    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    status: {
      type: String,
      enum: ['draft', 'active', 'closed', 'archived'],
      default: 'active',
    },

    options: {
      type: [optionSchema],
      validate: {
        validator: function (options) {
          return options.length >= 2
        },
        message: 'A poll must have at least two options.',
      },
    },
  },
  {
    timestamps: true,
  }
)

pollSchema.pre('save', function (next) {
  if (!this.pollId) {
    this.pollId = this._id?.toString() || `poll-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  next()
})

export default mongoose.model('Poll', pollSchema)