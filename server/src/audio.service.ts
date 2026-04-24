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

    const outputPath = path.join(this.tempDir, `audio_${Date.now()}.wav`)

    try {
      // 1. 使用 yt-dlp 下载视频并提取音频
      // -f best: 选择最佳画质
      // --extract-audio: 提取音频
      // --audio-format wav: 转为 wav
      // --audio-quality 0: 最高质量
      const cmd = [
        'yt-dlp',
        '-f', 'best',
        '--extract-audio',
        '--audio-format', 'wav',
        '--audio-quality', '0',
        '-o', outputPath.replace('.wav', '.%(ext)s'),
        '--no-playlist',
        '--no-check-certificate',
        videoUrl
      ].join(' ')

      console.log(`[Audio] 执行命令: ${cmd}`)
      execSync(cmd, { stdio: 'pipe' })

      // yt-dlp 实际输出路径可能不是我们指定的
      const actualPath = outputPath.replace('.wav', '.wav')
      if (!fs.existsSync(actualPath.replace('.wav', '.wav'))) {
        // 查找实际生成的文件
        const files = fs.readdirSync(this.tempDir)
        const audioFile = files.find(f => f.startsWith('audio_') && f.endsWith('.wav'))
        if (audioFile) {
          return path.join(this.tempDir, audioFile)
        }
      }

      // 2. 如果 yt-dlp 输出不是 wav，转换一下
      if (!outputPath.endsWith('.wav')) {
        const wavPath = outputPath.replace(/\.\w+$/, '.wav')
        await this.convertToWav(outputPath, wavPath)
        return wavPath
      }

      return outputPath
    } catch (error) {
      console.error(`[Audio] 提取音频失败:`, error)
      
      // 尝试备用方案：直接下载然后转换
      return await this.fallbackExtract(videoUrl)
    }
  }

  /**
   * 备用方案：使用 ffmpeg 直接处理
   */
  private async fallbackExtract(videoUrl: string): Promise<string> {
    const outputPath = path.join(this.tempDir, `audio_${Date.now()}.wav`)
    
    try {
      // 使用 ffmpeg 直接从 URL 提取音频
      const cmd = `ffmpeg -i "${videoUrl}" -vn -acodec pcm_s16le -ar 16000 -ac 1 -y "${outputPath}"`
      execSync(cmd, { stdio: 'pipe' })
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
