import type BetterSqlite3 from 'better-sqlite3';

interface Migration {
  version: number;
  name: string;
  up: string;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: `
      CREATE TABLE IF NOT EXISTS tenants (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        name         TEXT NOT NULL,
        role         TEXT NOT NULL DEFAULT 'employee',
        credit_score INTEGER NOT NULL DEFAULT 500,
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS accounts (
        tenant_id       INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
        liquid_balance  REAL NOT NULL DEFAULT 0,
        savings_balance REAL NOT NULL DEFAULT 0,
        updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id   INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        title       TEXT NOT NULL,
        description TEXT,
        kind        TEXT NOT NULL DEFAULT 'habit',
        base_credit REAL NOT NULL DEFAULT 1,
        active      INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS checkins (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id          INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        task_id            INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        proof              TEXT,
        credit_awarded     REAL NOT NULL DEFAULT 0,
        multiplier_applied REAL NOT NULL DEFAULT 1,
        status             TEXT NOT NULL DEFAULT 'approved',
        note               TEXT,
        created_at         TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS proposals (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id        INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        title            TEXT NOT NULL,
        description      TEXT,
        budget_requested REAL NOT NULL DEFAULT 0,
        expected_return  REAL NOT NULL DEFAULT 0,
        status           TEXT NOT NULL DEFAULT 'pending',
        reviewed_by      INTEGER REFERENCES tenants(id),
        review_note      TEXT,
        created_at       TEXT NOT NULL DEFAULT (datetime('now')),
        reviewed_at      TEXT
      );

      CREATE TABLE IF NOT EXISTS assets (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        name             TEXT NOT NULL,
        description      TEXT,
        price            REAL NOT NULL,
        income_multiplier REAL NOT NULL DEFAULT 1,
        owner_tenant_id  INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
        for_sale         INTEGER NOT NULL DEFAULT 1,
        created_at       TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        type          TEXT NOT NULL,
        amount        REAL NOT NULL,
        balance_after REAL,
        ref_table     TEXT,
        ref_id        INTEGER,
        note          TEXT,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS loans (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        principal   REAL NOT NULL,
        annual_rate REAL NOT NULL,
        outstanding REAL NOT NULL,
        status      TEXT NOT NULL DEFAULT 'active',
        due_date    TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS loan_repayments (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        loan_id    INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
        tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        amount     REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS savings_accruals (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        period     TEXT NOT NULL,
        principal  REAL NOT NULL,
        rate       REAL NOT NULL,
        interest   REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(tenant_id, period)
      );

      CREATE INDEX IF NOT EXISTS idx_checkins_tenant   ON checkins(tenant_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_checkins_task      ON checkins(task_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_tid   ON transactions(tenant_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_proposals_tenant   ON proposals(tenant_id, status);
      CREATE INDEX IF NOT EXISTS idx_loans_tenant       ON loans(tenant_id, status);
      CREATE INDEX IF NOT EXISTS idx_assets_owner       ON assets(owner_tenant_id);
      CREATE INDEX IF NOT EXISTS idx_assets_for_sale    ON assets(for_sale);
    `,
  },
  {
    version: 2,
    name: 'seed_base_assets',
    up: `
      INSERT INTO assets (name, description, price, income_multiplier, owner_tenant_id, for_sale)
      SELECT '计算器', '基础工具，产出效率 +10%', 50, 1.10, NULL, 1
      WHERE NOT EXISTS (SELECT 1 FROM assets);

      INSERT INTO assets (name, description, price, income_multiplier, owner_tenant_id, for_sale)
      SELECT '自行车', '通勤工具，产出效率 +25%', 150, 1.25, NULL, 1
      WHERE (SELECT COUNT(*) FROM assets) < 2;

      INSERT INTO assets (name, description, price, income_multiplier, owner_tenant_id, for_sale)
      SELECT '笔记本电脑', '生产力核心资产，产出效率 +50%', 400, 1.50, NULL, 1
      WHERE (SELECT COUNT(*) FROM assets) < 3;
    `,
  },
  {
    version: 3,
    name: 'gamification_and_finance',
    up: `
      ALTER TABLE checkins ADD COLUMN checked_on TEXT;
      ALTER TABLE checkins ADD COLUMN streak INTEGER NOT NULL DEFAULT 1;

      ALTER TABLE proposals ADD COLUMN actual_return REAL;
      ALTER TABLE proposals ADD COLUMN settled_at TEXT;

      ALTER TABLE loans ADD COLUMN periods_accrued INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE loans ADD COLUMN last_accrual_at TEXT;

      CREATE TABLE IF NOT EXISTS loan_accruals (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        loan_id     INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
        tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        period      TEXT NOT NULL,
        principal   REAL NOT NULL,
        rate        REAL NOT NULL,
        interest    REAL NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(loan_id, period)
      );

      CREATE TABLE IF NOT EXISTS badges (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        code        TEXT NOT NULL UNIQUE,
        name        TEXT NOT NULL,
        description TEXT,
        emoji       TEXT NOT NULL DEFAULT '🏅',
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tenant_badges (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        badge_id   INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
        awarded_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(tenant_id, badge_id)
      );

      CREATE INDEX IF NOT EXISTS idx_tenant_badges_tenant ON tenant_badges(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_loan_accruals_loan   ON loan_accruals(loan_id);
    `,
  },
  {
    version: 4,
    name: 'seed_badges',
    up: `
      INSERT OR IGNORE INTO badges (code, name, description, emoji) VALUES
        ('first_checkin',     '初次打卡',   '完成第一次打卡',         '🌱'),
        ('streak_3',          '三日连击',   '连续打卡 3 天',          '🔥'),
        ('streak_7',          '一周连击',   '连续打卡 7 天',          '⚡'),
        ('streak_30',         '月度坚持',   '连续打卡 30 天',         '🏆'),
        ('first_asset',       '装备上手',   '拥有第一件工具资产',     '🧰'),
        ('multiplier_2',      '效率翻倍',   '总收益乘数达到 2x',      '🚀'),
        ('saver_100',         '储蓄达人',   '储蓄账户达到 100',       '🐖'),
        ('first_loan',        '首次借贷',   '申请第一笔贷款',         '💳'),
        ('debt_free',         '无债一身轻', '还清一笔贷款',           '🎉'),
        ('proposal_approved', '提案获批',   '有提案通过审核',         '📈'),
        ('boss',              '晋升 CEO',   '成为团队 CEO',           '👑');
    `,
  },
  {
    version: 5,
    name: 'parent_admin_and_revocation',
    up: `
      -- Permission axis: role = PARENT | CHILD
      ALTER TABLE tenants ADD COLUMN game_role TEXT NOT NULL DEFAULT 'employee';
      ALTER TABLE tenants ADD COLUMN pin_code TEXT;

      -- Preserve the previous progression roles, then repurpose role as the permission axis.
      UPDATE tenants SET game_role = role;
      UPDATE tenants SET role = CASE WHEN role = 'ceo' THEN 'PARENT' ELSE 'CHILD' END;

      -- Existing parents need a PIN so they can authenticate.
      UPDATE tenants SET pin_code = '1234' WHERE role = 'PARENT' AND pin_code IS NULL;

      -- Revocation fields on check-in logs.
      ALTER TABLE checkins ADD COLUMN is_revoked INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE checkins ADD COLUMN revoked_at TEXT;
      ALTER TABLE checkins ADD COLUMN revoked_by INTEGER REFERENCES tenants(id);

      CREATE INDEX IF NOT EXISTS idx_checkins_revoked ON checkins(tenant_id, is_revoked);
    `,
  },
  {
    version: 6,
    name: 'parent_default_pin_0000',
    up: `
      -- Migrate the old default PIN to the new one (user-customised pins are preserved
      -- unless they still equal the previous default).
      UPDATE tenants SET pin_code = '0000'
       WHERE role = 'PARENT' AND (pin_code IS NULL OR pin_code = '1234');
    `,
  },
];

export function migrate(db: BetterSqlite3.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const current = db
    .prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations')
    .get() as { version: number };

  for (const migration of migrations) {
    if (migration.version <= current.version) continue;
    const apply = db.transaction(() => {
      db.exec(migration.up);
      db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(
        migration.version,
        migration.name,
      );
    });
    apply();
  }
}
