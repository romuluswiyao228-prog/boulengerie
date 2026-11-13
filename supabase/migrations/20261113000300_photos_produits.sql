-- ============================================================================
-- Migration : photos produits via Supabase Storage
-- - limite la taille et les formats acceptés dans le bucket "produits"
-- - réserve l'écriture (upload/remplacement/suppression) au propriétaire
-- - la lecture reste publique (bucket public) pour la caisse et le catalogue
-- ============================================================================

-- 1. Contraintes du bucket : 5 Mo max, JPG/PNG/WEBP uniquement
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'produits';

-- 2. Lecture : tout le monde (bucket public, catalogue + caisse)
drop policy if exists produits_storage_select on storage.objects;
create policy produits_storage_select on storage.objects
  for select using (bucket_id = 'produits');

-- 3. Écriture : propriétaire uniquement
drop policy if exists produits_storage_insert on storage.objects;
create policy produits_storage_insert on storage.objects
  for insert with check (bucket_id = 'produits' and public.est_proprietaire());

drop policy if exists produits_storage_update on storage.objects;
create policy produits_storage_update on storage.objects
  for update using (bucket_id = 'produits' and public.est_proprietaire())
  with check (bucket_id = 'produits' and public.est_proprietaire());

drop policy if exists produits_storage_delete on storage.objects;
create policy produits_storage_delete on storage.objects
  for delete using (bucket_id = 'produits' and public.est_proprietaire());
