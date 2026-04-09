import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const attestationsTable = pgTable("attestations", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  tipoDocumento: text("tipo_documento").notNull().default("declaracao"), // 'declaracao' | 'atestado'
  dataAtendimento: text("data_atendimento").notNull(),
  horaInicio: text("hora_inicio").notNull(),
  horaTermino: text("hora_termino").notNull(),
  tipoAtendimento: text("tipo_atendimento").notNull(),
  outroTipoAtendimento: text("outro_tipo_atendimento"),
  observacoes: text("observacoes"),
  profissionalResponsavel: text("profissional_responsavel").notNull(),
  registroProfissional: text("registro_profissional"),
  dataEmissao: text("data_emissao").notNull(),
  cidade: text("cidade"),
  enderecoClinica: text("endereco_clinica"),
  textoGerado: text("texto_gerado"),
  criadoPor: text("criado_por"),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const clinicSettingsTable = pgTable("clinic_settings", {
  id: serial("id").primaryKey(),
  nomeClinica: text("nome_clinica").notNull().default("VitalFisio"),
  enderecoClinica: text("endereco_clinica").notNull().default(""),
  telefone: text("telefone"),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Attestation = typeof attestationsTable.$inferSelect;
export type ClinicSettings = typeof clinicSettingsTable.$inferSelect;
