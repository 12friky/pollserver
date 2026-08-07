import jwt from 'jsonwebtoken'

const protectAdmin = (req, res, next) => {
  try {
    const token = req.cookies.adminToken

    if (!token) {
      return res.status(401).json({
        message: 'Admin authentication required.',
      })
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    )

    if (decoded.role !== 'admin') {
      return res.status(403).json({
        message: 'Admin access required.',
      })
    }

    req.admin = decoded

    next()
  } catch (error) {
    return res.status(401).json({
      message: 'Invalid or expired admin session.',
    })
  }
}

export default protectAdmin