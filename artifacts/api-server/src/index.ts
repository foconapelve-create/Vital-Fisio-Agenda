import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/scheduler";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function runMigrations() {
  try {
    // Add contact_preference column to patients if not exists
    await pool.query(`
      ALTER TABLE patients ADD COLUMN IF NOT EXISTS contact_preference TEXT DEFAULT 'whatsapp'
    `);

    // Ensure clinic_settings table exists with all needed columns
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clinic_settings (
        id SERIAL PRIMARY KEY,
        system_name TEXT NOT NULL DEFAULT 'Vitalfisio',
        logo_url TEXT,
        nome_clinica TEXT,
        endereco_clinica TEXT,
        telefone TEXT,
        email TEXT,
        holiday_mode TEXT NOT NULL DEFAULT 'block',
        allow_saturday BOOLEAN NOT NULL DEFAULT true,
        block_sunday BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Add missing columns to clinic_settings if upgrading
    const clinicCols = [
      "ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS holiday_mode TEXT NOT NULL DEFAULT 'block'",
      "ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS allow_saturday BOOLEAN NOT NULL DEFAULT true",
      "ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS block_sunday BOOLEAN NOT NULL DEFAULT true",
      "ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS nome_clinica TEXT",
      "ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS endereco_clinica TEXT",
      "ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS telefone TEXT",
      "ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS email TEXT",
    ];
    for (const q of clinicCols) {
      await pool.query(q).catch(() => {});
    }

    // Ensure password_reset_tokens table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Ensure birthday_settings table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS birthday_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        message_template TEXT,
        email_subject TEXT,
        email_template_day TEXT,
        email_template_month TEXT,
        whatsapp_template_month TEXT,
        discount_default_percent REAL DEFAULT 10,
        discount_default_value REAL,
        discount_default_type TEXT DEFAULT 'percent',
        discount_default_expiry_days INTEGER DEFAULT 30,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Ensure birthday_actions table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS birthday_actions (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        action_type TEXT NOT NULL,
        message_sent TEXT,
        discount_value REAL,
        discount_type TEXT,
        discount_expiry TEXT,
        discount_notes TEXT,
        performed_by TEXT,
        action_date TEXT NOT NULL,
        action_time TEXT,
        channel TEXT NOT NULL DEFAULT 'whatsapp',
        message_type TEXT DEFAULT 'dia',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Ensure whatsapp_settings table exists with default row
    await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        instance_id TEXT,
        token TEXT,
        clinic_name TEXT DEFAULT 'VitalFisio',
        message_template_1 TEXT,
        message_template_2 TEXT,
        message_encaixe TEXT,
        auto_send_enabled BOOLEAN NOT NULL DEFAULT false,
        auto_send_time TEXT DEFAULT '08:00',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      INSERT INTO whatsapp_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING
    `);

    // Ensure especializada_appointments table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS especializada_appointments (
        id SERIAL PRIMARY KEY,
        agenda_type TEXT NOT NULL,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        therapist_id INTEGER NOT NULL REFERENCES therapists(id),
        patient_name TEXT NOT NULL,
        patient_phone TEXT,
        therapist_name TEXT NOT NULL,
        therapist_specialty TEXT,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'agendado',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    logger.info("Migrations completed successfully");
  } catch (e: any) {
    logger.error({ err: e.message }, "Migration error (non-fatal)");
  }
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  await runMigrations();
  startScheduler();
});
