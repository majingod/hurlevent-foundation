import { useMemo, type Dispatch, type SetStateAction } from "react";

import { raceInapteMagie } from "@/moteurCreation/deriveurs";
import type { Catalogues } from "@/moteurCreation/generateur/composer";
import type { RoleClasse } from "@/moteurCreation/generateur/contenu/commun";
import {
  classesProposables,
  religionsProposables,
  rolesProposables,
  type ChoixJoueur,
  type DepsResolveur,
} from "@/moteurCreation/generateur/resoudre";
import type { ContexteComposition } from "@/moteurCreation/generateur/types";

import {
  EMOJIS_CLASSES,
  PARCOURS_VIDE,
  avertissementElement,
  construireChoix,
  etiquetteSecond,
  pretPourFiche,
  resumeFois,
  roleAttendElement,
  roleElementOptionnel,
  roleEstCaster,
  type ParcoursBoussole,
} from "./boussole.logic";
import { LABELS_CLASSES } from "./ficheTirage.logic";

/**
 * [VIS-8 lot 🧭 PR-β2, s367] L'escalier « Je choisis mes grandes lignes » —
 * maquette validée Fred s366, arbitrages s367 appliqués :
 *
 * - ORDRE α (décision 36) : voie → rôle → cercle/domaine → foi, le même que
 *   🎲 — jamais de cul-de-sac au barreau suivant. (La race vit dans son
 *   écran de constat existant, EN AMONT de cet escalier : son rattrapage
 *   d'équipement et ses avertissements d'approbation y restent entiers.)
 * - GRISER, JAMAIS CACHER (décision 6) : voie fermée, rôle fermé, foi
 *   proscrite — tout reste visible, 🔒, avec SA phrase. Les phrases viennent
 *   du MOTEUR (`classesProposables`, `rolesProposables`,
 *   `religionsProposables`) : cet écran n'en rédige aucune.
 * - CATALOGUE COMPLET (référence §5.1 ② / §5.2 ②) : Nécromancie et Magie
 *   Noire sont proposables ICI et nulle part ailleurs, chacune avec son
 *   avertissement — deux motifs distincts (loi du monde / affaire de foi).
 * - ARBITRAGE FRED s367 : les 15 foi, triées prédilection → tolérée →
 *   proscrite ; l'inaptitude ferme au MODÈLE (une race qui PEUT être inapte
 *   voit ses voies à PS grisées — divergence délibérée documentée).
 *
 * Écran de LECTURE pure : l'unique sortie est `onVoirFiche(choix)` — le
 * conteneur appelle le résolveur et navigue. Le refus parlant du moteur
 * revient par la prop `refus` et s'affiche près du bouton, jamais avalé.
 */

type ClasseId = ContexteComposition["classe"];

interface EcranBoussoleProps {
  deps: DepsResolveur;
  raceId: string;
  inventaire: ReadonlySet<string>;
  /** [s368 #2] Le parcours vit dans le CONTENEUR, pas ici — « ← Ajuster »
   *  démonte cet écran, et l'état doit lui survivre (même maison que
   *  l'inventaire et la race). Écran contrôlé, zéro état propre. */
  parcours: ParcoursBoussole;
  onParcours: Dispatch<SetStateAction<ParcoursBoussole>>;
  onVoirFiche: (choix: ChoixJoueur) => void;
  /** Raccourci de la maquette : « 🎲 Surprends-moi plutôt ». */
  onSurprendsMoi: () => void;
  /** Refus parlant du dernier essai (`resoudreChoix`), affiché tel quel. */
  refus?: string | null;
}

/* ------------------------------------------------------------------ */
/* Briques visuelles (palette du conteneur / EcranRace)               */
/* ------------------------------------------------------------------ */

const Carte = ({
  actif,
  grise,
  lisere,
  onClick,
  children,
}: {
  actif?: boolean;
  grise?: boolean;
  lisere?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    disabled={grise}
    onClick={grise ? undefined : onClick}
    className={`w-full rounded-xl border bg-card p-3 text-left transition-all ${
      actif ? "border-gold shadow-[0_0_0_1px_theme(colors.gold)]" : "border-white/10"
    } ${grise ? "cursor-not-allowed opacity-40" : "hover:border-gold/40"} ${
      lisere ? "border-l-2 border-l-bordeaux" : ""
    }`}
  >
    {children}
  </button>
);

const Puce = ({ children, or }: { children: React.ReactNode; or?: boolean }) => (
  <span
    className={`rounded-full px-2 py-0.5 text-[11px] ${
      or ? "bg-gold font-semibold text-black" : "bg-white/5 text-white/50"
    }`}
  >
    {children}
  </span>
);

/** Un barreau de l'escalier : pastille sur le fil d'or, contenu à droite,
 *  une seule étape ouverte à la fois — revenir = taper plus haut. */
const Etape = ({
  n,
  titre,
  faite,
  ouverte,
  children,
}: {
  n: number;
  titre: string;
  faite: boolean;
  ouverte: boolean;
  children: React.ReactNode;
}) => (
  <div className="relative pl-9">
    <div
      className={`absolute bottom-0 top-0 w-px ${faite ? "bg-gold" : "bg-white/15"}`}
      style={{ left: 13 }}
    />
    <div
      className={`absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full border text-[12px] font-semibold ${
        faite
          ? "border-gold bg-gold text-black"
          : "border-white/15 bg-transparent text-white/40"
      }`}
    >
      {faite ? "✓" : n}
    </div>
    <div className="pb-6">
      <div
        className={`mb-2 pt-1 font-heading text-[15px] font-semibold tracking-wide ${
          ouverte || faite ? "text-gold-accent" : "text-white/40"
        }`}
      >
        {titre}
      </div>
      {ouverte ? children : null}
    </div>
  </div>
);

/* ------------------------------------------------------------------ */

const EcranBoussole = ({
  deps,
  raceId,
  inventaire,
  parcours: p,
  onParcours: setP,
  onVoirFiche,
  onSurprendsMoi,
  refus,
}: EcranBoussoleProps) => {

  const race = deps.monde.races.find((r) => r.id === raceId);
  /** Modèle, pas instance (arbitrage s367) — le MÊME dériveur que le moteur. */
  const inapte = useMemo(
    () =>
      raceInapteMagie(
        {
          tables: {
            race_traits: deps.monde.race_traits,
            traits_raciaux: deps.monde.traits_raciaux,
          },
        },
        raceId
      ),
    [deps, raceId]
  );

  const voies = useMemo(
    () => classesProposables(deps, raceId, inventaire),
    [deps, raceId, inventaire]
  );
  const classeCourante = p.classe ? deps.parClasse[p.classe] : null;
  const roles = useMemo(
    () =>
      classeCourante
        ? rolesProposables(
            classeCourante.contenu,
            classeCourante.cats,
            inventaire,
            inapte
          )
        : [],
    [classeCourante, inventaire, inapte]
  );

  const role: RoleClasse | null =
    (classeCourante &&
      classeCourante.contenu.roles.find((r) => r.id === p.roleId)) ||
    null;
  const attendElement =
    !!role &&
    !!classeCourante &&
    roleAttendElement(classeCourante.contenu, classeCourante.cats, role, inventaire);
  // ⭐ [D40 s372] Troisième état : l'élément est OPTIONNEL (✝️). L'étape
  // s'affiche, ne bloque jamais, et « Sans domaine » est un état légitime.
  const elementOptionnel =
    !!role &&
    !!classeCourante &&
    roleElementOptionnel(
      classeCourante.contenu,
      classeCourante.cats,
      role,
      inventaire
    );
  const caster =
    !!role &&
    !!classeCourante &&
    roleEstCaster(classeCourante.contenu, classeCourante.cats, role, inventaire);
  const genre: "cercle" | "domaine" = p.classe === "pretre" ? "domaine" : "cercle";
  const elementEffectif = role?.magieImposee ?? p.element;

  /** Catalogue COMPLET — jamais une liste en dur (dérivé des modèles).
   *  ⭐ [D40] Le suggéré du CONTENU (`magieSuggeree`) passe en tête ; le
   *  reste garde l'ordre du catalogue. */
  const catalogueComplet: string[] = useMemo(() => {
    if (!classeCourante) return [];
    const m = classeCourante.cats.magie;
    const tous = genre === "domaine" ? m.domaines() : m.cercles();
    const sug = role?.magieSuggeree;
    return sug && tous.includes(sug)
      ? [sug, ...tous.filter((n) => n !== sug)]
      : tous;
  }, [classeCourante, genre, role]);

  const fois = useMemo(
    () =>
      p.classe === "pretre" && (elementEffectif || elementOptionnel)
        ? religionsProposables(
            deps.monde,
            elementEffectif ?? undefined,
            p.second ? (p.element2 ?? undefined) : undefined
          )
        : [],
    [deps, p.classe, elementEffectif, elementOptionnel, p.second, p.element2]
  );

  const etapeElementFaite = !attendElement || !!p.element;
  const etapeFoiAttendue = p.classe === "pretre";
  const pret = pretPourFiche(
    p,
    classeCourante?.contenu ?? null,
    classeCourante?.cats ?? null,
    inventaire
  );

  const numeroElement = 3;
  const numeroFoi = caster ? 4 : 3;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h2 className="font-heading text-2xl text-gold">
        🧭 Je choisis mes grandes lignes
      </h2>
      <p className="mt-1 text-[13px] text-white/50">
        {race ? `${race.nom} · ${race.xp_depart} XP. ` : ""}
        3 à 5 questions — le générateur bâtit le reste, tu ajustes au créateur.
      </p>

      <div className="mt-5">
        {/* 1 · VOIE */}
        <Etape
          n={1}
          titre="Ta voie"
          faite={!!p.classe}
          ouverte
        >
          <div className="grid grid-cols-2 gap-2">
            {voies.map((v) => (
              <Carte
                key={v.classe}
                actif={p.classe === v.classe}
                grise={!v.ouverte}
                onClick={() => setP({ ...PARCOURS_VIDE, classe: v.classe })}
              >
                <span className="text-lg">{EMOJIS_CLASSES[v.classe]}</span>{" "}
                <span className="font-heading text-gold-accent">
                  {!v.ouverte && "🔒 "}
                  {LABELS_CLASSES[v.classe]}
                </span>
                {!v.ouverte && v.raison && (
                  <div className="mt-1 text-[11px] text-white/50">{v.raison}</div>
                )}
              </Carte>
            ))}
          </div>
        </Etape>

        {/* 2 · RÔLE */}
        <Etape
          n={2}
          titre="Ton rôle"
          faite={!!p.roleId}
          ouverte={!!p.classe}
        >
          <div className="flex flex-col gap-2">
            {roles.map((r) => (
              <Carte
                key={r.role.id}
                actif={p.roleId === r.role.id}
                grise={!r.ouvert}
                onClick={() =>
                  setP((q) => ({
                    ...q,
                    roleId: r.role.id,
                    element: null,
                    second: false,
                    element2: null,
                    religionId: null,
                  }))
                }
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-xl">{r.role.emoji}</span>
                  <span className="font-heading text-gold-accent">
                    {!r.ouvert && "🔒 "}
                    {r.role.titre}
                  </span>
                  {r.role.magieImposee && (
                    <Puce>domaine imposé : {r.role.magieImposee}</Puce>
                  )}
                </div>
                <div className="mt-1 text-[12px] text-white/50">
                  {r.ouvert ? r.role.phrase : r.raison}
                </div>
              </Carte>
            ))}
          </div>
        </Etape>

        {/* 3 · CERCLE / DOMAINE (casters — exigé, imposé ou optionnel D40) */}
        {caster && (
          <Etape
            n={numeroElement}
            titre={
              role?.magieImposee
                ? `Ton domaine — ${role.magieImposee} (imposé par le rôle)`
                : elementOptionnel
                  ? `Ton ${genre} — optionnel`
                  : `Ton ${genre}`
            }
            faite={etapeElementFaite && (!p.second || !!p.element2)}
            ouverte={!!p.roleId}
          >
            {(attendElement || elementOptionnel) && (
              <>
                {elementOptionnel && inapte && (
                  <div className="mb-2 text-[11px] text-white/50">
                    {race?.nom ?? "Ton peuple"} peut naître inapte à la magie —
                    sans domaine, le soigneur reste jouable.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {elementOptionnel && (
                    <Carte
                      actif={p.element === null}
                      onClick={() =>
                        setP((q) => ({
                          ...q,
                          element: null,
                          second: false,
                          element2: null,
                        }))
                      }
                    >
                      <span className="font-heading text-[14px] text-gold-accent">
                        Sans domaine
                      </span>
                      <div className="mt-1 text-[11px] text-white/50">
                        Soigneur non magique — tes soins marchent au temps, pas
                        aux points de spiritualité.
                      </div>
                    </Carte>
                  )}
                  {catalogueComplet.map((nom) => {
                    const avert = avertissementElement(genre, nom, deps.monde);
                    return (
                      <Carte
                        key={nom}
                        actif={p.element === nom}
                        grise={elementOptionnel && inapte}
                        lisere={!!avert}
                        onClick={() =>
                          setP((q) => ({ ...q, element: nom, element2: null, religionId: null }))
                        }
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-heading text-[14px] text-gold-accent">
                            {nom}
                          </span>
                          {role?.magieSuggeree === nom && <Puce or>suggéré</Puce>}
                        </div>
                        {avert && (
                          <div className="mt-1 text-[11px] text-bordeaux brightness-150">
                            {avert}
                          </div>
                        )}
                      </Carte>
                    );
                  })}
                </div>
              </>
            )}

            {/* + SECOND — offert à TOUS les casters (politique 🧭, s361).
                [D40] Pour l'optionnel : seulement quand l'élément est posé. */}
            {(!elementOptionnel || !!elementEffectif) && (
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-card p-3">
              <input
                type="checkbox"
                checked={p.second}
                onChange={(e) =>
                  setP((q) => ({
                    ...q,
                    second: e.target.checked,
                    element2: e.target.checked ? q.element2 : null,
                    religionId: null,
                  }))
                }
                className="mt-0.5"
              />
              <span className="text-[13px] text-white/80">
                <b className="text-gold-accent">Un second {genre} ?</b>{" "}
                <span className="text-white/50">{etiquetteSecond(genre)}</span>
              </span>
            </label>
            )}
            {p.second && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {catalogueComplet
                  .filter((nom) => nom !== elementEffectif)
                  .map((nom) => {
                    const avert = avertissementElement(genre, nom, deps.monde);
                    return (
                      <Carte
                        key={nom}
                        actif={p.element2 === nom}
                        lisere={!!avert}
                        onClick={() =>
                          setP((q) => ({ ...q, element2: nom, religionId: null }))
                        }
                      >
                        <span className="text-[13px] text-gold-accent">{nom}</span>
                        {avert && (
                          <div className="mt-1 text-[11px] text-bordeaux brightness-150">
                            {avert}
                          </div>
                        )}
                      </Carte>
                    );
                  })}
              </div>
            )}
          </Etape>
        )}

        {/* 4 · FOI (prêtre) — les 15, refus grisés avec leur phrase. */}
        {etapeFoiAttendue && (
          <Etape
            n={numeroFoi}
            titre="Ta foi"
            faite={!!p.religionId}
            ouverte={
              !!p.roleId &&
              (!!elementEffectif || elementOptionnel) &&
              (!p.second || !!p.element2)
            }
          >
            <div className="mb-2 text-[11px] text-white/40">
              {elementEffectif
                ? resumeFois(fois, elementEffectif, p.second ? p.element2 : null)
                : "Sans domaine, aucune foi ne te refuse — les 15 t'accueillent."}
            </div>
            <div className="flex flex-col gap-2">
              {fois.map((f) => (
                <Carte
                  key={f.religion.id}
                  actif={p.religionId === f.religion.id}
                  grise={f.statut === "proscrite"}
                  onClick={() =>
                    setP((q) => ({ ...q, religionId: f.religion.id }))
                  }
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-heading text-[14px] text-gold-accent">
                      {f.statut === "proscrite" && "🔒 "}
                      {f.religion.nom}
                    </span>
                    {f.statut === "predilection" && <Puce or>prédilection</Puce>}
                  </div>
                  {f.raison && (
                    <div className="mt-1 text-[11px] text-white/50">{f.raison}</div>
                  )}
                </Carte>
              ))}
            </div>
          </Etape>
        )}
      </div>

      {/* Refus parlant du moteur — jamais avalé. */}
      {refus && (
        <div className="mb-3 rounded-lg border border-white/10 border-l-2 border-l-bordeaux bg-white/5 px-3.5 py-3 text-sm text-white/80">
          ⚠️ {refus}
        </div>
      )}

      <div className="mt-2 flex gap-2.5">
        <button
          type="button"
          disabled={!pret}
          onClick={() => onVoirFiche(construireChoix(p, raceId, inventaire))}
          className={`flex-1 rounded-lg bg-gold px-4 py-3 text-[15px] font-semibold text-black transition-opacity ${
            pret ? "hover:bg-gold-accent" : "cursor-not-allowed opacity-35"
          }`}
        >
          Voir ma fiche →
        </button>
        <button
          type="button"
          onClick={onSurprendsMoi}
          className="rounded-lg border border-white/15 px-4 py-3 text-[13px] text-white/50 transition-colors hover:border-gold/40"
        >
          🎲 Surprends-moi plutôt
        </button>
      </div>
    </div>
  );
};

export default EcranBoussole;
