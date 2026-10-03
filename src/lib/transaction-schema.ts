import { z } from "zod";
import { getIPhoneById, isValidIPhoneColor, isValidIPhoneModel } from "@catalog/iphones";
import type { CreateTransactionPayload, SavedImage, Transaction } from "../domain/transactions";
import type { PhoneTransactionRow } from "./supabase/database.types";

const validDate = z.string().refine((date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}, "Saisissez une date valide.");

const optionalImei = z.string().trim().max(15, "L’IMEI doit contenir 15 chiffres.")
  .refine((value) => !value || /^\d{15}$/.test(value), "L’IMEI doit contenir 15 chiffres.")
  .default("");
const optionalSerialNumber = z.string().trim()
  .max(50, "Le numéro de série doit contenir 50 caractères maximum.")
  .default("");

export const createTransactionSchema = z.object({
  id: z.string().uuid(),
  direction: z.enum(["buy", "sell"]),
  soldFromTransactionId: z.string().uuid().nullable().default(null),
  modelId: z.string().min(1).max(100),
  colorName: z.string().min(1).max(100),
  imei: optionalImei,
  serialNumber: optionalSerialNumber,
  amount: z.number().finite().positive().max(10_000_000),
  currency: z.enum(["TND", "EUR", "USD"]),
  date: validDate,
  phonePhotos: z.array(z.string().min(1).max(180)).max(5),
  idFront: z.string().min(1).max(180).nullable().default(null),
  idBack: z.string().min(1).max(180).nullable().default(null),
  notes: z.string().max(3000).default(""),
}).strict().superRefine((transaction, context) => {
  if (transaction.direction === "buy" && transaction.soldFromTransactionId !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["soldFromTransactionId"], message: "Un achat ne peut pas être lié à un autre achat." });
  }
  if (!isValidIPhoneModel(transaction.modelId)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["modelId"], message: "Choisissez un modèle d’iPhone dans le catalogue." });
    return;
  }
  if (!isValidIPhoneColor(transaction.modelId, transaction.colorName)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["colorName"], message: "Choisissez une couleur proposée pour ce modèle d’iPhone." });
  }
});

export type ValidatedTransactionInput = z.infer<typeof createTransactionSchema>;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function validateTransactionPhotoPaths(input: ValidatedTransactionInput, userId: string, allowEditedFiles = false): boolean {
  const prefix = `${escapeRegex(userId)}/${escapeRegex(input.id)}/`;
  const uploadId = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
  const suffix = allowEditedFiles ? `(?:-${uploadId})?` : "";
  const phonePath = new RegExp(`^${prefix}phone-[1-5]${suffix}\\.jpg$`);
  const frontPath = new RegExp(`^${prefix}id-front${suffix}\\.jpg$`);
  const backPath = new RegExp(`^${prefix}id-back${suffix}\\.jpg$`);
  return input.phonePhotos.every((path) => phonePath.test(path))
    && new Set(input.phonePhotos).size === input.phonePhotos.length
    && (input.idFront === null || frontPath.test(input.idFront))
    && (input.idBack === null || backPath.test(input.idBack));
}

export type TransactionRow = Omit<PhoneTransactionRow, "user_id">;

function fileUrl(path: string): string {
  return `/api/files/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function savedImage(path: string, label: string): SavedImage {
  return { name: label, mimeType: "image/jpeg", url: fileUrl(path), path };
}

export function presentTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    direction: row.direction,
    soldFromTransactionId: row.sold_from_transaction_id,
    phoneModel: row.phone_model,
    phoneColor: row.phone_color,
    imei: row.imei,
    serialNumber: row.serial_number,
    amount: Number(row.amount),
    currency: row.currency,
    date: row.date,
    phonePhotos: row.phone_photos.map((path, index) => savedImage(path, `Photo de l’iPhone ${index + 1}`)),
    idFront: row.id_front_path ? savedImage(row.id_front_path, `${row.direction === "buy" ? "Pièce d’identité du vendeur" : "Pièce d’identité de l’acheteur"} — recto`) : null,
    idBack: row.id_back_path ? savedImage(row.id_back_path, `${row.direction === "buy" ? "Pièce d’identité du vendeur" : "Pièce d’identité de l’acheteur"} — verso`) : null,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function toTransactionInsert(input: CreateTransactionPayload, userId: string) {
  const model = getIPhoneById(input.modelId);
  if (!model) throw new Error("La validation du modèle doit précéder l’enregistrement.");
  return {
    id: input.id,
    user_id: userId,
    direction: input.direction,
    sold_from_transaction_id: input.soldFromTransactionId,
    model_id: input.modelId,
    phone_model: model.name,
    phone_color: input.colorName,
    imei: input.imei || null,
    serial_number: input.serialNumber || null,
    amount: input.amount,
    currency: input.currency,
    date: input.date,
    phone_photos: input.phonePhotos,
    id_front_path: input.idFront,
    id_back_path: input.idBack,
    notes: input.notes.trim(),
  };
}

export function toTransactionUpdate(input: CreateTransactionPayload) {
  const model = getIPhoneById(input.modelId);
  if (!model) throw new Error("La validation du modèle doit précéder la modification.");
  return {
    direction: input.direction,
    sold_from_transaction_id: input.soldFromTransactionId,
    model_id: input.modelId,
    phone_model: model.name,
    phone_color: input.colorName,
    imei: input.imei || null,
    serial_number: input.serialNumber || null,
    amount: input.amount,
    currency: input.currency,
    date: input.date,
    phone_photos: input.phonePhotos,
    id_front_path: input.idFront,
    id_back_path: input.idBack,
    notes: input.notes.trim(),
  };
}
