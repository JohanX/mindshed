import { z } from 'zod/v4'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  APP_SECRET: z.string().optional(),
})

let _env: z.infer<typeof envSchema> | null = null

export function getEnv() {
  if (_env) return _env
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.issues)
    throw new Error('Missing required environment variables. Check server logs.')
  }
  _env = parsed.data
  return _env
}
