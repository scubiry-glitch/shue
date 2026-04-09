import { IsString, MinLength } from 'class-validator';

export class MockLoginDto {
  @IsString()
  @MinLength(1, { message: 'email 不能为空' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'password 不能为空' })
  password: string;
}
