import mongoose from 'mongoose'

const voteSchema = new mongoose.Schema(
  {
    pollId: {
      type: String,
      required: true,
      index: true,
    },

    pollRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Poll',
      index: true,
    },

    optionId: {
      type: String,
      required: true,
    },

    voterId: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
)

voteSchema.index(
  { pollId: 1, voterId: 1 },
  { unique: true }
)

export default mongoose.model('Vote', voteSchema)