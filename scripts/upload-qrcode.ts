import { S3Storage } from 'coze-coding-dev-sdk'
import * as fs from 'fs'

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing'
})

async function uploadQRCode() {
  const filePath = '/tmp/gh_qrcode.jpg'
  const fileContent = fs.readFileSync(filePath)
  
  const key = await storage.uploadFile({
    fileContent: fileContent,
    fileName: 'wechat/official-account-qrcode.jpg',
    contentType: 'image/jpeg'
  })
  
  console.log('Upload key:', key)
  
  const url = await storage.generatePresignedUrl({
    key,
    expireTime: 86400 * 365 // 1 year
  })
  
  console.log('Public URL:', url)
}

uploadQRCode().catch(console.error)
