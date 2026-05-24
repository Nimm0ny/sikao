# Archived Contract Suites

These files are kept as historical reference only.

They are intentionally moved out of active `pytest` collection during `SIK-25 / B24`
when they target route groups that are not mounted by the live `create_app()`
runtime and therefore are not part of the current backend final gate.

Do not archive a file here solely because its original endpoint surface is stale
if the file also contains still-relevant pure script, service, or factory tests.
Split those active assertions back into a normal `test_*.py` file instead.

Examples:

- legacy auth extras outside `identity_v2`
- old question-bank/admin import routes
- old wrong-book / practice-paper shells
- retired import/event/user-exam route surfaces

Current gate ownership is defined in:

- `docs/plan/sik-25-practice-b24-final-gate.md`
