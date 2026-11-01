-- Church councils (YB 2026-11-01): Sada groups follow the church structure.
-- Order of the church's "Badan Organisasi": Parhalado (elders) on top, Spiritual Committee, Ordinary Committee (Administration:
-- Chairman, Secretary, Treasurer, admin staff, auditors), Dewan Koinonia, Dewan Marturia, Dewan Diakonia (each with its subgroups), Jemaat last.
-- Nothing is removed.
alter table hk_groups add column if not exists council text;

update hk_groups set council = 'parhalado', sort = 0 where id = 'parhalado';
update hk_groups set council = 'admin', sort = 20 where id = 'chairman';
update hk_groups set council = 'admin', sort = 21 where id = 'secretary';
update hk_groups set council = 'admin', sort = 22 where id = 'treasurer';
update hk_groups set council = 'koinonia' where id in ('sekolah-minggu', 'remaja', 'naposo', 'ina', 'ama', 'pelaut');
update hk_groups set council = 'marturia', sort = 32 where id = 'musik';
update hk_groups set council = 'marturia', sort = 33 where id = 'band';
update hk_groups set council = 'marturia', sort = 34 where id = 'song-leader';
update hk_groups set council = 'marturia', sort = 35 where id = 'koor';
update hk_groups set council = 'diakonia', sort = 45 where id = 'multimedia';
update hk_groups set council = 'jemaat', sort = 60 where id = 'jemaat';

-- The three councils (own page, news, events and chat for the council) and the new subgroups from the church structure.
insert into hk_groups (id, kind, name_id, name_bt, name_en, color, icon, sort, council) values
  ('spiritual', 'sermon', 'Komisi Spiritual', 'Komisi Spiritual', 'Spiritual Committee', '#7c2d12', 'book', 1, 'spiritual'),
  ('admin-staff', 'sermon', 'Anggota Biasa (Admin)', 'Anggota Biasa (Admin)', 'Ordinary Members (Admin)', '#475569', 'file', 23, 'admin'),
  ('auditors', 'sermon', 'Anggota Biasa (Auditor)', 'Anggota Biasa (Auditor)', 'Ordinary Members (Auditors)', '#0f766e', 'check', 24, 'admin'),
  ('dewan-koinonia', 'sermon', 'Dewan Koinonia', 'Dewan Koinonia', 'Koinonia Council', '#b45309', 'groups', 10, 'koinonia'),
  ('dewan-marturia', 'sermon', 'Dewan Marturia', 'Dewan Marturia', 'Marturia Council', '#1d4ed8', 'bell', 30, 'marturia'),
  ('zending', 'sermon', 'Zending', 'Zending', 'Mission (Zending)', '#0e7490', 'globe', 31, 'marturia'),
  ('dewan-diakonia', 'sermon', 'Dewan Diakonia', 'Dewan Diakonia', 'Diakonia Council', '#047857', 'heart', 40, 'diakonia'),
  ('sosial', 'sermon', 'Sosial Kemasyarakatan', 'Sosial Kemasyarakatan', 'Social & Community', '#d97706', 'people', 41, 'diakonia'),
  ('kesehatan', 'sermon', 'Kesehatan', 'Hahipason', 'Health', '#dc2626', 'plus', 42, 'diakonia'),
  ('pendidikan', 'sermon', 'Pendidikan', 'Parsingkolaan', 'Education', '#4338ca', 'book', 43, 'diakonia'),
  ('perlengkapan', 'sermon', 'Perlengkapan', 'Perlengkapan', 'Equipment & Facilities', '#57534e', 'gear', 44, 'diakonia')
on conflict (id) do nothing;
-- Koinonia's subgroups sort after its council card.
update hk_groups set sort = 10 + sort where id in ('sekolah-minggu', 'remaja', 'naposo', 'ina', 'ama', 'pelaut') and sort < 10;

-- Council heads and subgroup heads from the church structure (only people already in Sada; existing roles are kept).
update hk_members set groups = groups || '{"spiritual":"chair"}' where name = 'Pdt. Catherina Hutasoit' and removed_at is null and not groups ? 'spiritual';
update hk_members set groups = groups || '{"spiritual":"member"}' where name in ('St. Ratna Silitonga', 'St. Johnny Tobing') and removed_at is null and not groups ? 'spiritual';
update hk_members set groups = groups || '{"dewan-koinonia":"chair"}' where name = 'St. Farinton Nainggolan' and removed_at is null and not groups ? 'dewan-koinonia';
update hk_members set groups = groups || '{"dewan-marturia":"chair"}' where name = 'St. Helmi Sihombing' and removed_at is null and not groups ? 'dewan-marturia';
update hk_members set groups = groups || '{"dewan-diakonia":"chair"}' where name = 'St. Ratna Silitonga' and removed_at is null and not groups ? 'dewan-diakonia';
update hk_members set groups = groups || '{"zending":"chair","dewan-marturia":"member"}' where name = 'St. Royen Gultom' and removed_at is null and not groups ? 'zending';
update hk_members set groups = groups || '{"sosial":"chair","dewan-diakonia":"member"}' where name = 'St. Harry Sianturi' and removed_at is null and not groups ? 'sosial';
update hk_members set groups = groups || '{"dewan-koinonia":"member"}' where name in ('Dien Pasaribu', 'Naomi Lubis', 'Dearni Purba', 'St. Toga Sihombing', 'Reynold Limbong') and removed_at is null and not groups ? 'dewan-koinonia';
update hk_members set groups = groups || '{"dewan-marturia":"member"}' where name in ('Richard Siburian', 'Mira Nainggolan') and removed_at is null and not groups ? 'dewan-marturia';
