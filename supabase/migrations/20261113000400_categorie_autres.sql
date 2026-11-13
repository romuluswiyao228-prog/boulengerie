-- Ajoute la catégorie « Autres » aux catégories initiales du catalogue
insert into public.categories_produits (nom)
values ('Autres')
on conflict (nom) do nothing;
