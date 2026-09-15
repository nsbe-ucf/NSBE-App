import { IsBoolean, ValidateIf } from 'class-validator';

export class UpdateMemberDuesDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  chapterDuesSelfReported?: boolean;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  nationalDuesSelfReported?: boolean;
}
