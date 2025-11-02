# TODO for Marshal Profile Integration and Filtering

- [x] Fetch marshal profile on login from Firestore "marshalls" collection.
- [x] Store marshal profile in state in MarshalApp.
- [x] Filter taxis, taxi ranks, payments, and loads by marshal's assigned rank.
- [x] Restrict UI data shown in MarshalDashboard based on marshal's rank.
- [x] Automatically create marshal and supervisor accounts when admin registers a taxi rank.
- [x] Pre-approve auto-created accounts with temporary password.
- [x] Ensure collections (taxis, payments, loads) are accessible based on role-based filtering.
- [ ] Test marshal login and verify profile fetching.
- [ ] Test data filtering by marshal rank for taxis, payments, loads.
- [ ] Verify UI restrictions and actions based on marshal role and rank.
- [ ] Test auto-creation of accounts when admin adds taxi rank.
- [ ] Verify auto-created accounts can login and access only their rank's data.
- [ ] Fix any bugs or issues found during testing.
- [ ] Consider adding role-based UI restrictions if needed.
- [ ] Document changes and update README if necessary.
