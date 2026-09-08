import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260907030000_seed_case_lab_3_legal_versions.sql";
const schemaMigrationPath = "supabase/migrations/20260907000000_create_case_lab_3_payment_schema.sql";
const schemaTestPath = "supabase/tests/case_lab_3_schema.test.sql";
const atomicMigrationPath = "supabase/migrations/20260907010000_add_case_lab_3_atomic_functions.sql";
const privacyPagePath = "app/privacy/page.tsx";

async function readMigration(): Promise<string> {
  try {
    return await readFile(migrationPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

async function readSchemaMigration(): Promise<string> {
  return readFile(schemaMigrationPath, "utf8");
}

async function readSchemaTest(): Promise<string> {
  return readFile(schemaTestPath, "utf8");
}

async function readAtomicMigration(): Promise<string> {
  return readFile(atomicMigrationPath, "utf8");
}

async function readPrivacyPage(): Promise<string> {
  return readFile(privacyPagePath, "utf8");
}

function legalTextHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

const sensitiveSellerFieldPattern =
  /(?<![\p{L}\p{N}_])(?:иин|бин|iin|bin|инн|огрн|кпп|бик|iban|адрес|address|телефон|phone)\s*(?:продавца|seller)?\s*[:=]/iu;

function extractFunction(sql: string, functionName: string): string {
  const start = sql.indexOf(`create or replace function public.${functionName}(`);
  if (start < 0) return "";
  const next = sql.indexOf("\ncreate or replace function", start + 1);
  return sql.slice(start, next < 0 ? sql.length : next);
}

type LegalVersion = {
  environment: "test" | "live";
  id: string;
  documentKind: "offer" | "privacy";
  versionId: string;
  url: string;
  publicationLabel: string;
  contentSnapshot: string;
  contentHash: string;
  active: boolean;
  activationTimestamp: string;
};

function parseLegalVersions(sql: string): LegalVersion[] {
  const documents: Omit<LegalVersion, "environment" | "id" | "active" | "activationTimestamp">[] = [];
  const rowPattern = /\(\s*'(offer|privacy)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*\$\$([\s\S]*?)\$\$\s*,\s*'([0-9a-f]{64})'\s*\)/g;

  for (const match of sql.matchAll(rowPattern)) {
    documents.push({
      documentKind: match[1] as LegalVersion["documentKind"],
      versionId: match[2],
      url: match[3],
      publicationLabel: match[4],
      contentSnapshot: match[5],
      contentHash: match[6],
    });
  }

  const environmentIdsStart = sql.indexOf("legal_environment_ids");
  const insertStart = sql.search(/insert\s+into\s+public\.case_lab_3_legal_document_versions/i);
  const environmentRows = [...sql.slice(environmentIdsStart, insertStart).matchAll(/\(\s*'(test|live)'\s*,\s*'([0-9a-f-]{36})'::uuid\s*,\s*'([0-9a-f-]{36})'::uuid\s*\)/g)];
  const activationTimestamp = sql.match(/'([^']+)'::timestamptz\s*from\s+legal_environment_ids/)?.[1] ?? "";

  return environmentRows.flatMap((environmentRow) => {
    const [environment, offerId, privacyId] = environmentRow.slice(1) as [LegalVersion["environment"], string, string];
    return documents.map((document) => ({
      ...document,
      environment,
      id: document.documentKind === "offer" ? offerId : privacyId,
      active: true,
      activationTimestamp,
    }));
  });
}

test("migration seeds one active immutable offer and privacy snapshot per environment", async () => {
  const sql = await readMigration();
  const versions = parseLegalVersions(sql);

  assert.equal(versions.length, 4);
  assert.deepEqual(
    versions.map(({ environment, id, documentKind, versionId, url, active, activationTimestamp }) => ({
      environment,
      id,
      documentKind,
      versionId,
      url,
      active,
      activationTimestamp,
    })),
    [
      {
        environment: "test",
        id: "00000000-0000-4000-8000-000000000801",
        documentKind: "offer",
        versionId: "offer-2026-09-07",
        url: "https://caselab.kz/offer/",
        active: true,
        activationTimestamp: "2026-09-07 03:00:00 Asia/Almaty",
      },
      {
        environment: "test",
        id: "00000000-0000-4000-8000-000000000802",
        documentKind: "privacy",
        versionId: "privacy-2026-09-07",
        url: "https://caselab.kz/privacy/",
        active: true,
        activationTimestamp: "2026-09-07 03:00:00 Asia/Almaty",
      },
      {
        environment: "live",
        id: "00000000-0000-4000-8000-000000000803",
        documentKind: "offer",
        versionId: "offer-2026-09-07",
        url: "https://caselab.kz/offer/",
        active: true,
        activationTimestamp: "2026-09-07 03:00:00 Asia/Almaty",
      },
      {
        environment: "live",
        id: "00000000-0000-4000-8000-000000000804",
        documentKind: "privacy",
        versionId: "privacy-2026-09-07",
        url: "https://caselab.kz/privacy/",
        active: true,
        activationTimestamp: "2026-09-07 03:00:00 Asia/Almaty",
      },
    ],
  );

  for (const version of versions) {
    assert.ok(version.contentSnapshot.trim().length > 0);
    assert.equal(version.contentHash, legalTextHash(version.contentSnapshot));
    assert.match(version.publicationLabel, /2026|сентябр/i);
  }

  const offerSnapshot = versions.find(({ documentKind }) => documentKind === "offer")?.contentSnapshot ?? "";
  const privacySnapshot = versions.find(({ documentKind }) => documentKind === "privacy")?.contentSnapshot ?? "";
  for (const marker of [
    /TipTop\s+Pay/i,
    /Kassir/i,
    /Mail\.ru/i,
    /Supabase/i,
    /Vercel/i,
    /Google\s+Analytics\s+4|GA4/i,
    /срок[а-яё\s]*хран/i,
    /маркетинг[а-яё\s]*необязат/i,
    /данные\s+банковской\s+карты|card\s+details/i,
    /не\s+получает\s+и\s+не\s+хранит\s+реквизиты\s+карты|never\s+receives.*card/i,
  ]) {
    assert.ok(marker.test(privacySnapshot), "privacy snapshot is missing a required checkout disclosure");
  }
  assert.ok(offerSnapshot.includes("Реквизиты продавца: канонический идентификатор опущен по соображениям безопасности."));
  assert.equal(sensitiveSellerFieldPattern.test("ИИН: [REDACTED]"), true);
  assert.equal(sensitiveSellerFieldPattern.test("БИН: [REDACTED]"), true);
  assert.equal(sensitiveSellerFieldPattern.test(offerSnapshot), false, "offer snapshot contains a seller identifier field");

  assert.equal(new Set(versions.map(({ id }) => id)).size, 4);
  assert.match(sql, /is_active\s*,[\s\S]*?select[\s\S]*?true[\s\S]*?activated_at/i);
  assert.match(sql, /Реквизиты продавца: канонический идентификатор опущен по соображениям безопасности/i);
  assert.doesNotMatch(sql, /\b(?:ИИН|БИН|IIN|BIN)\b\s*:/i);
});

test("migration maps both settings rows to their inserted legal UUIDs before activation", async () => {
  const sql = await readMigration();
  const insertIndex = sql.search(/insert\s+into\s+public\.case_lab_3_legal_document_versions/i);
  const settingsMappingIndex = sql.search(/update\s+public\.case_lab_3_event_settings/i);
  const activationIndex = sql.search(/do\s+\$activation\$/i);

  assert.ok(insertIndex >= 0);
  assert.ok(settingsMappingIndex > insertIndex, "settings must be mapped after legal rows are inserted");
  assert.ok(settingsMappingIndex < activationIndex, "settings must be mapped before the activation gate");

  const settingsMapping = sql.slice(settingsMappingIndex, activationIndex);
  assert.match(settingsMapping, /set\s+active_offer_version_id\s*=\s*environment\.offer_id/i);
  assert.match(settingsMapping, /active_privacy_version_id\s*=\s*environment\.privacy_id/i);
  assert.match(settingsMapping, /from\s*\(\s*values/i);

  for (const [environment, offerId, privacyId] of [
    ["test", "00000000-0000-4000-8000-000000000801", "00000000-0000-4000-8000-000000000802"],
    ["live", "00000000-0000-4000-8000-000000000803", "00000000-0000-4000-8000-000000000804"],
  ]) {
    assert.match(
      settingsMapping,
      new RegExp(`'${environment}'\\s*,\\s*'${offerId}'::uuid\\s*,\\s*'${privacyId}'::uuid`, "i"),
    );
  }
});

test("legal snapshots contain complete canonical safe text instead of condensed summaries", async () => {
  const sql = await readMigration();
  const versions = parseLegalVersions(sql);
  const requiredSections: Record<LegalVersion["documentKind"], string[]> = {
    offer: [
      "ПУБЛИЧНАЯ ОФЕРТА",
      "1. Общие положения",
      "2. Предмет и порядок оплаты",
      "3. Порядок заключения договора",
      "4. Цена и порядок расчетов",
      "5. Права и обязанности сторон",
      "6. Возврат денежных средств",
      "7. Ответственность сторон",
      "8. Реквизиты продавца",
      "9. Персональные данные",
      "10. Заключительные положения",
    ],
    privacy: [
      "ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ",
      "1. Общие положения",
      "2. Какие данные обрабатываются",
      "3. Технические данные",
      "4. Данные о заказах и платежах",
      "5. Цели обработки персональных данных",
      "6. Основания для обработки персональных данных",
      "7. Согласие на маркетинговые сообщения",
      "8. Действия с персональными данными",
      "9. Передача данных третьим лицам",
      "10. Трансграничная передача персональных данных",
      "11. Хранение персональных данных",
      "12. Cookies",
      "13. Защита персональных данных",
      "14. Права пользователя",
      "15. Персональные данные третьих лиц",
      "16. Сторонние сайты и сервисы",
      "17. Изменение Политики",
      "18. Контактная информация",
    ],
  };

  for (const documentKind of ["offer", "privacy"] as const) {
    const snapshot = versions.find((version) => version.documentKind === documentKind)?.contentSnapshot ?? "";
    for (const section of requiredSections[documentKind]) {
      assert.ok(snapshot.includes(section), `${documentKind} snapshot is missing ${section}`);
    }
    assert.ok(snapshot.split(/\n\s*\n/).length >= requiredSections[documentKind].length, `${documentKind} snapshot is condensed`);
    assert.equal(sensitiveSellerFieldPattern.test(snapshot), false, `${documentKind} snapshot contains a seller identifier field`);
  }
});

test("the public privacy page follows the non-identifying contact contract of its accepted snapshot", async () => {
  const sql = await readMigration();
  const page = await readPrivacyPage();
  const privacySnapshot = parseLegalVersions(sql).find(({ documentKind }) => documentKind === "privacy")?.contentSnapshot ?? "";

  assert.match(privacySnapshot, /реальные идентификаторы продавца, адреса и контакты не дублируются/i);
  assert.match(page, /официальн[а-яё\s-]*канал[а-яё\s-]*Case Lab/i);
  assert.doesNotMatch(page, sensitiveSellerFieldPattern);
  assert.doesNotMatch(page, /860927350183|Таугуль|Мамыр|702\s*111\s*4747/iu);
});

test("stable legal version IDs resolve order references separately from UUID row IDs", async () => {
  const sql = await readMigration();
  const atomicSql = await readAtomicMigration();
  const createOrderSql = extractFunction(atomicSql, "case_lab_3_create_order");
  const versions = parseLegalVersions(sql);

  assert.deepEqual([...new Set(versions.map(({ versionId }) => versionId))], [
    "offer-2026-09-07",
    "privacy-2026-09-07",
  ]);
  assert.ok(versions.every(({ id }) => /^[0-9a-f-]{36}$/i.test(id)));
  assert.ok(versions.every(({ versionId }) => !/^[0-9a-f-]{36}$/i.test(versionId)));
  assert.ok(
    /document\.version_id\s*=\s*p_input->>'offerVersionId'/i.test(createOrderSql),
    "order creation must resolve the offer by stable version_id",
  );
  assert.ok(
    /document\.version_id\s*=\s*p_input->>'privacyVersionId'/i.test(createOrderSql),
    "order creation must resolve privacy by stable version_id",
  );
});

test("migration activates only test sales after complete fiscal and legal gates", async () => {
  const sql = await readMigration();

  assert.match(sql, /environment\s*=\s*'test'/i);
  assert.match(sql, /sales_enabled\s*=\s*true/i);
  assert.match(sql, /automated-test/i);
  assert.match(sql, /case_lab_3_fiscal_policy_versions/i);
  assert.match(sql, /document_kind\s*=\s*'offer'/i);
  assert.match(sql, /document_kind\s*=\s*'privacy'/i);
  assert.match(sql, /is_active/i);
  assert.match(sql, /activated_at/i);
  assert.equal((sql.match(/sales_enabled\s*=\s*true/gi) ?? []).length, 1);
  assert.match(sql, /set\s+sales_enabled\s*=\s*true\s+where\s+environment\s*=\s*'test'/i);
  assert.doesNotMatch(sql, /environment\s*=\s*'live'[\s\S]{0,160}sales_enabled\s*=\s*true/i);
  assert.doesNotMatch(sql, /update\s+public\.case_lab_3_legal_document_versions/i);
});

test("migration relies on insert-only legal revisions and dollar-quoted canonical text", async () => {
  const sql = await readMigration();
  const schemaSql = await readSchemaMigration();
  const schemaTestSql = await readSchemaTest();

  assert.match(sql, /insert\s+into\s+public\.case_lab_3_legal_document_versions/i);
  assert.match(sql, /\$\$[\s\S]+\$\$/);
  assert.match(schemaSql, /create trigger case_lab_3_immutable_legal_document_versions/i);
  assert.match(schemaSql, /before update or delete on public\.case_lab_3_legal_document_versions/i);
  assert.match(schemaTestSql, /throws_ok\([\s\S]*?update public\.case_lab_3_legal_document_versions/i);
  assert.match(schemaTestSql, /throws_ok\([\s\S]*?delete from public\.case_lab_3_legal_document_versions/i);
  assert.match(sql, /content_snapshot/i);
  assert.match(sql, /content_hash/i);
});

test("schema pgTAP reflects the Task 6A test-only activation state", async () => {
  const schemaSql = await readSchemaTest();

  assert.doesNotMatch(schemaSql, /count\(\*::bigint\s+from public\.case_lab_3_event_settings where sales_enabled\)[\s\S]{0,80}0::bigint/i);
  assert.match(schemaSql, /select environment\s*,\s*sales_enabled[\s\S]*?\('live'\s*,\s*false\)[\s\S]*?\('test'\s*,\s*true\)/i);
  assert.match(schemaSql, /test sales activation succeeds with complete fiscal and legal configuration/i);
  assert.match(schemaSql, /sales activation rejects a hash-valid unsupported fiscal policy/i);
});
