import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationFiles = [
  "0000_gorgeous_echo.sql",
  "0001_furry_justice.sql",
  "0002_mute_lifeguard.sql",
  "0003_awesome_colossus.sql",
  "0004_ops_foundation.sql",
  "0005_tighten_ops_integrity.sql",
  "0006_ops_integrity_guards.sql",
  "0007_mysterious_silver_samurai.sql",
  "0008_uneven_thanos.sql",
];

async function freshDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  for (const file of migrationFiles) {
    const sql = await readFile(new URL(`../drizzle/${file}`, import.meta.url), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) database.exec(statement);
    }
  }
  return database;
}

test("the complete migration chain creates the canonical Ops domain", async () => {
  const database = await freshDatabase();
  const tables = database
    .prepare("select name from sqlite_schema where type = 'table'")
    .all()
    .map((row) => row.name);

  for (const table of [
    "accounts",
    "contacts",
    "account_contacts",
    "engagements",
    "onboarding_tasks",
    "workspaces",
    "automation_blueprints",
    "automation_installations",
    "decision_requests",
    "operator_audit_events",
    "account_services",
    "service_installations",
  ]) {
    assert.ok(tables.includes(table), `${table} should exist`);
  }
  assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
});

test("database checks reject invented runtime state", async () => {
  const database = await freshDatabase();
  database
    .prepare("insert into accounts (id, name) values (?, ?)")
    .run("acct_one", "One");
  database
    .prepare(
      "insert into automation_blueprints (id, account_id, key, name, trigger_summary, action_summary) values (?, ?, ?, ?, ?, ?)",
    )
    .run("blueprint_one", "acct_one", "one", "One", "When", "Then");

  assert.throws(
    () =>
      database
        .prepare(
          "insert into automation_installations (id, account_id, blueprint_id, observed_state) values (?, ?, ?, ?)",
        )
        .run("install_one", "acct_one", "blueprint_one", "probably_running"),
    /CHECK constraint failed/,
  );
});

test("service assignments enforce account boundaries and preserve unknown prices", async () => {
  const database = await freshDatabase();
  database.exec(`
    INSERT INTO accounts (id, name) VALUES ('a','A'),('b','B');
    INSERT INTO automation_blueprints (id,account_id,key,name,trigger_summary,action_summary) VALUES ('bp','a','bp','Example','When','Then');
    INSERT INTO automation_installations (id,account_id,blueprint_id) VALUES ('i','a','bp');
    INSERT INTO account_services (id,account_id,name) VALUES ('s','a','Service'),('other','b','Other');
    INSERT INTO service_installations (service_id,installation_id) VALUES ('s','i');
  `);
  assert.equal(database.prepare("SELECT monthly_fee_cents FROM account_services WHERE id='s'").get().monthly_fee_cents, null);
  assert.throws(() => database.exec("INSERT INTO service_installations VALUES ('other','i')"), /same account/);
  assert.throws(() => database.exec("UPDATE account_services SET account_id='b' WHERE id='s'"), /cannot transfer/);
  assert.throws(() => database.exec("UPDATE account_services SET monthly_fee_cents=-1 WHERE id='s'"), /CHECK/);
  database.close();
});

test("one account cannot silently acquire two primary contacts", async () => {
  const database = await freshDatabase();
  database.exec(`
    insert into accounts (id, name) values ('acct_one', 'One');
    insert into contacts (id, display_name, email, email_normalized)
      values ('contact_one', 'One', 'one@example.com', 'one@example.com');
    insert into contacts (id, display_name, email, email_normalized)
      values ('contact_two', 'Two', 'two@example.com', 'two@example.com');
    insert into account_contacts (account_id, contact_id, is_primary)
      values ('acct_one', 'contact_one', 1);
  `);

  assert.throws(
    () =>
      database
        .prepare(
          "insert into account_contacts (account_id, contact_id, is_primary) values (?, ?, 1)",
        )
        .run("acct_one", "contact_two"),
    /UNIQUE constraint failed/,
  );
});

test("one account has one workspace and harness IDs are account scoped before provisioning", async () => {
  const database = await freshDatabase();
  database.exec(`
    insert into accounts (id, name) values ('acct_one', 'One');
    insert into accounts (id, name) values ('acct_two', 'Two');
    insert into workspaces (id, account_id, slug, display_name, lifecycle)
      values ('workspace_one', 'acct_one', 'one', 'One', 'active');
    insert into workspaces (id, account_id, slug, display_name, lifecycle)
      values ('workspace_two', 'acct_two', 'two', 'Two', 'active');
    insert into automation_blueprints
      (id, account_id, key, name, trigger_summary, action_summary)
      values ('blueprint_one', 'acct_one', 'one', 'One', 'When', 'Then');
    insert into automation_blueprints
      (id, account_id, key, name, trigger_summary, action_summary)
      values ('blueprint_two', 'acct_two', 'two', 'Two', 'When', 'Then');
    insert into automation_blueprints
      (id, account_id, key, name, trigger_summary, action_summary)
      values ('blueprint_three', 'acct_one', 'three', 'Three', 'When', 'Then');
    insert into automation_installations
      (id, account_id, blueprint_id, runner_key, external_workflow_id)
      values ('install_one', 'acct_one', 'blueprint_one', 'n8n', 'workflow-7');
    insert into automation_installations
      (id, account_id, blueprint_id, runner_key, external_workflow_id)
      values ('install_two', 'acct_two', 'blueprint_two', 'n8n', 'workflow-7');
  `);

  assert.throws(
    () =>
      database
        .prepare(
          "insert into workspaces (id, account_id, slug, display_name) values (?, ?, ?, ?)",
        )
        .run("workspace_duplicate", "acct_one", "one-again", "One again"),
    /UNIQUE constraint failed/,
  );
  assert.throws(
    () =>
      database
        .prepare(
          "insert into automation_installations (id, account_id, blueprint_id, runner_key, external_workflow_id) values (?, ?, ?, ?, ?)",
        )
        .run("install_duplicate", "acct_one", "blueprint_three", "n8n", "workflow-7"),
    /UNIQUE constraint failed/,
  );
});

test("database guards reject cross-account operational links", async () => {
  const database = await freshDatabase();
  database.exec(`
    insert into accounts (id, name) values ('acct_one', 'One');
    insert into accounts (id, name) values ('acct_two', 'Two');
    insert into workspaces (id, account_id, slug, display_name)
      values ('workspace_two', 'acct_two', 'two', 'Two');
    insert into automation_blueprints
      (id, account_id, key, name, trigger_summary, action_summary)
      values ('blueprint_one', 'acct_one', 'one', 'One', 'When', 'Then');
    insert into automation_blueprints
      (id, account_id, key, name, trigger_summary, action_summary)
      values ('blueprint_two', 'acct_two', 'two', 'Two', 'When', 'Then');
  `);

  assert.throws(
    () => database.prepare(`
      insert into automation_installations
        (id, account_id, workspace_id, blueprint_id)
      values (?, ?, ?, ?)
    `).run("bad_workspace", "acct_one", "workspace_two", "blueprint_one"),
    /workspace must belong/i,
  );
  assert.throws(
    () => database.prepare(`
      insert into automation_installations
        (id, account_id, blueprint_id)
      values (?, ?, ?)
    `).run("bad_blueprint", "acct_one", "blueprint_two"),
    /blueprint must belong/i,
  );

  database.prepare(`
    insert into automation_installations
      (id, account_id, workspace_id, blueprint_id)
    values (?, ?, ?, ?)
  `).run("install_two", "acct_two", "workspace_two", "blueprint_two");
  assert.throws(
    () => database.prepare(`
      insert into decision_requests
        (id, account_id, installation_id, type, request_key, title)
      values (?, ?, ?, ?, ?, ?)
    `).run("decision_bad", "acct_one", "install_two", "Automation activation", "request-bad", "Activate"),
    /decision installation must belong/i,
  );

  database.prepare(`
    insert into decision_requests
      (id, account_id, installation_id, type, request_key, title)
    values (?, ?, ?, ?, ?, ?)
  `).run("decision_two", "acct_two", "install_two", "Automation activation", "request-two", "Activate");
  assert.throws(
    () => database.prepare("update workspaces set account_id = ? where id = ?")
      .run("acct_one", "workspace_two"),
    /workspace account cannot invalidate/i,
  );
  assert.throws(
    () => database.prepare("update automation_blueprints set account_id = null where id = ?")
      .run("blueprint_two"),
    /blueprint ownership cannot invalidate/i,
  );
});

test("decision keys and pending installation requests are unique", async () => {
  const database = await freshDatabase();
  database.exec(`
    insert into accounts (id, name) values ('acct_one', 'One');
    insert into automation_blueprints
      (id, account_id, key, name, trigger_summary, action_summary)
      values ('blueprint_one', 'acct_one', 'one', 'One', 'When', 'Then');
    insert into automation_installations (id, account_id, blueprint_id)
      values ('install_one', 'acct_one', 'blueprint_one');
    insert into decision_requests
      (id, account_id, installation_id, type, request_key, title)
      values ('decision_one', 'acct_one', 'install_one', 'Automation activation', 'request-one', 'Activate');
  `);

  assert.throws(
    () => database.prepare(`
      insert into decision_requests
        (id, account_id, installation_id, type, request_key, title)
      values (?, ?, ?, ?, ?, ?)
    `).run("decision_retry", "acct_one", "install_one", "Delivery exception", "request-one", "Retry"),
    /UNIQUE constraint failed/,
  );
  assert.throws(
    () => database.prepare(`
      insert into decision_requests
        (id, account_id, installation_id, type, request_key, title)
      values (?, ?, ?, ?, ?, ?)
    `).run("decision_duplicate", "acct_one", "install_one", "Automation activation", "request-two", "Activate again"),
    /UNIQUE constraint failed/,
  );
});

test("boolean guards reject non-boolean storage values", async () => {
  const database = await freshDatabase();
  database.exec(`
    insert into accounts (id, name) values ('acct_one', 'One');
    insert into contacts (id, display_name, email, email_normalized)
      values ('contact_one', 'One', 'one@example.com', 'one@example.com');
  `);

  assert.throws(
    () => database.prepare(`
      insert into account_contacts (account_id, contact_id, is_primary)
      values (?, ?, ?)
    `).run("acct_one", "contact_one", 2),
    /is_primary must be boolean/i,
  );
});

test("the Ops migrations optimize generated indexes", async () => {
  for (const file of [
    "0004_ops_foundation.sql",
    "0005_tighten_ops_integrity.sql",
    "0006_ops_integrity_guards.sql",
  ]) {
    const sql = await readFile(new URL(`../drizzle/${file}`, import.meta.url), "utf8");
    assert.match(sql, /PRAGMA optimize/i);
  }
});
