import {
  ReportStatus,
  type CreatedReport,
  type ReportDetail,
  type SubmitAdverseEventReport,
} from "@canmedseg/shared";
import type { Pool, PoolClient } from "pg";

type ReportRow = {
  id: string;
  status: typeof ReportStatus.EnRevision;
  form_data: SubmitAdverseEventReport;
  created_at: Date;
  submitted_at: Date;
};

function metadata(row: ReportRow): CreatedReport {
  return {
    id: row.id,
    status: ReportStatus.EnRevision,
    createdAt: row.created_at.toISOString(),
    submittedAt: row.submitted_at.toISOString(),
  };
}

async function insertEvents(
  client: PoolClient,
  reportId: string,
  report: SubmitAdverseEventReport,
): Promise<void> {
  for (const [position, event] of report.events.entries()) {
    await client.query(
      `INSERT INTO report_adverse_events (
        report_id, position, meddra_term, start_date, end_date, duration_days,
        outcome, is_serious, seriousness_criterion
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        reportId,
        position,
        event.meddraTerm,
        event.startDate,
        event.endDate || null,
        event.durationDays ?? null,
        event.outcome ?? null,
        event.isSerious,
        event.seriousnessCriterion ?? null,
      ],
    );
  }
}

async function insertMedicines(
  client: PoolClient,
  reportId: string,
  report: SubmitAdverseEventReport,
): Promise<void> {
  for (const [position, medicine] of report.medicines.entries()) {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO report_medicines (
        report_id, position, name, company, batch_number, access_form, presentation,
        dose, thc_percent, cbd_percent, other_percent, doses_per_day, amount_per_dose,
        administration_route, administration_start_date, administration_end_date,
        administration_duration_days, recent_product_change, recent_product_change_detail,
        indication_text, indication_category, action_taken
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
      ) RETURNING id`,
      [
        reportId, position, medicine.name, medicine.company || null,
        medicine.batchNumber || null, medicine.accessForm ?? null,
        medicine.presentation ?? null, medicine.dose || null,
        medicine.thcPercent ?? null, medicine.cbdPercent ?? null,
        medicine.otherPercent ?? null, medicine.dosesPerDay ?? null,
        medicine.amountPerDose ?? null, medicine.administrationRoute ?? null,
        medicine.administrationStartDate, medicine.administrationEndDate || null,
        medicine.administrationDurationDays ?? null, medicine.recentProductChange ?? null,
        medicine.recentProductChangeDetail || null, medicine.indicationText || null,
        medicine.indicationCategory ?? null, medicine.actionTaken ?? null,
      ],
    );

    if (medicine.packageImageName) {
      await client.query(
        `INSERT INTO report_images (report_id, medicine_id, original_name)
         VALUES ($1, $2, $3)`,
        [reportId, inserted.rows[0]?.id, medicine.packageImageName],
      );
    }
  }
}

async function insertConcomitants(
  client: PoolClient,
  reportId: string,
  report: SubmitAdverseEventReport,
): Promise<void> {
  for (const [position, treatment] of report.concomitantTreatments.entries()) {
    await client.query(
      `INSERT INTO report_concomitants (
        report_id, position, name, mg_per_dose, doses_per_day, start_date, end_date, duration_days
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        reportId, position, treatment.name, treatment.mgPerDose ?? null,
        treatment.dosesPerDay ?? null, treatment.startDate, treatment.endDate || null,
        treatment.durationDays ?? null,
      ],
    );
  }
}

export async function createReport(
  pool: Pool,
  input: SubmitAdverseEventReport,
): Promise<CreatedReport> {
  const client = await pool.connect();
  const report = { ...input, status: ReportStatus.EnRevision, currentStep: 5 };
  try {
    await client.query("BEGIN");
    const inserted = await client.query<ReportRow>(
      `INSERT INTO reports (
        status, patient_initials, patient_national_id, patient_sex, patient_weight_kg,
        patient_height_m, patient_birth_date, patient_age_at_event_start,
        patient_country_of_event_start, adverse_event_description, severity_grade,
        previous_diseases, has_concomitant_treatments, additional_comments,
        contact_reporting_area, contact_profession, contact_first_name, contact_last_name,
        contact_health_facility, contact_email, contact_phone, send_email_receipt, form_data
      ) VALUES (
        'en_revision',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
      ) RETURNING id, status, form_data, created_at, submitted_at`,
      [
        report.patient.initials, report.patient.nationalId || null, report.patient.sex,
        report.patient.weightKg ?? null, report.patient.heightM ?? null,
        report.patient.birthDate, report.patient.ageAtEventStart,
        report.patient.countryOfEventStart, report.adverseEventDescription,
        report.severityGrade ?? null, report.previousDiseases || null,
        report.hasConcomitantTreatments ?? null, report.additionalComments || null,
        report.contact.reportingArea || null, report.contact.profession,
        report.contact.firstName || null, report.contact.lastName || null,
        report.contact.healthFacility || null, report.contact.email, report.contact.phone,
        report.contact.sendEmailReceipt, JSON.stringify(report),
      ],
    );

    const row = inserted.rows[0];
    if (!row) throw new Error("PostgreSQL no devolviÃ³ el reporte creado");
    await insertEvents(client, row.id, report);
    await insertMedicines(client, row.id, report);
    await insertConcomitants(client, row.id, report);
    await client.query("COMMIT");
    return metadata(row);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getReport(pool: Pool, id: string): Promise<ReportDetail | null> {
  const result = await pool.query<ReportRow>(
    `SELECT id, status, form_data, created_at, submitted_at FROM reports WHERE id = $1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { ...metadata(row), report: row.form_data };
}
