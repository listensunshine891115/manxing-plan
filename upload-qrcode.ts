import { S3Storage } from "coze-coding-dev-sdk";
import { readFileSync } from "fs";

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

async function main() {
  const fileContent = readFileSync("./assets/qrcode_for_gh_8d07103cbd76_258.jpg");
  const key = await storage.uploadFile({
    fileContent,
    fileName: "wechat-qrcode.jpg",
    contentType: "image/jpeg",
  });
  console.log("Uploaded key:", key);
  
  const url = await storage.generatePresignedUrl({
    key,
    expireTime: 86400 * 365, // 1 year
  });
  console.log("Access URL:", url);
}

main();
