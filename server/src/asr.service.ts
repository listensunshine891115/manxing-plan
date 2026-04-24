/**
 * 语音识别服务
 * 支持百度 ASR（主）和讯飞 ASR（备）
 * 
 * 免费额度：
 * - 百度：每日 10 万次
 * - 讯飞：每日 10 万次
 */

import { Injectable } from '@nestjs/common'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as http from 'http'

// 百度 ASR 配置
const BAIDU_ASR_CONFIG = {
  appId: process.env.BAIDU_ASR_APP_ID || '',
  apiKey: process.env.BAIDU_ASR_API_KEY || '',
  secretKey: process.env.BAIDU_ASR_SECRET_KEY || '',
  format: 'pcm',  // 音频格式
  rate: 16000,    // 采样率
  devPid: 1737,   // 中文
}

// 讯飞 ASR 配置
const XUNFEI_ASR_CONFIG = {
  appId: process.env.XUNFEI_ASR_APP_ID || '',
  apiKey: process.env.XUNFEI_ASR_API_KEY || '',
  apiSecret: process.env.XUNFEI_ASR_API_SECRET || '',
  format: 'wav',  // 音频格式
  rate: 16000,    // 采样率
}

@Injectable()
export class AsrService {
  /**
   * 语音转文字（自动降级）
   * @param audioPath 音频文件路径
   * @returns 识别结果文本
   */
  async speechToText(audioPath: string): Promise<string | null> {
    console.log(`[ASR] 开始语音识别: ${audioPath}`)

    // 1. 优先尝试百度 ASR
    const baiduApiKey = process.env.BAIDU_ASR_API_KEY
    const baiduAppId = process.env.BAIDU_ASR_APP_ID
    if (baiduApiKey && baiduAppId) {
      try {
        const result = await this.baiduASR(audioPath, baiduAppId, baiduApiKey)
        if (result) {
          console.log(`[ASR] 百度 ASR 成功`)
          return result
        }
      } catch (error) {
        console.log(`[ASR] 百度 ASR 失败:`, error)
      }
    }

    // 2. 降级尝试讯飞 ASR
    const xunfeiAppId = process.env.XUNFEI_ASR_APP_ID
    const xunfeiApiKey = process.env.XUNFEI_ASR_API_KEY
    const xunfeiApiSecret = process.env.XUNFEI_ASR_API_SECRET
    if (xunfeiAppId && xunfeiApiKey) {
      try {
        const result = await this.xunfeiASR(audioPath, xunfeiAppId, xunfeiApiKey, xunfeiApiSecret || '')
        if (result) {
          console.log(`[ASR] 讯飞 ASR 成功`)
          return result
        }
      } catch (error) {
        console.log(`[ASR] 讯飞 ASR 失败:`, error)
      }
    }

    console.log(`[ASR] 所有 ASR 服务均失败`)
    return null
  }

  /**
   * 百度 ASR
   * 文档: https://cloud.baidu.com/doc/SPEECH/s/AsynRec API
   */
  private async baiduASR(audioPath: string, appId: string, apiKey: string): Promise<string | null> {
    const secretKey = process.env.BAIDU_ASR_SECRET_KEY || ''
    const format = 'pcm'
    const rate = 16000
    const devPid = 1737

    // 1. 获取 access token
    const token = await this.getBaiduAccessToken(apiKey, secretKey)
    if (!token) {
      throw new Error('获取百度 access token 失败')
    }

    // 2. 读取音频文件并转为 base64
    const audioBuffer = fs.readFileSync(audioPath)
    const audioBase64 = audioBuffer.toString('base64')

    console.log(`[ASR] 原始音频大小: ${audioBuffer.length} bytes`)

    // 3. 百度 ASR 限制音频大小 10MB，超过则截断到 60 秒
    // 16kHz 采样率, 单声道, 16bit = 16000 * 1 * 2 = 32000 bytes/秒
    const maxDuration = 60 // 最大 60 秒
    const maxSize = 16000 * 1 * 2 * maxDuration // = 1,920,000 bytes
    let speechData = audioBase64
    let speechLen = audioBuffer.length

    if (audioBuffer.length > maxSize) {
      console.log(`[ASR] 音频过长(${audioBuffer.length} bytes)，截断到 ${maxSize} bytes (${maxDuration}秒)`)
      speechData = audioBase64.substring(0, maxSize * 4 / 3) // base64 每 3 字节编码为 4 字符
      speechLen = maxSize
    }

    // 5. 调用百度 ASR API（短语音识别）
    // 使用 vop.baidu.com/server_api
    const cuid = `user_${Date.now()}`
    const result = await this.httpRequest({
      method: 'POST',
      host: 'vop.baidu.com',
      path: '/server_api',
      headers: {
        'Content-Type': 'application/json',
      }
    }, {
      format: format,
      rate: rate,
      channel: 1,
      token: token,
      speech: speechData,
      len: speechLen,
      dev_pid: devPid,
      cuid: cuid,
    })

    if (result.err_no === 0 && result.result) {
      return result.result[0]
    }

    console.log(`[ASR] 百度 ASR 错误: ${result.err_msg || result.errmsg}`)
    return null
  }

  /**
   * 获取百度 access token
   */
  private async getBaiduAccessToken(apiKey: string, secretKey: string): Promise<string | null> {
    const cacheKey = `baidu_asr_token_${apiKey}`
    
    try {
      const result = await this.httpRequest({
        method: 'POST',
        host: 'aip.baidubce.com',
        path: `/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`,
      })

      if (result.access_token) {
        return result.access_token
      }
    } catch (error) {
      console.error(`[ASR] 获取百度 token 失败:`, error)
    }

    return null
  }

  /**
   * 讯飞 ASR
   * 文档: https://www.xfyun.cn/doc/asr/voicetranscription/API.html
   */
  /**
   * 讯飞 ASR（实时语音转写）
   */
  private async xunfeiASR(audioPath: string, appId: string, apiKey: string, apiSecret: string): Promise<string | null> {
    const format = 'wav'
    const rate = 16000

    // 读取音频文件
    const audioBuffer = fs.readFileSync(audioPath)
    const audioBase64 = audioBuffer.toString('base64')

    // 生成讯飞 API 签名
    const ts = Math.floor(Date.now() / 1000).toString()
    const signStr = `${appId}${ts}`
    const signature = crypto
      .createHmac('sha1', apiSecret)
      .update(signStr)
      .digest('hex')

    // X-Param 需要包含正确的参数
    const paramObj = {
      aue: 'raw',
      engine_type: 'sms16k',
      sample: rate,
    }
    const paramBase64 = Buffer.from(JSON.stringify(paramObj)).toString('base64')

    // 构建请求 - 使用正确的讯飞语音转写 API
    const body = {
      common: {
        app_id: appId,
      },
      business: {
        aue: 'raw',
        lang: 'zh',
        sample: rate,
      },
      data: {
        status: 2,  // 音频结束
        format: format,
        encoding: 'base64',
        audio: audioBase64,
      },
    }

    try {
      const result = await this.httpRequest({
        method: 'POST',
        host: 'api.xf-yun.com',
        path: '/v1/private/s2b52d2fe/deploy/public/para/stream',
        headers: {
          'Content-Type': 'application/json',
          'X-Appid': appId,
          'X-CurTime': ts,
          'X-Param': paramBase64,
          'X-CheckSum': signature,
        }
      }, body)

      // 解析讯飞响应
      if (result.code === 0 && result.data && result.data.result) {
        const texts = result.data.result.map((r: any) => r.best_text || '')
        return texts.filter(Boolean).join('')
      }

      console.log(`[ASR] 讯飞 ASR 错误: code=${result.code}, desc=${result.desc || result.message}`)
      return null
    } catch (error: any) {
      console.log(`[ASR] 讯飞 ASR 请求失败: ${error.message}`)
      return null
    }
  }

  /**
   * HTTP 请求封装
   */
  private httpRequest(options: any, data?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const reqOptions = {
        hostname: options.host,
        port: options.port || 443,
        path: options.path,
        method: options.method,
        headers: options.headers || {},
      }

      const req = https.request(reqOptions, (res) => {
        let body = ''
        res.on('data', (chunk) => body += chunk)
        res.on('end', () => {
          try {
            resolve(JSON.parse(body))
          } catch {
            resolve(body)
          }
        })
      })

      req.on('error', reject)

      if (data) {
        const bodyStr = JSON.stringify(data)
        reqOptions.headers['Content-Length'] = Buffer.byteLength(bodyStr)
        req.write(bodyStr)
      }

      req.end()
    })
  }

  /**
   * 检查 ASR 服务是否可用
   */
  isAvailable(): boolean {
    return !!(process.env.BAIDU_ASR_API_KEY || process.env.XUNFEI_ASR_APP_ID)
  }

  /**
   * 获取配置状态
   */
  getConfigStatus(): { baidu: boolean; xunfei: boolean } {
    return {
      baidu: !!(process.env.BAIDU_ASR_API_KEY && process.env.BAIDU_ASR_APP_ID),
      xunfei: !!(process.env.XUNFEI_ASR_APP_ID && process.env.XUNFEI_ASR_API_KEY),
    }
  }
}
