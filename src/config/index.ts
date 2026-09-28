import dotenv from 'dotenv';

dotenv.config();

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: num(process.env.PORT, 3000),
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '3650d',
  },
  dbPath: process.env.DB_PATH ?? './data/credit_incentive.db',
  savings: {
    // annual nominal rate, compounded `periodsPerYear` times
    annualRate: num(process.env.SAVINGS_ANNUAL_RATE, 0.12),
    periodsPerYear: num(process.env.SAVINGS_PERIODS_PER_YEAR, 52),
  },
  loan: {
    annualRate: num(process.env.LOAN_ANNUAL_RATE, 0.18),
    // interest compounds `periodsPerYear` times on outstanding balance
    periodsPerYear: num(process.env.LOAN_PERIODS_PER_YEAR, 52),
    // max principal = credit_score * creditPerScore
    creditPerScore: num(process.env.LOAN_CREDIT_PER_SCORE, 0.5),
    creditScoreMin: num(process.env.CREDIT_SCORE_MIN, 0),
    creditScoreMax: num(process.env.CREDIT_SCORE_MAX, 1000),
    // credit score penalty when a loan passes its due date
    defaultPenalty: num(process.env.LOAN_DEFAULT_PENALTY, 50),
  },
  asset: {
    // total income multiplier cap (prevents runaway stacking)
    multiplierCap: 3,
  },
  badge: {
    // liquid credit granted when a badge is newly unlocked
    reward: num(process.env.BADGE_REWARD, 10),
  },
  parent: {
    // default PIN assigned to new / migrated PARENT accounts (changeable)
    defaultPin: process.env.PARENT_DEFAULT_PIN ?? '0000',
  },
  role: {
    // employee -> contractor requirements
    contractor: {
      minApprovedProposals: num(process.env.CONTRACTOR_MIN_PROPOSALS, 1),
      minOwnedAssets: num(process.env.CONTRACTOR_MIN_ASSETS, 1),
    },
    // contractor -> ceo requirements
    ceo: {
      minRepaidLoans: num(process.env.CEO_MIN_REPAID_LOANS, 1),
      minSavings: num(process.env.CEO_MIN_SAVINGS, 100),
      minCreditScore: num(process.env.CEO_MIN_CREDIT_SCORE, 700),
    },
  },
  scheduler: {
    enabled: (process.env.SCHEDULER_ENABLED ?? 'false') === 'true',
    // how often to check for a due weekly cycle (ms)
    intervalMs: num(process.env.SCHEDULER_INTERVAL_MS, 60 * 60 * 1000),
  },
} as const;
