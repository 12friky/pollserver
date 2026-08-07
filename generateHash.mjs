import argon2 from 'argon2'

const password = 'Sticker@100'

;(async () => {
  try {
    const hash = await argon2.hash(password)
    console.log(hash)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
})()
