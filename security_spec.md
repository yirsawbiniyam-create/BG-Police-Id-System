# Security Specification - ID Management System

## 1. Data Invariants
- An ID record must have a valid `id_number`, names in both Amharic and English, and a `status`.
- Only Administrators or Approvers can approve, return for correction, or reject records.
- Data Entry users can only create records with a `pending` status (unless they are also Admins).
- Users can only read their own records if they are Data Entry, but Admins/Approvers can read all.
- Records can only be printed if their status is `approved` and `deleted != true`.
- Every successful print by an authorized user (`Administrator`, `Approver`, `Data Entry`) creates an immutable `print_logs` entry containing `id_number`, `id_doc_id`, `user_email`, `user_role`, `side`, `uid`, and server `timestamp == request.time`.
- `print_logs` entries cannot be updated or deleted by any client.
- User accounts must be `active` to perform any operations.

## 2. The "Dirty Dozen" Payloads (Denial Tests)

1. **Identity Spoofing**: Attempt to create a record with a `created_by_email` or `print_logs.user_email` / `uid` that doesn't match the current user.
2. **Privilege Escalation**: A Data Entry user trying to set a record to `approved` during creation, or a `Viewer` trying to create a `print_logs` document.
3. **State Shortcutting**: Attempting to log a print (`print_logs`) for an unapproved (`pending` or `deleted`) ID record.
4. **Unauthorized Deletion**: Trying to delete or update an immutable `print_logs` audit document.
5. **ID Poisoning**: Using a 2KB string as an `id_number` or `logId`.
6. **Bypassing Invariants**: Creating a `print_logs` record without a server `timestamp == request.time`.
7. **Resource Exhaustion**: Sending a 1MB string in the `full_name_am` or `user_email` field.
8. **Orphaned Writes**: Creating a `print_logs` entry referencing a non-existent `id_doc_id`.
9. **PII Leak**: A Viewer trying to read private user data or another user's `print_logs`.
10. **Shadow Update**: Adding an `isVerified: true` ghost field to a `print_logs` payload.
11. **Inactive Access**: A user whose `active` field is `false` trying to create a `print_logs` entry.
12. **Tampering with Identity**: Updating the `created_by_email` of an existing record.

## 3. Test Runner (Draft)
The test runner will verify that all operations by unauthorized users or with invalid data shapes are rejected with `PERMISSION_DENIED`.

