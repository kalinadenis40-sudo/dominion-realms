import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional, IsIn } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Пароль минимум 8 символов' })
  @MaxLength(64, { message: 'Пароль максимум 64 символа' })
  password: string;

  @IsString()
  @MinLength(3, { message: 'Никнейм минимум 3 символа' })
  @MaxLength(32, { message: 'Никнейм максимум 32 символа' })
  @Matches(/^[a-zA-Zа-яА-ЯёЁ0-9_\-]+$/, {
    message: 'Никнейм: только буквы, цифры, _ и -',
  })
  nickname: string;

  @IsOptional()
  @IsIn(['ru', 'en', 'de'])
  language?: string;
}
