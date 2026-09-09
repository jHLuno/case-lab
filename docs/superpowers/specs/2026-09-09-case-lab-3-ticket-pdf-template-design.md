# Case Lab III ticket PDF template

## Decision

Replace the existing A4 ticket composition with the supplied Case Lab III editorial layout. The PDF keeps the existing generated, signed QR payload and replaces the cream placeholder labeled `QR-КОД` with the rendered QR image. The face of the ticket intentionally contains no participant name or ticket number, as selected by the user.

## Layout

- A4 portrait page with the same aspect ratio as the supplied 1240x1748 reference.
- Deep blue full-page background.
- Cream CASE LAB III wordmark at the top.
- Two rounded blue information cards for `24.09 / 24 сентября 2026` and `10:00 / начало мероприятия`.
- One cream rounded venue card containing `МЕСТО`, `Narxoz Business School (NBS)`, and `Алматы`.
- Cream `ВАШ БИЛЕТ` heading near the lower half.
- Large cream rounded QR card; the QR image is centered with a quiet zone and sufficient error correction.

## Data and security

The QR source remains `fields.qrPayload` from the current ticket token flow. No service credentials, provider payloads, or raw secrets are added to the PDF. Existing PDF authorization, ticket revision, status, and deterministic rendering behavior remain unchanged.

## Verification

Add/adjust focused PDF tests to assert the new visible copy, absence of sensitive values, deterministic output, and presence of an embedded QR image. Render a representative PDF to PNG and inspect the final page for clipping, contrast, QR quiet zone, and legibility.
