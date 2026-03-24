import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { DB_POOL } from '../database/database.module';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ============================================================
  // REGISTER
  // ============================================================
  async register(dto: RegisterDto) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Check email exists
      const emailCheck = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [dto.email.toLowerCase()],
      );
      if (emailCheck.rows.length > 0) {
        throw new ConflictException('Email уже зарегистрирован');
      }

      // Check nickname exists
      const nickCheck = await client.query(
        'SELECT id FROM player_profiles WHERE nickname = $1',
        [dto.nickname],
      );
      if (nickCheck.rows.length > 0) {
        throw new ConflictException('Никнейм уже занят');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(dto.password, 12);

      // Create user
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash)
         VALUES ($1, $2)
         RETURNING id, email, role, created_at`,
        [dto.email.toLowerCase(), passwordHash],
      );
      const user = userResult.rows[0];

      // Create profile
      const profileResult = await client.query(
        `INSERT INTO player_profiles (user_id, nickname, language)
         VALUES ($1, $2, $3)
         RETURNING id, nickname`,
        [user.id, dto.nickname, dto.language || 'ru'],
      );
      const profile = profileResult.rows[0];

      await client.query('COMMIT');

      // Auto-create starting settlement (async, don't block registration)
      this.createStartingSettlementAsync(profile.id, dto.nickname);

      // Generate tokens
      const tokens = await this.generateTokens(user.id, profile.id, user.role);

      // Save refresh token
      await this.saveRefreshToken(user.id, tokens.refreshToken);

      return {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        profile: {
          id: profile.id,
          nickname: profile.nickname,
        },
        ...tokens,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ============================================================
  // LOGIN
  // ============================================================
  async login(dto: LoginDto, ipAddress?: string) {
    // Find user
    const result = await this.db.query(
      `SELECT u.id, u.email, u.password_hash, u.role, u.is_active,
              p.id as profile_id, p.nickname
       FROM users u
       JOIN player_profiles p ON p.user_id = u.id
       WHERE u.email = $1`,
      [dto.email.toLowerCase()],
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const user = result.rows[0];

    if (!user.is_active) {
      throw new UnauthorizedException('Аккаунт заблокирован');
    }

    // Check password
    const isValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    // Update last login
    await this.db.query(
      `UPDATE users SET last_login_at = NOW(), last_login_ip = $1, login_count = login_count + 1
       WHERE id = $2`,
      [ipAddress || null, user.id],
    );

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.profile_id, user.role);
    await this.saveRefreshToken(user.id, tokens.refreshToken, ipAddress);

    return {
      user: { id: user.id, email: user.email, role: user.role },
      profile: { id: user.profile_id, nickname: user.nickname },
      ...tokens,
    };
  }

  // ============================================================
  // REFRESH
  // ============================================================
  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });

      // Check token in DB
      const tokenHash = await this.hashToken(refreshToken);
      const result = await this.db.query(
        `SELECT rt.*, u.role FROM refresh_tokens rt
         JOIN users u ON u.id = rt.user_id
         WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > NOW()`,
        [tokenHash],
      );

      if (result.rows.length === 0) {
        throw new UnauthorizedException('Refresh token недействителен');
      }

      // Rotate token
      await this.db.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1',
        [tokenHash],
      );

      const tokens = await this.generateTokens(
        payload.sub,
        payload.profileId,
        result.rows[0].role,
      );
      await this.saveRefreshToken(payload.sub, tokens.refreshToken);

      return tokens;
    } catch {
      throw new UnauthorizedException('Refresh token недействителен');
    }
  }

  // ============================================================
  // LOGOUT
  // ============================================================
  async logout(refreshToken: string) {
    const tokenHash = await this.hashToken(refreshToken);
    await this.db.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1',
      [tokenHash],
    );
    return { success: true };
  }

  // ============================================================
  // GET PROFILE
  // ============================================================
  async getMe(userId: string) {
    const result = await this.db.query(
      `SELECT u.id, u.email, u.role, u.created_at,
              p.id as profile_id, p.nickname, p.avatar_url, p.language,
              p.power_rating, p.economy_rating, p.war_rating,
              p.total_settlements, p.total_victories, p.total_defeats,
              p.is_premium, p.premium_expires_at
       FROM users u
       JOIN player_profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedException('Пользователь не найден');
    }

    return result.rows[0];
  }

  // ============================================================
  // HELPERS
  // ============================================================
  private async createStartingSettlementAsync(profileId: string, nickname: string) {
    try {
      // Dynamically import to avoid circular dependency
      const { Pool } = await import('pg');
      await this.db.query(
        `SELECT create_starting_settlement_placeholder($1, $2)`,
        [profileId, nickname],
      ).catch(() => {
        // Will be handled by settlements module directly
      });
    } catch (_) { /* silent - settlement created via /settlements/start */ }
  }

  private async generateTokens(userId: string, profileId: string, role: string) {
    const payload = { sub: userId, profileId, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_EXPIRES', '15m'),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES', '30d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: string, token: string, ip?: string) {
    const tokenHash = await this.hashToken(token);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, ip_address, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, tokenHash, ip || null, expiresAt],
    );
  }

  private async hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, 5);
  }
}
