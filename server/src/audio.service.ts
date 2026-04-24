/**
 * 音频处理服务
 * 使用 yt-dlp 下载视频 + ffmpeg 提取音频
 */

import { Injectable } from '@nestjs/common'
import { execSync, exec } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

@Injectable()
export class AudioService {
  private readonly tempDir: string

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'audio-extract')
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true })
    }
  }

  /**
   * 从视频 URL 提取音频
   * @param videoUrl 视频链接
   * @returns 音频文件路径
   */
  async extractAudioFromUrl(videoUrl: string): Promise<string> {
    console.log(`[Audio] 开始提取音频: ${videoUrl}`)

    const timestamp = Date.now()
    const tempDir = this.tempDir

    try {
      // 1. 使用 yt-dlp 下载并提取音频为 wav
      const tempOutput = path.join(tempDir, `temp_${timestamp}`)

      // 简化命令，不指定格式选择
      const cmd = `yt-dlp --extract-audio --audio-format wav --audio-quality 0 -o "${tempOutput}.%(ext)s" --no-playlist --no-check-certificate "${videoUrl}"`
      
      console.log(`[Audio] 执行命令: ${cmd}`)
      execSync(cmd, { stdio: 'pipe', shell: '/bin/bash' })

      // 查找生成的 wav 文件
      const files = fs.readdirSync(tempDir)
      const generatedFile = files.find(f => f.startsWith(`temp_${timestamp}`) && f.endsWith('.wav'))
      
      if (generatedFile) {
        const wavPath = path.join(tempDir, `audio_${timestamp}.wav`)
        // 重命名为标准格式
        fs.renameSync(path.join(tempDir, generatedFile), wavPath)
        console.log(`[Audio] 音频已提取: ${wavPath}`)
        return wavPath
      }

      throw new Error('未找到生成的音频文件')
    } catch (error) {
      console.error(`[Audio] 提取音频失败:`, error)
      
      // 尝试备用方案：使用 ffmpeg 直接处理
      const outputPath = path.join(tempDir, `audio_${timestamp}.wav`)
      return await this.fallbackExtract(videoUrl, outputPath)
    }
  }

  /**
   * 备用方案：使用 ffmpeg 直接处理
   */
  private async fallbackExtract(videoUrl: string, outputPath: string): Promise<string> {
    try {
      // 使用 ffmpeg 直接从 URL 提取音频
      const cmd = `ffmpeg -i "${videoUrl}" -vn -acodec pcm_s16le -ar 16000 -ac 1 -y "${outputPath}"`
      console.log(`[Audio] ffmpeg 备用方案: ${cmd}`)
      execSync(cmd, { stdio: 'pipe', shell: '/bin/bash' })
      return outputPath
    } catch (error) {
      console.error(`[Audio] ffmpeg 备用方案也失败:`, error)
      throw new Error('音频提取失败')
    }
  }

  /**
   * 转换音频为指定格式
   */
  async convertToWav(inputPath: string, outputPath: string): Promise<void> {
    try {
      const cmd = `ffmpeg -i "${inputPath}" -ar 16000 -ac 1 -acodec pcm_s16le -y "${outputPath}"`
      execSync(cmd, { stdio: 'pipe' })
      console.log(`[Audio] 音频转换完成: ${outputPath}`)
    } catch (error) {
      console.error(`[Audio] 音频转换失败:`, error)
      throw error
    }
  }

  /**
   * 从本地视频文件提取音频
   */
  async extractAudioFromFile(filePath: string): Promise<string> {
    const outputPath = path.join(this.tempDir, `audio_${Date.now()}.wav`)
    await this.convertToWav(filePath, outputPath)
    return outputPath
  }

  /**
   * 清理临时文件
   */
  cleanup(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        console.log(`[Audio] 清理文件: ${filePath}`)
      }
    } catch (error) {
      console.error(`[Audio] 清理失败:`, error)
    }
  }

  /**
   * 检查依赖是否可用
   */
  checkDependencies(): { ytDlp: boolean; ffmpeg: boolean } {
    let ytDlp = false
    let ffmpeg = false

    try {
      execSync('yt-dlp --version', { stdio: 'pipe' })
      ytDlp = true
    } catch {
      ytDlp = false
    }

    try {
      execSync('ffmpeg -version', { stdio: 'pipe' })
      ffmpeg = true
    } catch {
      ffmpeg = false
    }

    return { ytDlp, ffmpeg }
  }
}
