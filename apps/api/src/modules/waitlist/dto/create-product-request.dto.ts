import { IsOptional, IsString } from 'class-validator';

// Used by the authenticated POS-facing endpoint (POST /product-requests) —
// source is always POS there, never client-supplied (see
// waitlist.controller.ts). The bot's own endpoint
// (POST /bot/customers/:id/waitlist) builds its own input with source BOT.
export class CreateProductRequestDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  rawText?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
