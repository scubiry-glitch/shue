import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/**
 * Mark a route as public (no JWT required).
 * Applied globally via JwtAuthGuard which checks this metadata.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
