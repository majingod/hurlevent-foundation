-- RECHERCHE-CONTIENT : rechercher_encyclopedie passe de full-text (mots entiers)
-- a une recherche par sous-chaine unaccentee (ILIKE), seuil 3 caracteres, tri titre-d'abord.
-- Signature INCHANGEE (zero front). Perimetre repliquant exactement chaque recherche_tsv.
-- Reversible : CREATE OR REPLACE (rollback = reappliquer l'ancienne definition).

-- Helper : extrait surlignant la 1re occurrence de la sous-chaine (positions sur texte original).
CREATE OR REPLACE FUNCTION public._snip_contient(p_corps text, p_terme_ua text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public'
AS $snip$
DECLARE
  v_pos int;
  v_start int;
  v_tlen int := length(p_terme_ua);
BEGIN
  IF p_corps IS NULL OR p_corps = '' THEN RETURN ''; END IF;
  v_pos := strpos(lower(public.f_unaccent(p_corps)), lower(p_terme_ua));
  IF v_pos = 0 THEN RETURN left(p_corps, 80); END IF;
  v_start := greatest(1, v_pos - 30);
  RETURN (CASE WHEN v_start > 1 THEN '…' ELSE '' END)
    || substr(p_corps, v_start, v_pos - v_start)
    || '<mark>' || substr(p_corps, v_pos, v_tlen) || '</mark>'
    || substr(p_corps, v_pos + v_tlen, 45)
    || (CASE WHEN length(p_corps) > v_pos + v_tlen + 45 THEN '…' ELSE '' END);
END;
$snip$;

CREATE OR REPLACE FUNCTION public.rechercher_encyclopedie(p_terme text)
 RETURNS TABLE(type text, id uuid, titre text, sous_titre text, categorie text, snippet text, rang real)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_t text;
  v_pat text;
BEGIN
  IF p_terme IS NULL OR length(trim(p_terme)) < 3 THEN
    RETURN;
  END IF;
  v_t := public.f_unaccent(trim(p_terme));
  v_pat := '%' || replace(replace(replace(v_t, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  RETURN QUERY
  ( SELECT 'lore'::text AS type, l.id AS id, l.nom AS titre, l.sous_titre AS sous_titre, l.categorie AS categorie,
      public._snip_contient(g.c, v_t) AS snippet,
      (CASE WHEN public.f_unaccent(l.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real AS rang
    FROM lore l, LATERAL (SELECT coalesce(l.nom,'')||' '||coalesce(l.sous_titre,'')||' '||coalesce(l.description,'') AS c) g
    WHERE l.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL
  ( SELECT 'bestiaire'::text, b.id, b.nom, NULL::text, b.categorie, public._snip_contient(g.c, v_t),
      (CASE WHEN public.f_unaccent(b.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM bestiaire b, LATERAL (SELECT coalesce(b.nom,'')||' '||coalesce(b.categorie,'')||' '||coalesce(b.description,'')||' '||coalesce(b.immunites,'')||' '||coalesce(b.capacites_speciales,'') AS c) g
    WHERE b.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL
  ( SELECT 'religion'::text, r.id, r.nom, r.dirigeant, 'religion'::text, public._snip_contient(g.c, v_t),
      (CASE WHEN public.f_unaccent(r.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM religions r, LATERAL (SELECT coalesce(r.nom,'')||' '||coalesce(r.dirigeant,'')||' '||coalesce(r.fondateur,'')||' '||coalesce(r.description,'')||' '||coalesce(r.lore_fiche,'')||' '||coalesce(r.description_longue,'')||' '||coalesce(r.lore_manuel,'')||' '||coalesce(array_to_string(r.rituels_manuel,' '),'')||' '||coalesce(r.pouvoir_symbole,'') AS c) g
    WHERE r.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL
  ( SELECT 'competence'::text, c.id, c.nom, NULL::text, c.categorie, public._snip_contient(g.c, v_t),
      (CASE WHEN public.f_unaccent(c.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM competences c, LATERAL (SELECT coalesce(c.nom,'')||' '||coalesce(c.categorie,'')||' '||coalesce(c.description,'') AS c) g
    WHERE c.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL
  ( SELECT 'sort'::text, s.id, s.nom, s.cercle, s.type_sort, public._snip_contient(g.c, v_t),
      (CASE WHEN public.f_unaccent(s.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM sorts s, LATERAL (SELECT coalesce(s.nom,'')||' '||coalesce(s.cercle,'')||' '||coalesce(s.type_sort,'')||' '||coalesce(s.description,'') AS c) g
    WHERE s.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL
  ( SELECT 'priere'::text, p.id, p.nom, p.domaine, p.type_priere, public._snip_contient(g.c, v_t),
      (CASE WHEN public.f_unaccent(p.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM prieres p, LATERAL (SELECT coalesce(p.nom,'')||' '||coalesce(p.domaine,'')||' '||coalesce(p.type_priere,'')||' '||coalesce(p.description,'') AS c) g
    WHERE p.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL
  ( SELECT 'regle'::text, sr.id, sr.titre, sr.categorie, 'regle'::text, public._snip_contient(g.c, v_t),
      (CASE WHEN public.f_unaccent(sr.titre) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM sections_regles sr, LATERAL (SELECT coalesce(sr.titre,'')||' '||coalesce(sr.categorie,'')||' '||coalesce(sr.contenu,'') AS c) g
    WHERE sr.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL
  ( SELECT 'race'::text, ra.id, ra.nom, NULL::text, 'race'::text, public._snip_contient(g.c, v_t),
      (CASE WHEN public.f_unaccent(ra.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM races ra, LATERAL (SELECT coalesce(ra.nom,'')||' '||coalesce(ra.description,'')||' '||coalesce(ra.description_courte,'') AS c) g
    WHERE ra.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL
  ( SELECT 'trait_racial'::text, tr.id, tr.nom, NULL::text, 'trait_racial'::text, public._snip_contient(g.c, v_t),
      (CASE WHEN public.f_unaccent(tr.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM traits_raciaux tr, LATERAL (SELECT coalesce(tr.nom,'')||' '||coalesce(tr.description,'') AS c) g
    WHERE tr.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL
  ( SELECT 'classe'::text, cl.id, cl.nom, cl.role_combat, 'classe'::text, public._snip_contient(g.c, v_t),
      (CASE WHEN public.f_unaccent(cl.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM classes cl, LATERAL (SELECT coalesce(cl.nom,'')||' '||coalesce(cl.description,'')||' '||coalesce(cl.role_combat,'') AS c) g
    WHERE cl.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL
  ( SELECT 'forge'::text, f.id, f.nom, f.type, 'forge'::text, public._snip_contient(g.c, v_t),
      (CASE WHEN public.f_unaccent(f.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM objets_forge f, LATERAL (SELECT coalesce(f.nom,'')||' '||coalesce(f.description,'')||' '||coalesce(f.effet,'')||' '||coalesce(f.type,'') AS c) g
    WHERE f.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL
  ( SELECT 'joaillerie'::text, j.id, j.nom, NULL::text, 'joaillerie'::text, public._snip_contient(g.c, v_t),
      (CASE WHEN public.f_unaccent(j.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM objets_joaillerie j, LATERAL (SELECT coalesce(j.nom,'')||' '||coalesce(j.description,'')||' '||coalesce(j.effet,'') AS c) g
    WHERE j.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL
  ( SELECT 'alchimie'::text, al.id, al.nom, al.type, 'alchimie'::text, public._snip_contient(g.c, v_t),
      (CASE WHEN public.f_unaccent(al.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM recettes_alchimie al, LATERAL (SELECT coalesce(al.nom,'')||' '||coalesce(al.description,'')||' '||coalesce(al.effet,'')||' '||coalesce(al.formule,'') AS c) g
    WHERE al.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL
  ( SELECT 'assemblages'::text, asr.id, asr.nom, asr.cible, 'assemblages'::text, public._snip_contient(g.c, v_t),
      (CASE WHEN public.f_unaccent(asr.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM assemblages_runes asr, LATERAL (SELECT coalesce(asr.nom,'')||' '||coalesce(asr.description,'')||' '||coalesce(asr.effet,'')||' '||coalesce(asr.cible,'') AS c) g
    WHERE asr.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL
  ( SELECT d.type, d.id, d.titre, d.sous_titre, d.categorie, d.snippet, d.rang
    FROM (
      SELECT DISTINCT ON (pg.nom)
        'pieges'::text AS type, pg.id AS id, pg.nom AS titre, pg.type_piege AS sous_titre, 'pieges'::text AS categorie,
        public._snip_contient(g.c, v_t) AS snippet,
        (CASE WHEN public.f_unaccent(pg.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real AS rang
      FROM pieges pg, LATERAL (SELECT coalesce(pg.nom,'')||' '||coalesce(pg.effets,'')||' '||coalesce(pg.effet_generique,'')||' '||coalesce(pg.type_piege,'')||' '||coalesce(pg.cible,'') AS c) g
      WHERE pg.est_actif AND public.f_unaccent(g.c) ILIKE v_pat
      ORDER BY pg.nom
    ) d )
  ORDER BY rang DESC, titre
  LIMIT 50;
END;
$function$;
