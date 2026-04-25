# Security Specification - ID Management System

## 1. Data Invariants
- An ID record must have a valid `id_number`, names in both Amharic and English, and a `status`.
- Only Administrators can approve or reject records.
- Data Entry users can only create records with a `pending` status (unless they are also Admins).
- Users can only read their own records if they are Data Entry, but Admins can read all.
- Records can only be printed if their status is `approved`.
- User accounts must be `active` to perform any operations.

## 2. The "Dirty Dozen" Payloads (Denial Tests)

1. **Identity Spoofing**: Attempt to create a record with a `created_by_email` that doesn't match the current user.
2. **Privilege Escalation**: A Data Entry user trying to set a record to `approved` during creation.
3. **State Shortcutting**: A Data Entry user trying to update a `pending` record to `approved`.
4. **Unauthorized Deletion**: A Data Entry user trying to delete a record.
5. **ID Poisoning**: Using a 2KB string as an `id_number`.
6. **Bypassing Invariants**: Creating a record without a `status`.
7. **Resource Exhaustion**: Sending a 1MB string in the `full_name_am` field.
8. **Orphaned Writes**: Creating an ID record without a valid session.
9. **PII Leak**: A Viewer trying to read private user data from the `users` collection.
10. **Shadow Update**: Adding an `isAdmin: true` field to a user profile.
11. **Inactive Access**: A user whose `active` field is `false` trying to read anything.
12. **Tampering with Identity**: Updating the `created_by_email` of an existing record.

## 3. Test Runner (Draft)
The test runner will verify that all operations by unauthorized users or with invalid data shapes are rejected with `PERMISSION_DENIED`.
