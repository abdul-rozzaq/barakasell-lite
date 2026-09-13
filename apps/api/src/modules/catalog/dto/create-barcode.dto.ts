import { IsString, Matches } from 'class-validator';

export class CreateBarcodeDto {
  @IsString()
  @Matches(/^\d{6,14}$/, { message: 'Barcode faqat raqamlardan iborat bo\'lishi kerak' })
  code!: string;
}
