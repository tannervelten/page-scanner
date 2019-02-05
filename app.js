const express = require('express')
const puppeteer = require('puppeteer')
const vision = require('@google-cloud/vision')
const sgMail = require('@sendgrid/mail')
const fs = require('fs')
const AWS = require('aws-sdk')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 5000

function isSoldOut(text) {
  return text.toLowerCase().includes('sold out')
}

async function scanPage() {
  const client = new vision.ImageAnnotatorClient()

  const [result] = await client.textDetection('resources/hoodie.png')
  const soldOut = isSoldOut(result.fullTextAnnotation.text)
  if (!soldOut) {
    sendEmail()
    return
  }
  console.log('Hoodie still sold out')
}

const sendEmail = () => {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
  const msg = {
    to: 'tannervelten@gmail.com',
    from: 'page-scanner@gmail.com',
    subject: 'Dreamville hoodie available!',
    text: 'and easy to do anywhere, even with Node.js',
    html: '<strong>and easy to do anywhere, even with Node.js</strong>',
  }
  sgMail.send(msg)
}

async function screenshotWebpage(url) {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  const page = await browser.newPage()
  await page.goto(url)
  await page.screenshot({ path: 'resources/hoodie.png', fullPage: true })

  try {
    await scanPage()
  } catch (err) {
    console.log('err:', err)
  }
  await browser.close()
}

async function downloadCredentials() {
  const fileKey = 'page-scanner-21b36b626096.json'
  if (await !fs.existsSync(`${fileKey}`)) {

    await AWS.config.update({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: 'us-east-1',
    })
    const s3 = new AWS.S3()
    const options = {
      Bucket: 'page-scanner-credentials',
      Key: fileKey,
    }

    await s3.getObject(options).createReadStream().pipe(fs.createWriteStream(`${fileKey}`))
  }
}

async function runJob() {
  const url = 'https://shop.dreamville.com/products/dreamville-hoodie-black?variant=8157889396826'
  await downloadCredentials()
  await screenshotWebpage(url)
}

runJob()

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`)
})
