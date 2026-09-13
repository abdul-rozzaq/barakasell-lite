import { ArrayMinSize, IsArray, IsNumber, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CountedLineDto {
  @IsString()
  productId!: string;

  @IsNumber()
  @Min(0)
  countedQty!: number;
}

export class UpdateCountLinesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CountedLineDto)
  lines!: CountedLineDto[];
}
