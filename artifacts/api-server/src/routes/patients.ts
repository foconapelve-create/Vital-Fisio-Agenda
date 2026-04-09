import { Router, type IRouter } from "express";
import { eq, ilike, sql } from "drizzle-orm";
import { db, pool, patientsTable, appointmentsTable, therapistsTable, financialTable } from "@workspace/db";

const router: IRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any)?.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

router.get("/patients", requireAuth, async (req, res): Promise<void> => {
  const userId = (req.session as any).userId as number;
  const search = req.query.search as string | undefined;

  // Check if user is profissional — filter to only their patients
  const { rows: userRows } = await pool.query("SELECT role, name FROM users WHERE id = $1", [userId]);
  const user = userRows[0];
  const isProfissional = user && (user.role === "profissional" || user.role === "fisioterapeuta");

  if (isProfissional && user.name) {
    // Find therapist records matching this user by name (first name match)
    const firstName = user.name.split(" ")[0].toLowerCase();
    const { rows: therapistRows } = await pool.query(
      "SELECT id FROM therapists WHERE LOWER(name) LIKE $1",
      [`%${firstName}%`]
    );
    if (therapistRows.length > 0) {
      const therapistIds = therapistRows.map((t: any) => t.id);
      const placeholders = therapistIds.map((_: any, i: number) => `$${i + 1}`).join(", ");
      const searchFilter = search ? `AND LOWER(p.name) LIKE '%${search.replace(/'/g, "''")}%'` : "";
      const { rows: patients } = await pool.query(
        `SELECT DISTINCT p.* FROM patients p
         INNER JOIN appointments a ON a.patient_id = p.id
         WHERE a.therapist_id IN (${placeholders}) ${searchFilter}
         ORDER BY p.name`,
        therapistIds
      );
      res.json(patients.map((p: any) => ({
        id: p.id, name: p.name, phone: p.phone, email: p.email,
        birthDate: p.birth_date, insuranceType: p.insurance_type,
        insuranceName: p.insurance_name, paymentMethod: p.payment_method,
        totalSessions: p.total_sessions, remainingSessions: p.remaining_sessions,
        amountPaid: p.amount_paid, notes: p.notes,
        city: p.city, state: p.state,
      })));
      return;
    }
  }

  // Default: return all patients (admin/financeiro or profissional with no therapist match)
  let patients;
  if (search) {
    patients = await db.select().from(patientsTable).where(ilike(patientsTable.name, `%${search}%`)).orderBy(patientsTable.name);
  } else {
    patients = await db.select().from(patientsTable).orderBy(patientsTable.name);
  }
  res.json(patients);
});

router.post("/patients", requireAuth, async (req, res): Promise<void> => {
  const {
    name, phone, email, birthDate, insuranceType, insuranceName, paymentMethod,
    totalSessions, amountPaid, zipCode, addressStreet, addressNumber, addressComplement,
    neighborhood, city, state, notes,
  } = req.body;

  if (!name || !phone) {
    res.status(400).json({ error: "Nome e telefone são obrigatórios" });
    return;
  }

  const sessions = parseInt(totalSessions) || 0;
  const paid = amountPaid !== undefined && amountPaid !== null && amountPaid !== "" ? parseFloat(amountPaid) : null;

  const [patient] = await db.insert(patientsTable).values({
    name, phone,
    email: email || null,
    birthDate: birthDate || null,
    insuranceType: insuranceType || "particular",
    insuranceName: insuranceName || null,
    paymentMethod: paymentMethod || null,
    totalSessions: sessions,
    remainingSessions: sessions,
    amountPaid: paid,
    zipCode: zipCode || null,
    addressStreet: addressStreet || null,
    addressNumber: addressNumber || null,
    addressComplement: addressComplement || null,
    neighborhood: neighborhood || null,
    city: city || null,
    state: state || null,
    notes: notes || null,
  }).returning();

  // Auto-create financial entry if amountPaid is set
  if (paid && paid > 0) {
    const today = new Date().toISOString().split("T")[0];
    await db.insert(financialTable).values({
      description: `Pagamento inicial — ${name}`,
      type: "receita",
      amount: paid,
      paymentStatus: "pago",
      category: sessions > 0 ? "Pacote" : "Sessão",
      patientId: patient.id,
      paymentMethod: paymentMethod || null,
      paymentDate: today,
      dueDate: today,
      notes: `Gerado automaticamente no cadastro do paciente. ${sessions} sessões contratadas.`,
    }).returning();
  }

  res.status(201).json(patient);
});

router.get("/patients/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, id));
  if (!patient) { res.status(404).json({ error: "Paciente não encontrado" }); return; }

  res.json(patient);
});

router.patch("/patients/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const {
    name, phone, email, birthDate, insuranceType, insuranceName, paymentMethod,
    totalSessions, remainingSessions, amountPaid, zipCode, addressStreet, addressNumber, addressComplement,
    neighborhood, city, state, notes,
  } = req.body;

  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (phone !== undefined) update.phone = phone;
  if (email !== undefined) update.email = email || null;
  if (birthDate !== undefined) update.birthDate = birthDate || null;
  if (insuranceType !== undefined) update.insuranceType = insuranceType;
  if (insuranceName !== undefined) update.insuranceName = insuranceName || null;
  if (paymentMethod !== undefined) update.paymentMethod = paymentMethod || null;
  if (totalSessions !== undefined) update.totalSessions = parseInt(totalSessions) || 0;
  if (remainingSessions !== undefined) update.remainingSessions = parseInt(remainingSessions) || 0;
  if (amountPaid !== undefined) update.amountPaid = amountPaid !== null && amountPaid !== "" ? parseFloat(amountPaid) : null;
  if (zipCode !== undefined) update.zipCode = zipCode || null;
  if (addressStreet !== undefined) update.addressStreet = addressStreet || null;
  if (addressNumber !== undefined) update.addressNumber = addressNumber || null;
  if (addressComplement !== undefined) update.addressComplement = addressComplement || null;
  if (neighborhood !== undefined) update.neighborhood = neighborhood || null;
  if (city !== undefined) update.city = city || null;
  if (state !== undefined) update.state = state || null;
  if (notes !== undefined) update.notes = notes || null;

  const [patient] = await db.update(patientsTable).set(update).where(eq(patientsTable.id, id)).returning();
  if (!patient) { res.status(404).json({ error: "Paciente não encontrado" }); return; }

  res.json(patient);
});

router.delete("/patients/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  await db.delete(appointmentsTable).where(eq(appointmentsTable.patientId, id));
  const [patient] = await db.delete(patientsTable).where(eq(patientsTable.id, id)).returning();
  if (!patient) { res.status(404).json({ error: "Paciente não encontrado" }); return; }

  res.sendStatus(204);
});

router.get("/patients/:id/history", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const appointments = await db.select({
    id: appointmentsTable.id,
    patientId: appointmentsTable.patientId,
    therapistId: appointmentsTable.therapistId,
    date: appointmentsTable.date,
    time: appointmentsTable.time,
    status: appointmentsTable.status,
    notes: appointmentsTable.notes,
    originalAppointmentId: appointmentsTable.originalAppointmentId,
    recurringGroupId: appointmentsTable.recurringGroupId,
    createdAt: appointmentsTable.createdAt,
    updatedAt: appointmentsTable.updatedAt,
    patientName: patientsTable.name,
    patientPhone: patientsTable.phone,
    therapistName: therapistsTable.name,
    therapistSpecialty: therapistsTable.specialty,
  })
  .from(appointmentsTable)
  .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
  .innerJoin(therapistsTable, eq(appointmentsTable.therapistId, therapistsTable.id))
  .where(eq(appointmentsTable.patientId, id))
  .orderBy(sql`${appointmentsTable.date} DESC, ${appointmentsTable.time} DESC`);

  res.json(appointments);
});

export default router;
