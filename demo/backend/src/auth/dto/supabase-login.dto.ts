import { IsString, MinLength } from 'class-validator';

export class SupabaseLoginDto {
  @IsString()
  @MinLength(1, { message: 'supabaseToken 不能为空' })
  supabaseToken: string;
}
