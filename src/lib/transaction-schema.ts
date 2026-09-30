import { z } from "zod";
import { getIPhoneById, isValidIPhoneColor, isValidIPhoneModel } from "@catalog/iphones";
import type { CreateTransactionPayload, SavedImage, Transaction } from "../domain/transactions";
import type { PhoneTransactionRow } from "./supabase/database.types";

const validDate = z.string().refine((date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}, "Saisissez une date valide.");

export const createTransactionSchema = z.object({
  id: z.string().uuid(),
  direction: z.enum(["buy", "sell"]),
  modelId: z.string().min(1).max(100),
  colorName: z.string().min(1).max(100),
  amount: z.number().finite().positive().max(10_000_000),
  currency: z.enum(["TND", "EUR", "USD"]),
  date: validDate,
  phonePhotos: z.array(z.string().min(1).max(180)).max(5),
  idFront: z.string().min(1).max(180),
  idBack: z.string().min(1).max(180),
  notes: z.string().max(3000).default(""),
}).strict().superRefine((transaction, context) => {
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

export function validateTransactionPhotoPaths(input: ValidatedTransactionInput, userId: string): boolean {
  const prefix = `${escapeRegex(userId)}/${escapeRegex(input.id)}/`;
  const phonePath = new RegExp(`^${prefix}phone-[1-5]\\.jpg$`);
  const frontPath = new RegExp(`^${prefix}id-front\\.jpg$`);
  const backPath = new RegExp(`^${prefix}id-back\\.jpg$`);
  return input.phonePhotos.every((path) => phonePath.test(path))
    && new Set(input.phonePhotos).size === input.phonePhotos.length
    && frontPath.test(input.idFront)
    && backPath.test(input.idBack);
}

export type TransactionRow = Omit<PhoneTransactionRow, "user_id">;

function fileUrl(path: string): string {
  return `/api/files/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function savedImage(path: string, label: string): SavedImage {
  return { name: label, mimeType: "image/jpeg", url: fileUrl(path) };
}

export function presentTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    direction: row.direction,
    phoneModel: row.phone_model,
    phoneColor: row.phone_color,
    amount: Number(row.amount),
    currency: row.currency,
    date: row.date,
    phonePhotos: row.phone_photos.map((path, index) => savedImage(path, `Photo de l’iPhone ${index + 1}`)),
    idFront: savedImage(row.id_front_path, `${row.direction === "buy" ? "Pièce d’identité du vendeur" : "Pièce d’identité de l’acheteur"} — recto`),
    idBack: savedImage(row.id_back_path, `${row.direction === "buy" ? "Pièce d’identité du vendeur" : "Pièce d’identité de l’acheteur"} — verso`),
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
    model_id: input.modelId,
    phone_model: model.name,
    phone_color: input.colorName,
    amount: input.amount,
    currency: input.currency,
    date: input.date,
    phone_photos: input.phonePhotos,
    id_front_path: input.idFront,
    id_back_path: input.idBack,
    notes: input.notes.trim(),
  };
}
