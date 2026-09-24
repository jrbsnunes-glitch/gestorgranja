import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'demo' })
  @IsString()
  tenantSlug!: string;

  @ApiProperty({ example: 'admin', description: 'Usuário de login (não use e-mail)' })
  @IsString()
  @Matches(/^[a-z0-9._-]{3,32}$/i, {
    message: 'Usuário: 3–32 caracteres (letras, números, . _ -)',
  })
  username!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password!: string;
}
