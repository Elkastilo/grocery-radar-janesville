# Grocery Radar restore drill

This procedure validates a SQLite backup without changing the source backup or any live database.

Run:

```sh
npm run restore:drill -- /absolute/path/to/grocery-radar-backup.sqlite
```

The script copies the backup into a newly created operating-system temporary directory, opens only that copy in read-only mode, runs `PRAGMA integrity_check`, verifies the core product/store/price/proof tables, and reports their row counts. The returned `restored_path` can be used with a disposable `DATA_DIR` for a separate manual application smoke test.

The script never accepts a destination path and never replaces the source. It does not start the application, contact Render, or touch a production environment. Remove the reported temporary directory after any optional manual inspection.
