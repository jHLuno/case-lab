import "server-only";

import { resolve } from "node:path";

import PDFDocument from "pdfkit";
import QRCode from "qrcode";

import type { TicketPdfRevision, TicketPresentation } from "./ticket.server";

export type RenderableTicketRevision = TicketPdfRevision | TicketPresentation;

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const TICKET_TEMPLATE = resolve(process.cwd(), "public/case-lab-3-ticket-template.png");
const QR_SIZE = 202;
const QR_LEFT = (PAGE_WIDTH - QR_SIZE) / 2;
const QR_TOP = 579;
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
    width: 640,
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

  document.image(TICKET_TEMPLATE, 0, 0, { width: PAGE_WIDTH, height: PAGE_HEIGHT });
  document.image(qrPng, QR_LEFT, QR_TOP, { width: QR_SIZE, height: QR_SIZE });

  return collectDocument(document);
}
