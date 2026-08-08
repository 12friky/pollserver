import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { launch } from 'puppeteer-core'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const cacheDir = path.join(__dirname, '..', 'public', 'social-preview')

const browserPath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_BIN

const ensureCacheDir = async () => {
  await mkdir(cacheDir, { recursive: true })
}

const getImageCachePath = (pollId, version) => {
  const safeId = String(pollId).replace(/[^a-zA-Z0-9._-]/g, '-')
  return path.join(cacheDir, `${safeId}-${version}.png`)
}

const buildHtml = (poll, imageVersion) => {
  const question = (poll?.question || 'Ghana Speaks Poll').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const options = Array.isArray(poll?.options) ? poll.options : []
  const totalVotes = options.reduce((sum, option) => sum + (option.votes || 0), 0)

  const bars = options
    .slice(0, 4)
    .map((option, index) => {
      const votes = Number(option.votes || 0)
      const pct = totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100)
      const color = ['#2563eb', '#16a34a', '#f59e0b', '#8b5cf6'][index % 4]
      return `
        <div class="row">
          <div class="row-top">
            <span>${(option.label || 'Option').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
            <span>${pct}%</span>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
        </div>
      `
    })
    .join('')

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            margin: 0;
            width: 1200px;
            height: 630px;
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%);
            color: #0f172a;
          }
          .card {
            width: 1120px;
            height: 550px;
            margin: 40px auto;
            padding: 28px 36px;
            border-radius: 24px;
            background: white;
            box-shadow: 0 24px 70px rgba(15, 23, 42, 0.16);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .badge {
            display: inline-block;
            font-size: 13px;
            letter-spacing: 1px;
            font-weight: 700;
            padding: 8px 12px;
            background: #eff6ff;
            color: #2563eb;
            border-radius: 999px;
            width: fit-content;
          }
          .title {
            font-size: 28px;
            font-weight: 800;
            line-height: 1.3;
            color: #111827;
            margin: 12px 0 10px;
          }
          .sub {
            font-size: 15px;
            color: #475569;
            margin-bottom: 12px;
          }
          .content { display: grid; grid-template-columns: 1.4fr 0.9fr; gap: 20px; align-items: stretch; }
          .left { display: flex; flex-direction: column; gap: 10px; }
          .right { background: #f8fafc; border-radius: 16px; padding: 16px; border: 1px solid #e2e8f0; }
          .row { margin-bottom: 10px; }
          .row-top { display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 6px; }
          .bar-track { height: 10px; border-radius: 999px; background: #e2e8f0; overflow: hidden; }
          .bar-fill { height: 100%; border-radius: 999px; }
          .footer { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #64748b; margin-top: 10px; }
          .cta { font-size: 14px; font-weight: 700; color: #2563eb; }
        </style>
      </head>
      <body>
        <div class="card">
          <div>
            <div class="badge">GHANA SPEAKS 🇬🇭</div>
            <div class="title">${question}</div>
            <div class="sub">Live poll results • Vote on Ghana Speaks</div>
          </div>
          <div class="content">
            <div class="left">
              ${bars}
            </div>
            <div class="right">
              <div class="sub">Total votes</div>
              <div class="title" style="font-size:24px;margin:0 0 8px;">${totalVotes}</div>
              <div class="sub">This preview updates with the latest poll results.</div>
              <div class="cta">Vote on Ghana Speaks</div>
            </div>
          </div>
          <div class="footer">
            <span>ghanaspeaks.com</span>
            <span>${imageVersion}</span>
          </div>
        </div>
      </body>
    </html>
  `
}

const getVersionSignature = (poll) => {
  const base = JSON.stringify({
    question: poll?.question || '',
    options: (poll?.options || []).map((option) => ({
      id: option.id,
      label: option.label,
      votes: option.votes || 0,
    })),
    status: poll?.status || '',
    updatedAt: poll?.updatedAt || '',
  })

  return createHash('sha256').update(base).digest('hex').slice(0, 12)
}

export const generatePollSocialPreview = async (poll) => {
  await ensureCacheDir()

  const pollId = poll?.pollId || poll?._id?.toString() || 'unknown'
  const version = getVersionSignature(poll)
  const cachePath = getImageCachePath(pollId, version)

  try {
    await access(cachePath)
    return cachePath
  } catch {
    // continue to generate
  }

  let browser = null

  try {
    browser = await launch({
      executablePath: browserPath,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const page = await browser.newPage()
    await page.setContent(buildHtml(poll, `v${version}`), { waitUntil: 'networkidle0' })
    await page.setViewport({ width: 1200, height: 630 })
    await page.screenshot({ path: cachePath, type: 'png' })

    return cachePath
  } finally {
    if (browser) await browser.close()
  }
}

export const getSocialPreviewUrl = (req, poll) => {
  const host = process.env.PUBLIC_BASE_URL || req.protocol + '://' + req.get('host')
  const pollIdentifier = poll?.pollId || poll?._id?.toString()
  return `${host}/api/polls/${pollIdentifier}/share-image`
}

export const getSocialPreviewFilePath = (poll) => {
  const pollId = poll?.pollId || poll?._id?.toString() || 'unknown'
  const version = getVersionSignature(poll)
  return getImageCachePath(pollId, version)
}
