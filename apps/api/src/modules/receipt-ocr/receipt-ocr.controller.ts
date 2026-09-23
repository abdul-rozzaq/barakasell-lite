import {
  BadRequestException,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Audit } from '../../common/decorators/audit.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../generated/prisma/client.js';
import { ReceiptOcrService } from './receipt-ocr.service.js';

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB per file
// Same cap as Telegram's own album size — see receipt-photo.flow.ts.
const MAX_FILES = 10;

@Controller('receipts')
export class ReceiptOcrController {
  constructor(private readonly ocrService: ReceiptOcrService) {}

  @Post('ocr')
  @Roles(UserRole.ADMIN)
  @Audit({ action: 'Kirim OCR', entity: 'Receipt' })
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Faqat rasm fayli qabul qilinadi'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async ocr(@UploadedFiles() files?: Express.Multer.File[]) {
    if (!files || files.length === 0) throw new BadRequestException('Fayl yuborilmadi');
    return this.ocrService.parse(files.map((f) => ({ buffer: f.buffer, mimeType: f.mimetype })));
  }
}
