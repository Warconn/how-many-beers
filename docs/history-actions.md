# Cook History actions (#59)
View cook is the primary action, Cook again secondary, and Delete is a quiet
destructive action retaining its existing confirmation. Action controls have
consistent 44px minimum height, responsive wrapping and a separate Backups utility
area below the list. Restore uses a keyboard-accessible native button and file
input. Search, details, account retrieval, confirmation, exports and restore
callbacks are unchanged; no database deletion behavior changes.

Validation includes desktop/mobile rendering and real interaction with details,
repeat, cancel/confirm deletion, download and restore, plus persistence failure
and recovery regression checks.
