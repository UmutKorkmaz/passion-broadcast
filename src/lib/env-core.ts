import { z } from "zod";

const commonSchema = z.object({
  GOOGLE_AI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash"),
  ELEVENLABS_API_KEY: z.string().min(1),
  ELEVENLABS_VOICE_ID: z.string().min(1),
  ELEVENLABS_MODEL_ID: z.string().default("eleven_multilingual_v2"),
  INGEST_SECRET: z.string().min(24),
  CRON_SECRET: z.string().min(24),
});

const snowflakeSchema = z
  .object({
    SNOWFLAKE_ACCOUNT: z.string().min(1),
    SNOWFLAKE_USERNAME: z.string().min(1),
    SNOWFLAKE_PRIVATE_KEY_PATH: z.string().optional(),
    SNOWFLAKE_PRIVATE_KEY_B64: z.string().optional(),
    SNOWFLAKE_ROLE: z.string().min(1),
    SNOWFLAKE_WAREHOUSE: z.string().min(1),
    SNOWFLAKE_DATABASE: z.string().min(1),
    SNOWFLAKE_SCHEMA: z.string().min(1),
  })
  .refine(
    (value) =>
      Boolean(
        value.SNOWFLAKE_PRIVATE_KEY_B64 ||
          value.SNOWFLAKE_PRIVATE_KEY_PATH,
      ),
    "Snowflake private key is required",
  );

export type ProviderEnv = z.infer<typeof commonSchema>;
export type SnowflakeEnv = z.infer<typeof snowflakeSchema>;

export function getProviderEnv(): ProviderEnv {
  return commonSchema.parse(process.env);
}

export function getSnowflakeEnv(): SnowflakeEnv {
  return snowflakeSchema.parse(process.env);
}

export function getIngestSecrets(): Pick<
  ProviderEnv,
  "INGEST_SECRET" | "CRON_SECRET"
> {
  return commonSchema
    .pick({ INGEST_SECRET: true, CRON_SECRET: true })
    .parse(process.env);
}
