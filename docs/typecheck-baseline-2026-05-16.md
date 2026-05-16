# Inventaire baseline — erreurs typecheck `artifacts/arlor`

> Capture brute du `pnpm run typecheck` exécuté à la racine du package
> `arlor`. Sert de référence pour suivre la dette technique TypeScript.
> À régénérer après chaque passe de nettoyage.

## Métadonnées

- **Date de capture** : 16 mai 2026
- **Commande** : `pnpm --filter arlor run typecheck`
- **Nombre total d'erreurs `TS`** : 26
- **Référence dette** : nouvel item à ajouter à
  `hurlevent_dette_technique.md` (cf. passation v34).

## Notes

- Aucune de ces erreurs ne bloque le build Vite (plus tolérant que
  `tsc --noEmit`).
- À traiter en passe dédiée : trier par fichier, puis par effort/risque,
  puis fix par lot (PRs courtes).
- Régénérer ce fichier après chaque PR de cleanup pour mesurer le
  progrès (et pour détecter d'éventuelles régressions silencieuses).

## Output complet

```text

> @workspace/arlor@0.0.0 typecheck /home/user/hurlevent-foundation/artifacts/arlor
> tsc -p tsconfig.json --noEmit

src/components/createur/etapes/Etape2_V2.tsx(90,15): error TS2769: No overload matches this call.
  Overload 1 of 2, '(relation: "profiles" | "assemblages_runes" | "competences" | "evenements" | "inscriptions_evenements" | "objets_forge" | "objets_joaillerie" | "personnages" | "prieres" | "recettes_alchimie" | ... 29 more ... | "sections_regles"): PostgrestQueryBuilder<...>', gave the following error.
    Argument of type '"parametres_jeu"' is not assignable to parameter of type '"profiles" | "assemblages_runes" | "competences" | "evenements" | "inscriptions_evenements" | "objets_forge" | "objets_joaillerie" | "personnages" | "prieres" | "recettes_alchimie" | ... 29 more ... | "sections_regles"'.
  Overload 2 of 2, '(relation: "vue_admin_joueurs" | "vue_competences_maitre_attente" | "vue_inscriptions_par_evenement" | "vue_joueurs_complete" | "vue_joueurs_maitres" | "vue_evenements_admin" | ... 24 more ... | "vue_traits_par_race"): PostgrestQueryBuilder<...>', gave the following error.
    Argument of type '"parametres_jeu"' is not assignable to parameter of type '"vue_admin_joueurs" | "vue_competences_maitre_attente" | "vue_inscriptions_par_evenement" | "vue_joueurs_complete" | "vue_joueurs_maitres" | "vue_evenements_admin" | "vue_evenements_publies" | ... 23 more ... | "vue_traits_par_race"'.
src/components/createur/etapes/Etape2_V2.tsx(382,28): error TS2339: Property 'texte_envoi_photos_race' does not exist on type 'SelectQueryError<"column 'lien_facebook' does not exist on 'profiles'."> | SelectQueryError<"column 'lien_facebook' does not exist on 'assemblages_runes'."> | ... 37 more ... | SelectQueryError<...>'.
  Property 'texte_envoi_photos_race' does not exist on type 'SelectQueryError<"column 'lien_facebook' does not exist on 'profiles'.">'.
src/components/createur/etapes/Etape2_V2.tsx(384,31): error TS2339: Property 'texte_envoi_photos_race' does not exist on type 'SelectQueryError<"column 'lien_facebook' does not exist on 'profiles'."> | SelectQueryError<"column 'lien_facebook' does not exist on 'assemblages_runes'."> | ... 37 more ... | SelectQueryError<...>'.
  Property 'texte_envoi_photos_race' does not exist on type 'SelectQueryError<"column 'lien_facebook' does not exist on 'profiles'.">'.
src/components/createur/etapes/Etape2_V2.tsx(387,29): error TS2339: Property 'lien_facebook' does not exist on type 'SelectQueryError<"column 'lien_facebook' does not exist on 'profiles'."> | SelectQueryError<"column 'lien_facebook' does not exist on 'assemblages_runes'."> | ... 37 more ... | SelectQueryError<...>'.
  Property 'lien_facebook' does not exist on type 'SelectQueryError<"column 'lien_facebook' does not exist on 'profiles'.">'.
src/components/createur/etapes/Etape2_V2.tsx(387,58): error TS2339: Property 'lien_discord' does not exist on type 'SelectQueryError<"column 'lien_facebook' does not exist on 'profiles'."> | SelectQueryError<"column 'lien_facebook' does not exist on 'assemblages_runes'."> | ... 37 more ... | SelectQueryError<...>'.
  Property 'lien_discord' does not exist on type 'SelectQueryError<"column 'lien_facebook' does not exist on 'profiles'.">'.
src/components/createur/etapes/Etape2_V2.tsx(389,31): error TS2339: Property 'lien_facebook' does not exist on type 'SelectQueryError<"column 'lien_facebook' does not exist on 'profiles'."> | SelectQueryError<"column 'lien_facebook' does not exist on 'assemblages_runes'."> | ... 37 more ... | SelectQueryError<...>'.
  Property 'lien_facebook' does not exist on type 'SelectQueryError<"column 'lien_facebook' does not exist on 'profiles'.">'.
src/components/createur/etapes/Etape2_V2.tsx(391,40): error TS2339: Property 'lien_facebook' does not exist on type 'SelectQueryError<"column 'lien_facebook' does not exist on 'profiles'."> | SelectQueryError<"column 'lien_facebook' does not exist on 'assemblages_runes'."> | ... 37 more ... | SelectQueryError<...>'.
  Property 'lien_facebook' does not exist on type 'SelectQueryError<"column 'lien_facebook' does not exist on 'profiles'.">'.
src/components/createur/etapes/Etape2_V2.tsx(399,31): error TS2339: Property 'lien_discord' does not exist on type 'SelectQueryError<"column 'lien_facebook' does not exist on 'profiles'."> | SelectQueryError<"column 'lien_facebook' does not exist on 'assemblages_runes'."> | ... 37 more ... | SelectQueryError<...>'.
  Property 'lien_discord' does not exist on type 'SelectQueryError<"column 'lien_facebook' does not exist on 'profiles'.">'.
src/components/createur/etapes/Etape2_V2.tsx(401,40): error TS2339: Property 'lien_discord' does not exist on type 'SelectQueryError<"column 'lien_facebook' does not exist on 'profiles'."> | SelectQueryError<"column 'lien_facebook' does not exist on 'assemblages_runes'."> | ... 37 more ... | SelectQueryError<...>'.
  Property 'lien_discord' does not exist on type 'SelectQueryError<"column 'lien_facebook' does not exist on 'profiles'.">'.
src/components/createur/etapes/Etape5_Competences_V2.tsx(308,9): error TS2345: Argument of type '"verifier_prerequis_competences"' is not assignable to parameter of type '"acheter_assemblage" | "acheter_competence" | "acheter_objet_forge" | "acheter_objet_joaillerie" | "acheter_priere" | "acheter_recette" | "acheter_sort" | "acheter_trait_racial" | ... 45 more ... | "verrouiller_personnage"'.
src/components/createur/etapes/Etape5_Competences_V2.tsx(312,14): error TS2352: Conversion of type 'boolean' to type 'Record<string, { niveau_max_achetable: number; raisons_par_niveau: Record<string, string>; }>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
src/components/createur/etapes/Etape5_Competences_V2.tsx(537,7): error TS2322: Type '{ value: string; label: string | null; }[]' is not assignable to type 'DropdownOption[]'.
  Type '{ value: string; label: string | null; }' is not assignable to type 'DropdownOption'.
    Types of property 'label' are incompatible.
      Type 'string | null' is not assignable to type 'string'.
        Type 'null' is not assignable to type 'string'.
src/components/createur/etapes/Etape5_Competences_V2.tsx(639,7): error TS2322: Type '{ value: string | null; label: string | null; }[]' is not assignable to type 'DropdownOption[]'.
  Type '{ value: string | null; label: string | null; }' is not assignable to type 'DropdownOption'.
    Types of property 'value' are incompatible.
      Type 'string | null' is not assignable to type 'string'.
        Type 'null' is not assignable to type 'string'.
src/components/createur/etapes/Etape5_Competences_V2.tsx(640,46): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
  Type 'null' is not assignable to type 'string'.
src/components/createur/etapes/Etape5_Competences_V2.tsx(684,50): error TS2345: Argument of type '"desacheter_competence"' is not assignable to parameter of type '"acheter_assemblage" | "acheter_competence" | "acheter_objet_forge" | "acheter_objet_joaillerie" | "acheter_priere" | "acheter_recette" | "acheter_sort" | "acheter_trait_racial" | ... 45 more ... | "verrouiller_personnage"'.
src/components/createur/etapes/Etape5_Competences_V2.tsx(715,50): error TS2345: Argument of type '"avancer_etape"' is not assignable to parameter of type '"acheter_assemblage" | "acheter_competence" | "acheter_objet_forge" | "acheter_objet_joaillerie" | "acheter_priere" | "acheter_recette" | "acheter_sort" | "acheter_trait_racial" | ... 45 more ... | "verrouiller_personnage"'.
src/components/createur/etapes/Etape5_Competences_V2.tsx(720,23): error TS2352: Conversion of type 'boolean' to type 'Record<string, any>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
src/components/createur/etapes/Etape5_Competences_V2.tsx(1563,15): error TS2503: Cannot find namespace 'JSX'.
src/components/createur/etapes/Etape6_Sorts_V2.tsx(232,50): error TS2345: Argument of type '"avancer_etape"' is not assignable to parameter of type '"acheter_assemblage" | "acheter_competence" | "acheter_objet_forge" | "acheter_objet_joaillerie" | "acheter_priere" | "acheter_recette" | "acheter_sort" | "acheter_trait_racial" | ... 45 more ... | "verrouiller_personnage"'.
src/components/createur/etapes/Etape6_Sorts_V2.tsx(237,23): error TS2352: Conversion of type 'boolean' to type 'Record<string, any>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
src/components/createur/etapes/Etape7_Prieres_V2.tsx(306,50): error TS2345: Argument of type '"avancer_etape"' is not assignable to parameter of type '"acheter_assemblage" | "acheter_competence" | "acheter_objet_forge" | "acheter_objet_joaillerie" | "acheter_priere" | "acheter_recette" | "acheter_sort" | "acheter_trait_racial" | ... 45 more ... | "verrouiller_personnage"'.
src/components/createur/etapes/Etape7_Prieres_V2.tsx(311,23): error TS2352: Conversion of type 'boolean' to type 'Record<string, any>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
src/components/createur/etapes/Etape8_Artisanat_V2.tsx(208,50): error TS2345: Argument of type '"avancer_etape"' is not assignable to parameter of type '"acheter_assemblage" | "acheter_competence" | "acheter_objet_forge" | "acheter_objet_joaillerie" | "acheter_priere" | "acheter_recette" | "acheter_sort" | "acheter_trait_racial" | ... 45 more ... | "verrouiller_personnage"'.
src/components/createur/etapes/Etape8_Artisanat_V2.tsx(213,23): error TS2352: Conversion of type 'boolean' to type 'Record<string, any>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
src/components/createur/etapes/Etape9_Assemblages_V2.tsx(146,50): error TS2345: Argument of type '"avancer_etape"' is not assignable to parameter of type '"acheter_assemblage" | "acheter_competence" | "acheter_objet_forge" | "acheter_objet_joaillerie" | "acheter_priere" | "acheter_recette" | "acheter_sort" | "acheter_trait_racial" | ... 45 more ... | "verrouiller_personnage"'.
src/components/createur/etapes/Etape9_Assemblages_V2.tsx(151,23): error TS2352: Conversion of type 'boolean' to type 'Record<string, any>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
/home/user/hurlevent-foundation/artifacts/arlor:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @workspace/arlor@0.0.0 typecheck: `tsc -p tsconfig.json --noEmit`
Exit status 2
```
