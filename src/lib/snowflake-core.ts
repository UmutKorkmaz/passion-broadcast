import { readFile } from "node:fs/promises";
import path from "node:path";
import snowflake from "snowflake-sdk";

import { getSnowflakeEnv } from "@/lib/env-core";

type SnowflakeConnection = snowflake.Connection;
type SnowflakeBind = snowflake.Bind;

declare global {
  var __passionSnowflakeConnection: Promise<SnowflakeConnection> | undefined;
}

snowflake.configure({ logLevel: "ERROR" });

async function readPrivateKey(): Promise<string> {
  const env = getSnowflakeEnv();

  if (env.SNOWFLAKE_PRIVATE_KEY_B64) {
    return Buffer.from(env.SNOWFLAKE_PRIVATE_KEY_B64, "base64").toString(
      "utf8",
    );
  }

  const keyPath = path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    env.SNOWFLAKE_PRIVATE_KEY_PATH ?? "",
  );
  return readFile(keyPath, "utf8");
}

async function createConnection(): Promise<SnowflakeConnection> {
  const env = getSnowflakeEnv();
  const privateKey = await readPrivateKey();
  const connection = snowflake.createConnection({
    account: env.SNOWFLAKE_ACCOUNT,
    username: env.SNOWFLAKE_USERNAME,
    authenticator: "SNOWFLAKE_JWT",
    privateKey,
    role: env.SNOWFLAKE_ROLE,
    warehouse: env.SNOWFLAKE_WAREHOUSE,
    database: env.SNOWFLAKE_DATABASE,
    schema: env.SNOWFLAKE_SCHEMA,
    application: "PASSION_BROADCAST",
  });

  await connection.connectAsync();
  return connection;
}

export async function getSnowflakeConnection(): Promise<SnowflakeConnection> {
  if (!globalThis.__passionSnowflakeConnection) {
    globalThis.__passionSnowflakeConnection = createConnection().catch(
      (error) => {
        globalThis.__passionSnowflakeConnection = undefined;
        throw error;
      },
    );
  }

  const connection = await globalThis.__passionSnowflakeConnection;
  if (!(await connection.isValidAsync())) {
    globalThis.__passionSnowflakeConnection = createConnection();
  }
  return globalThis.__passionSnowflakeConnection;
}

export async function snowflakeQuery<T extends Record<string, unknown>>(
  sqlText: string,
  binds: readonly SnowflakeBind[] = [],
): Promise<T[]> {
  const connection = await getSnowflakeConnection();

  return new Promise<T[]>((resolve, reject) => {
    connection.execute({
      sqlText,
      binds,
      complete(error, _statement, rows) {
        if (error) {
          reject(
            new Error(`Snowflake query failed: ${error.message}`, {
              cause: error,
            }),
          );
          return;
        }
        resolve((rows ?? []) as T[]);
      },
    });
  });
}

export async function snowflakeTransaction(
  work: () => Promise<void>,
): Promise<void> {
  await snowflakeQuery("BEGIN");
  try {
    await work();
    await snowflakeQuery("COMMIT");
  } catch (error) {
    await snowflakeQuery("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS CHALLENGE_ENTRIES (
    ARTICLE_ID NUMBER NOT NULL,
    TITLE STRING NOT NULL,
    DESCRIPTION STRING,
    BODY_MARKDOWN STRING,
    BODY_EXCERPT STRING,
    URL STRING NOT NULL,
    AUTHOR_NAME STRING,
    AUTHOR_USERNAME STRING,
    TAGS VARIANT,
    PUBLISHED_AT TIMESTAMP_TZ,
    POSITIVE_REACTIONS NUMBER,
    COMMENTS_COUNT NUMBER,
    READING_TIME_MINUTES NUMBER,
    COVER_IMAGE STRING,
    CONTENT_HASH STRING NOT NULL,
    SOURCE_FETCHED_AT TIMESTAMP_TZ,
    LAST_SEEN_AT TIMESTAMP_TZ,
    PRIMARY KEY (ARTICLE_ID)
  )`,
  `CREATE TABLE IF NOT EXISTS ENTRY_ANALYSIS (
    ARTICLE_ID NUMBER NOT NULL,
    CONTENT_HASH STRING NOT NULL,
    ARCHETYPE STRING NOT NULL,
    DOMAIN STRING NOT NULL,
    MOTIVATION STRING NOT NULL,
    EMOTIONAL_TONE STRING NOT NULL,
    TECHNOLOGIES VARIANT,
    SPONSOR_TECHNOLOGIES VARIANT,
    GROUNDED_SUMMARY STRING NOT NULL,
    CONFIDENCE FLOAT,
    MODEL_VERSION STRING,
    ANALYZED_AT TIMESTAMP_TZ,
    RAW_ANALYSIS VARIANT,
    PRIMARY KEY (ARTICLE_ID)
  )`,
  `CREATE TABLE IF NOT EXISTS INGESTION_RUNS (
    RUN_ID STRING NOT NULL,
    STARTED_AT TIMESTAMP_TZ,
    COMPLETED_AT TIMESTAMP_TZ,
    SOURCE_COUNT NUMBER,
    QUALIFYING_COUNT NUMBER,
    CHANGED_COUNT NUMBER,
    ANALYZED_COUNT NUMBER,
    STATUS STRING,
    ERROR_MESSAGE STRING,
    PRIMARY KEY (RUN_ID)
  )`,
  `CREATE TABLE IF NOT EXISTS METRIC_SNAPSHOTS (
    SNAPSHOT_ID STRING NOT NULL,
    CAPTURED_AT TIMESTAMP_TZ,
    ENTRY_COUNT NUMBER,
    BUILDER_COUNT NUMBER,
    REACTION_COUNT NUMBER,
    ARCHETYPE_COUNT NUMBER,
    DATA VARIANT,
    PRIMARY KEY (SNAPSHOT_ID)
  )`,
  `CREATE TABLE IF NOT EXISTS BROADCASTS (
    BROADCAST_ID STRING NOT NULL,
    GENERATED_AT TIMESTAMP_TZ,
    SNAPSHOT_ID STRING,
    SCRIPT STRING NOT NULL,
    AUDIO_BASE64 STRING,
    AUDIO_MIME STRING,
    DURATION_SECONDS NUMBER,
    GEMINI_MODEL STRING,
    ELEVENLABS_MODEL STRING,
    PRIMARY KEY (BROADCAST_ID)
  )`,
  `CREATE OR REPLACE VIEW V_ENRICHED_ENTRIES AS
    SELECT
      e.ARTICLE_ID,
      e.TITLE,
      e.DESCRIPTION,
      e.BODY_EXCERPT,
      e.URL,
      e.AUTHOR_NAME,
      e.AUTHOR_USERNAME,
      e.TAGS,
      e.PUBLISHED_AT,
      e.POSITIVE_REACTIONS,
      e.COMMENTS_COUNT,
      e.READING_TIME_MINUTES,
      e.COVER_IMAGE,
      e.CONTENT_HASH,
      e.SOURCE_FETCHED_AT,
      a.ARCHETYPE,
      a.DOMAIN,
      a.MOTIVATION,
      a.EMOTIONAL_TONE,
      a.TECHNOLOGIES,
      a.SPONSOR_TECHNOLOGIES,
      a.GROUNDED_SUMMARY,
      a.CONFIDENCE,
      a.MODEL_VERSION,
      a.ANALYZED_AT
    FROM CHALLENGE_ENTRIES e
    LEFT JOIN ENTRY_ANALYSIS a ON a.ARTICLE_ID = e.ARTICLE_ID`,
] as const;

export async function ensureSnowflakeSchema(): Promise<void> {
  for (const statement of SCHEMA_STATEMENTS) {
    await snowflakeQuery(statement);
  }
}
