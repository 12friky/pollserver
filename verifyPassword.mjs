import dotenv from 'dotenv'
import argon2 from 'argon2'

dotenv.config()

const hash = process.env.ADMIN_PASSWORD_HASH
const password = 'Sticker@100'

;(async () => {
  try {
    const ok = await argon2.verify(hash, password)
    console.log('verify:', ok)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
})()
