-- Copy to a local, untracked file, fill in, and run in the SQL editor (or psql).
insert into public.events (slug, couple_names, wedding_date, upload_deadline)
values ('casamento', 'Nome & Nome', '2026-12-12', '2026-12-31T23:59:00-03');

insert into public.admins (email) values ('email1@example.com'), ('email2@example.com');
