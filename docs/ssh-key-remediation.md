# Historical SSH key remediation

The passphrase-encrypted Ed25519 private key was added in commit `ff55942` on 30 November 2025. Identify its matching public key using the SHA256 fingerprint `SHA256:YTf0CmytQ+G8/irKITW+5jtUtYcKtdLLdSvNkKgUgwI`. The development-branch removal is a forward change. Earlier commits and other branches can still contain the private key.

## Revoke and verify

1. Check GitHub account SSH settings, repository deploy keys, CI and automation credentials, and server `authorized_keys` entries for the fingerprint. Ask the owner of any other service that may have trusted the key to check their records.
2. Replace any active usage with a new key generated in a trusted environment. Store the replacement private key in the approved secret store. Remove the old public key from every trust location and verify the replacement works. Review available access and audit logs from the earliest possible exposure.
3. Record the locations checked, revocations, and verification results in the private incident record. Keep all private-key material and passphrases out of the incident record and repository.

## Decide how to handle old copies

1. Inventory affected branches and tags, PR refs and attachments, forks, clones, backups, mirrors, and published environment snapshots. Preserve necessary evidence in restricted storage. Stop distributing snapshots containing the file.
2. Ask the repository owner to approve a separate forward removal from other active branches, including `main`. Coordinate any historical purge separately. A purge is an owner decision because it changes commit IDs and affects collaborators, open pull requests, and downstream copies.
3. If a purge is approved, use a separate maintenance window and test it in an isolated mirror. Validate that intended history and unrelated files are preserved. Coordinate with the host about cached views and inaccessible PR refs, with fork and mirror owners about their copies, and with collaborators about replacing or cleaning stale clones. Keep rollback material restricted.
4. Verify the result from a fresh clone by scanning advertised refs and checking the affected paths and original blob. Document remaining copies outside the owner's control. Continue to treat the original key as revoked regardless of purge outcome.
