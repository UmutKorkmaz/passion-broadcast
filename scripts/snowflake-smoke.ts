import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { ensureSnowflakeSchema, snowflakeQuery } = await import(
    "../src/lib/snowflake-core"
  );

  await ensureSnowflakeSchema();
  const rows = await snowflakeQuery<{
    ACCOUNT_NAME: string;
    REGION: string;
    CURRENT_ROLE: string;
    CURRENT_USER: string;
  }>(`SELECT
    CURRENT_ACCOUNT_NAME() AS ACCOUNT_NAME,
    CURRENT_REGION() AS REGION,
    CURRENT_ROLE() AS CURRENT_ROLE,
    CURRENT_USER() AS CURRENT_USER`);

  const row = rows[0];
  if (!row || row.CURRENT_USER !== "PASSION_APP_USER") {
    throw new Error("Snowflake smoke test used an unexpected identity");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        account: row.ACCOUNT_NAME,
        region: row.REGION,
        role: row.CURRENT_ROLE,
        user: row.CURRENT_USER,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
