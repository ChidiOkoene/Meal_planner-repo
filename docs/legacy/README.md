# Legacy code

Kept only for reference while porting. Not built, linted or imported.

- `nutrientCalculator.ts`: nutrition scaling, CSV export and aggregation helpers from the old Express backend. Ported into `packages/nutrition` in issue #13. It has a known bug: a real value of `0` for fibre, sugar or sodium is treated as missing.
