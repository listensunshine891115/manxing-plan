/**
 * 语音识别服务
 * 使用 coze-coding-dev-sdk 的 ASRClient
 * 支持音频 URL 和本地文件
 */

import { Injectable } from '@nestjs/common'
import { ASRClient, Config } from 'coze-coding-dev-sdk'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

@Injectable()
export class AsrService {
  private client: ASRClient
  private tempDir: string

  constructor() {
    const config = new Config()
    this.client = new ASRClient(config)
    this.tempDir = path.join(os.tmpdir(), 'asr-audio')
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true })
    }
  }

  /**
   * 语音转文字
   * @param audioPath 音频文件路径
   * @returns 识别结果文本
   */
  async speechToText(audioPath: string): Promise<string | null> {
    console.log(`[ASR] 开始语音识别: ${audioPath}`)

    try {
      // 读取音频文件并转为 base64
      const audioBuffer = fs.readFileSync(audioPath)
      const audioBase64 = audioBuffer.toString('base64')

      console.log(`[ASR] 音频大小: ${audioBuffer.length} bytes`)

      // 调用 SDK 的 ASR
      const result = await this.client.recognize({
        uid: `user_${Date.now()}`,
        base64Data: audioBase64
      })

      console.log(`[ASR] 识别成功: ${result.text.substring(0, 100)}...`)
      return result.text
    } catch (error: any) {
      console.error(`[ASR] 识别失败:`, error.message)
      return null
    }
  }

  /**
   * 从 URL 识别音频
   * @param audioUrl 音频文件 URL
   * @returns 识别结果文本
   */
  async speechToTextFromUrl(audioUrl: string): Promise<string | null> {
    console.log(`[ASR] 从 URL 识别: ${audioUrl}`)

    try {
      const result = await this.client.recognize({
        uid: `user_${Date.now()}`,
        url: audioUrl
      })

      console.log(`[ASR] 识别成功: ${result.text.substring(0, 100)}...`)
      return result.text
    } catch (error: any) {
      console.error(`[ASR] URL 识别失败:`, error.message)
      return null
    }
  }

  /**
   * 检查 ASR 服务是否可用
   */
  isAvailable(): boolean {
    return true // SDK 会自动处理认证
  }

  /**
   * 获取配置状态
   */
  getConfigStatus(): { baidu: boolean; xunfei: boolean; sdk: boolean } {
    return {
      baidu: false, // 不再使用百度
      xunfei: false, // 不再使用讯飞
      sdk: true // SDK 版本
    }
  }
}
