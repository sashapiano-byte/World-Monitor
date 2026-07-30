# Backup and restore

## What actually needs backing up

**The dataset is in git.** `./data` is the source of truth for every fact this
project asserts, and it is version-controlled TypeScript. If the database is
lost, `npm run db:migrate && npm run db:seed` rebuilds it exactly.

So the backup priority is:

1. **The git repository** — irreplaceable. Everything else is derived.
2. **Editorial tables** — `editors`, `revisions`, `moderation_log`,
   `review_queue`, `facility_duplicates`. These accumulate *in the database*
   during editorial work and are **not** reconstructible from `./data`. Losing
   them loses the audit trail of who changed what and why.
3. Everything else in Postgres — derived, disposable.

Point 2 is the one people get wrong. A backup strategy that protects the map
data and not the revision history protects the replaceable half.

## Routine backup

```bash
# Full logical dump
docker compose exec -T db pg_dump -U idm -d industrial_damage \
  --format=custom --compress=9 \
  > backups/idm-$(date +%F-%H%M).dump

# Editorial tables only — small, run this often
docker compose exec -T db pg_dump -U idm -d industrial_damage \
  --format=custom \
  --table=editors --table=revisions --table=moderation_log \
  --table=review_queue --table=facility_duplicates \
  > backups/idm-editorial-$(date +%F-%H%M).dump
```

Suggested cadence: editorial dump hourly during active editing, full dump daily,
14 daily + 12 monthly retained. Store off-host; a backup on the same volume as
the database is not a backup.

## Restore

```bash
docker compose up -d db
docker compose exec -T db psql -U idm -d postgres \
  -c "DROP DATABASE IF EXISTS industrial_damage;" \
  -c "CREATE DATABASE industrial_damage;"

docker compose exec -T db pg_restore -U idm -d industrial_damage --clean --if-exists \
  < backups/idm-2026-07-30-1200.dump

curl -s localhost:3000/api/health | jq
```

## Rebuild from source instead

If only the derived data is damaged, or you are moving to a new host:

```bash
npm run db:migrate -- --reset
npm run db:seed
```

`--reset` drops and recreates the `public` schema. The seed runs quality control
first and refuses to load a dataset with errors, so a rebuild cannot quietly
reintroduce a broken record.

**This does not restore the editorial tables.** Restore those from the editorial
dump afterwards.

## Verifying a backup

A backup you have not restored is a hypothesis. Monthly:

```bash
docker run --rm -d --name idm_restore_test \
  -e POSTGRES_USER=idm -e POSTGRES_PASSWORD=test -e POSTGRES_DB=verify \
  -p 55433:5432 postgis/postgis:16-3.4
sleep 10
pg_restore -h localhost -p 55433 -U idm -d verify --clean --if-exists < backups/latest.dump
psql -h localhost -p 55433 -U idm -d verify -c "SELECT count(*) FROM facilities;"
psql -h localhost -p 55433 -U idm -d verify -c "SELECT count(*) FROM revisions;"
docker rm -f idm_restore_test
```

Expected: 64 facilities, and a revision count matching your editorial activity.

## Exports as a secondary archive

The export endpoints produce self-describing snapshots carrying dataset version,
review date, licence and the confidence warning:

```bash
BASE=http://localhost:3000
mkdir -p archive/$(date +%F)
for f in facilities.csv incidents.csv sources.csv dataset.json geojson; do
  curl -s "$BASE/api/export/$f" -o "archive/$(date +%F)/$f"
done
```

These are a readable archive for third parties, not a restore path — they carry
published records only, not the editorial tables.

## Secrets

`.env` and `docker/certs/ca.crt` are git-ignored and are **not** in any dump.
Back them up separately through your secret manager. Losing `INGEST_SECRET`
costs nothing; regenerate it.
