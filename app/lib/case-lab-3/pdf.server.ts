import "server-only";

import { resolve } from "node:path";

import PDFDocument from "pdfkit";
import QRCode from "qrcode";

import type { TicketPdfRevision, TicketPresentation } from "./ticket.server";

export type RenderableTicketRevision = TicketPdfRevision | TicketPresentation;

const FONT_REGULAR = resolve(process.cwd(), "public/fonts/Gilroy-Regular.woff2");
const FONT_MEDIUM = resolve(process.cwd(), "public/fonts/Gilroy-Medium.woff2");
const PDF_CREATION_DATE = new Date("2026-09-24T00:00:00.000Z");

function renderableFields(ticket: RenderableTicketRevision): TicketPdfRevision {
  if ("participant" in ticket) {
    return {
      ticketId: ticket.ticketId,
      publicTicketNumber: ticket.publicTicketNumber,
      revisionId: ticket.revisionId,
      revisionNumber: ticket.revisionNumber,
      tokenVersion: ticket.tokenVersion,
      status: ticket.status,
      firstName: ticket.participant.firstName,
      lastName: ticket.participant.lastName,
      qrPayload: ticket.qrPayload,
      manualCode: ticket.manualCode,
      eventName: ticket.eventName,
      eventDate: ticket.eventDate,
      eventTime: ticket.eventTime,
      venue: ticket.venue,
      supportEmail: ticket.supportEmail,
      pdfUrl: ticket.pdfUrl,
    };
  }
  return ticket;
}

function ticketState(status: TicketPdfRevision["status"]): string {
  if (status === "used") return "Использован";
  if (status === "cancelled") return "Отменен";
  return "Действителен";
}

function collectDocument(document: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolveDocument, reject) => {
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)));
    document.once("error", reject);
    document.once("end", () => resolveDocument(Buffer.concat(chunks)));
    document.end();
  });
}

export async function renderTicketPdf(ticket: RenderableTicketRevision): Promise<Buffer> {
  const fields = renderableFields(ticket);
  const qrPng = await QRCode.toBuffer(fields.qrPayload, {
    errorCorrectionLevel: "M",
    margin: 4,
    width: 320,
    type: "png",
  });
  const document = new PDFDocument({
    size: "A4",
    margin: 0,
    compress: false,
    info: {
      Title: "Case Lab III ticket",
      Author: "Case Lab",
      Subject: fields.publicTicketNumber,
      CreationDate: new Date(PDF_CREATION_DATE),
    },
  });

  document.registerFont("Gilroy", FONT_REGULAR);
  document.registerFont("Gilroy Medium", FONT_MEDIUM);

  document.rect(0, 0, 595.28, 841.89).fill("#080811");
  document.fillColor("#ffffff").font("Gilroy Medium").fontSize(10).text("CASE LAB III", 52, 54, {
    characterSpacing: 1.8,
  });
  document.fillColor("#aeb5ff").font("Gilroy").fontSize(9).text("24 СЕНТЯБРЯ 2026 · ALMATY", 52, 72, {
    characterSpacing: 1.2,
  });

  document.fillColor("#ffffff").font("Gilroy Medium").fontSize(31).text("БИЛЕТ НА МЕРОПРИЯТИЕ", 52, 142, {
    width: 330,
    lineGap: 2,
  });
  document.fillColor("#d4d2e9").font("Gilroy").fontSize(15).text(fields.eventName, 52, 232);
  document.fillColor("#ffffff").font("Gilroy Medium").fontSize(21).text(`${fields.firstName} ${fields.lastName}`, 52, 286, {
    width: 300,
  });

  document.fillColor("#9d9bad").font("Gilroy").fontSize(10).text("ДАТА И ВРЕМЯ", 52, 362, { characterSpacing: 1.1 });
  document.fillColor("#ffffff").font("Gilroy Medium").fontSize(14).text(`${fields.eventDate}, ${fields.eventTime}`, 52, 381);
  document.fillColor("#9d9bad").font("Gilroy").fontSize(10).text("МЕСТО", 52, 423, { characterSpacing: 1.1 });
  document.fillColor("#ffffff").font("Gilroy").fontSize(14).text(fields.venue, 52, 442, { width: 270, lineGap: 3 });

  document.image(qrPng, 365, 150, { fit: [174, 174], align: "center", valign: "center" });
  document.fillColor("#9d9bad").font("Gilroy").fontSize(9).text("QR-КОД ДЛЯ ВХОДА", 365, 336, {
    width: 174,
    align: "center",
    characterSpacing: 1,
  });

  document.roundedRect(52, 548, 491, 92, 14).fill("#15152a");
  document.fillColor("#9d9bad").font("Gilroy").fontSize(9).text("НОМЕР БИЛЕТА", 74, 570, { characterSpacing: 1 });
  document.fillColor("#ffffff").font("Gilroy Medium").fontSize(16).text(fields.publicTicketNumber, 74, 590);
  document.fillColor("#9d9bad").font("Gilroy").fontSize(9).text("КОД ДЛЯ РУЧНОЙ ПРОВЕРКИ", 326, 570, { characterSpacing: 1 });
  document.fillColor("#ffffff").font("Gilroy Medium").fontSize(16).text(fields.manualCode, 326, 590);

  document.fillColor("#d4d2e9").font("Gilroy").fontSize(12).text(`Статус: ${ticketState(fields.status)}`, 52, 692);
  document.fillColor("#9d9bad").font("Gilroy").fontSize(10).text(`Поддержка: ${fields.supportEmail}`, 52, 733);
  document.fillColor("#65647a").font("Gilroy").fontSize(9).text("Сохраните этот билет и предъявите QR-код на входе.", 52, 781);

  return collectDocument(document);
}
