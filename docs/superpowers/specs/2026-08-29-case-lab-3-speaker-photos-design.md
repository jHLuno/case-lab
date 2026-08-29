# Case Lab 3 Speaker Photos

## Goal

Replace the Anuar and Perizat speaker photos on `/case-lab-3` with the supplied local source files, converted to WebP first. Keep the Forte speaker visual unchanged until a replacement photo is available.

## Scope

- Convert `/Users/arney/Downloads/Anuar.jpg` to `public/Anuar.webp`.
- Convert `/Users/arney/Downloads/Perizat.jpeg` to `public/Perizat.webp`.
- Preserve the source dimensions and use WebP quality `100`.
- Update only the first two `item.image` paths in `app/sections/CaseLab3Speakers.tsx`.
- Leave speaker names, copy, Forte assets, hero assets, and all other page sections unchanged.

## Verification

- Confirm both generated assets are valid WebP files.
- Confirm the speaker component references the two new paths and still references `/ForteXGForce.webp`.
- Run the relevant asset tests and the TypeScript check.
