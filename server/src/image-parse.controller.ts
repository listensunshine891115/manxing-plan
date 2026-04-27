import { Controller, Post, Body, UseInterceptors, UploadedFile } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ImageParseService } from '@/image-parse.service'

@Controller('trip')
export class ImageParseController {
  constructor(private readonly imageParseService: ImageParseService) {}

  /**
   * 上传图片
   * POST /api/trip/upload-image
   */
  @Post('upload-image')
  @UseInterceptors(FileInterceptor('image', {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, callback) => {
      // 只允许图片
      if (file.mimetype.match(/^image\/(jpeg|png|gif|webp)$/)) {
        callback(null, true)
      } else {
        callback(new Error('只支持 JPG/PNG/GIF/WebP 格式图片'), false)
      }
    }
  }))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    console.log('[POST] /api/trip/upload-image', {
      originalname: file?.originalname,
      mimetype: file?.mimetype,
      size: file?.size
    })

    if (!file) {
      return {
        code: 400,
        msg: '请上传图片文件',
        success: false
      }
    }

    const result = await this.imageParseService.uploadImage(file)

    if (result.success) {
      return {
        code: 200,
        msg: '上传成功',
        success: true,
        data: {
          url: result.url
        }
      }
    } else {
      return {
        code: 500,
        msg: result.message || '上传失败',
        success: false
      }
    }
  }

  /**
   * 识别图片中的灵感点
   * POST /api/trip/parse-image
   */
  @Post('parse-image')
  async parseImage(@Body() body: {
    userId: string
    imageUrl: string
  }) {
    console.log('[POST] /api/trip/parse-image', body)

    if (!body.imageUrl) {
      return {
        code: 400,
        msg: '请提供图片URL',
        success: false
      }
    }

    const result = await this.imageParseService.parseImageFromUrl(body.imageUrl)

    if (result.success) {
      return {
        code: 200,
        msg: '识别成功',
        success: true,
        data: result.data
      }
    } else {
      return {
        code: 200,
        msg: result.message || '识别失败',
        success: true,
        data: result.data
      }
    }
  }
}
