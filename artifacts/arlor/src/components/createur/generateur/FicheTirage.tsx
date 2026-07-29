import { useState } from "react";

import type { TiragePersonnage } from "@/moteurCreation/generateur/resoudre";
import type {
  AchatMagiePlanifie,
  CompositionOk,
} from "@/moteurCreation/generateur/types";

import {
  LABELS_CLASSES,
  NOMS_COUCHES,
  TEXTE_SAC_VIDE,
  coutCouche,
  grouperAchats,
  magieDeCouche,
  metaRole,
  texteTraitsIncompatibles,
  type GroupeAchat,
} from "./ficheTirage.logic";

/**
 * [VIS-8 lot 🎲, s364] LA FICHE DU TIRAGE — maquette validée par Fred
 * (maquette_fiche_tirage_s364.jsx), branchée sur la vraie sortie du
 * résolveur. Fiche PAR COUCHES, chaque ligne EXPLICABLE (décision 10) :
 * taper une ligne déplie son « pourquoi ».
 *
 * - religion / 2ᵉ cercle-domaine / traits incompatibles : les 3 sorties
 *   neuves du résolveur (s362) sont affichées ici ;
 * - indice « sac vide » : cas de PREMIER ORDRE (décision 31), le levier
 *   (🎒 puis Relancer) est nommé au lieu d'un re-roll monotone ;
 * - 🧭 réutilise la fiche TELLE QUELLE (décision 33) : `onAjuster` remplace
 *   alors « Relancer » — revenir à l'escalier sans rien perdre ;
 * - « Continuer dans le créateur → » n'est rendu que si `onContinuer`
 *   est fourni (PR-B, `appliquerComposition`) : jamais de bouton mort.
 */

interface FicheTirageProps {
  tirage: TiragePersonnage;
  composition: CompositionOk;
  /** Taille de l'inventaire coché — 0 déclenche l'indice « sac vide ». */
  nbInventaire: number;
  /** 🎲 : re-tirer. Absent en 🧭 (un re-roll jetterait les choix). */
  onRelancer?: () => void;
  /** 🧭 (PR-β2) : revenir à l'escalier, choix conservés. */
  onAjuster?: () => void;
  /** PR-B (appliquerComposition). Absent = bouton non rendu. */
  onContinuer?: () => void;
}

const COUCHES: readonly (2 | 3 | 4)[] = [2, 3, 4];

const LigneCompetence = ({
  groupe,
  ouverte,
  onBasculer,
}: {
  groupe: GroupeAchat;
  ouverte: boolean;
  onBasculer: () => void;
}) => (
  <li>
    <button
      type="button"
      onClick={onBasculer}
      className="flex w-full items-baseline justify-between gap-3 border-b border-white/10 px-0.5 py-2 text-left text-sm text-white/90 transition-colors hover:text-gold-accent"
    >
      <span>
        {groupe.nom}
        {groupe.niveau > 1 && (
          <span className="text-white/50"> · niveau {groupe.niveau}</span>
        )}
        {groupe.n > 1 && (
          <span className="text-gold-accent"> ×{groupe.n}</span>
        )}
        {groupe.choixTires.length > 0 && (
          <span className="text-gold-accent">
            {" "}
            ({groupe.choixTires.join(", ")})
          </span>
        )}
      </span>
      <b className="whitespace-nowrap">
        {groupe.coutTotal === 0 ? "incluse" : `${groupe.coutTotal} XP`}
      </b>
    </button>
    {ouverte && (
      <div className="border-b border-white/10 px-0.5 py-1.5 text-xs italic text-white/50">
        pourquoi : {groupe.motif}
      </div>
    )}
  </li>
);

const LigneMagie = ({
  magie,
  ouverte,
  onBasculer,
}: {
  magie: AchatMagiePlanifie;
  ouverte: boolean;
  onBasculer: () => void;
}) => (
  <li>
    <button
      type="button"
      onClick={onBasculer}
      className="flex w-full items-baseline justify-between gap-3 border-b border-white/10 px-0.5 py-2 text-left text-sm text-white/90 transition-colors hover:text-gold-accent"
    >
      <span>
        <span className="rounded border border-white/15 px-1.5 py-px text-[10px] uppercase tracking-wider text-white/50">
          {magie.type === "sort" ? "sort" : "prière"}
        </span>{" "}
        {magie.nom}
        <span className="text-white/50">
          {" "}
          · {magie.config.zone} · {magie.config.portee} · {magie.config.duree}
        </span>
      </span>
      <b className="whitespace-nowrap">
        {magie.coutXp} XP{" "}
        <span className="font-normal text-white/50">· {magie.coutPS} PS</span>
      </b>
    </button>
    {ouverte && (
      <div className="border-b border-white/10 px-0.5 py-1.5 text-xs italic text-white/50">
        pourquoi : {magie.motif}
        {magie.surclasse && (
          <> — surclassée depuis le niveau {magie.surclasse.deNiveau}</>
        )}
      </div>
    )}
  </li>
);

const FicheTirage = ({
  tirage,
  composition,
  nbInventaire,
  onRelancer,
  onAjuster,
  onContinuer,
}: FicheTirageProps) => {
  const [ouverts, setOuverts] = useState<ReadonlySet<string>>(new Set());
  const basculer = (cle: string) =>
    setOuverts((prec) => {
      const n = new Set(prec);
      if (n.has(cle)) n.delete(cle);
      else n.add(cle);
      return n;
    });

  const role = metaRole(tirage.classe, tirage.roleId);
  const noteTraits = texteTraitsIncompatibles(tirage.traitsIncompatibles);
  const libelleMagie = tirage.classe === "pretre" ? "Domaine" : "Cercle";

  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      {nbInventaire === 0 && (
        <div className="mb-3.5 rounded-lg border border-white/10 border-l-2 border-l-gold-accent bg-white/5 px-3 py-2.5 text-[13px] text-white/80">
          🎒 {TEXTE_SAC_VIDE}
        </div>
      )}

      {/* Carte identité */}
      <div className="mb-3.5 rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="text-2xl leading-none">{role.emoji}</div>
        <h2 className="mt-1.5 font-heading text-xl text-gold">{role.titre}</h2>
        {role.phrase && (
          <p className="mb-2.5 mt-0.5 text-[13px] italic text-white/50">
            « {role.phrase} »
          </p>
        )}
        <div className="text-sm text-white/90">
          <b>{tirage.raceNom}</b> · {LABELS_CLASSES[tirage.classe]} ·{" "}
          <b className="text-gold-accent">{tirage.budget} XP</b>
        </div>
        {tirage.element && (
          <div className="mt-1 text-[13px] text-white/90">
            {tirage.classe === "pretre" ? "🙏" : "✨"} {libelleMagie}
            {tirage.element2 ? "s" : ""} :{" "}
            <b>
              {tirage.element}
              {tirage.element2 ? ` + ${tirage.element2}` : ""}
            </b>
          </div>
        )}
        {tirage.religionNom && (
          <div className="mt-1 text-[13px] text-white/90">
            ⛪ Religion : <b>{tirage.religionNom}</b>{" "}
            <span className="text-xs text-white/50">
              — appariée à tes domaines
            </span>
          </div>
        )}
      </div>

      {/* ① Offertes avec la classe */}
      <section className="mb-3 rounded-lg border border-white/10 bg-white/5 p-3.5">
        <header className="flex items-baseline justify-between">
          <h3 className="text-[11px] uppercase tracking-widest text-white/40">
            ① Offertes avec ta classe
          </h3>
          <span className="text-[13px] font-semibold text-gold-accent">
            0 XP
          </span>
        </header>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {composition.gratuites.map((g) => (
            <span
              key={g.competenceId + g.nom}
              className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-white/80"
            >
              {g.nom}
            </span>
          ))}
        </div>
      </section>

      {/* ② ③ ④ */}
      {COUCHES.map((couche) => {
        const groupes = grouperAchats(
          composition.achats.filter((a) => a.couche === couche)
        );
        const magies = magieDeCouche(composition, couche);
        if (groupes.length === 0 && magies.length === 0) return null;
        return (
          <section
            key={couche}
            className="mb-3 rounded-lg border border-white/10 bg-white/5 p-3.5"
          >
            <header className="flex items-baseline justify-between">
              <h3 className="text-[11px] uppercase tracking-widest text-white/40">
                {NOMS_COUCHES[couche]}
              </h3>
              <span className="text-[13px] font-semibold text-gold-accent">
                {coutCouche(composition, couche)} XP
              </span>
            </header>
            <ul className="mt-1">
              {groupes.map((g, i) => {
                const cle = `a${couche}-${i}`;
                return (
                  <LigneCompetence
                    key={cle}
                    groupe={g}
                    ouverte={ouverts.has(cle)}
                    onBasculer={() => basculer(cle)}
                  />
                );
              })}
              {magies.map((m, i) => {
                const cle = `m${couche}-${i}`;
                return (
                  <LigneMagie
                    key={cle}
                    magie={m}
                    ouverte={ouverts.has(cle)}
                    onBasculer={() => basculer(cle)}
                  />
                );
              })}
            </ul>
          </section>
        );
      })}

      {/* Total */}
      <div className="mb-3 flex items-baseline justify-between rounded-lg border border-white/10 bg-white/5 px-3.5 py-3 text-sm">
        <span className="text-white/80">Total dépensé</span>
        <b className="text-gold-accent">
          {composition.totalDepense} / {composition.budget} XP
        </b>
      </div>

      {composition.alertes.map((alerte) => (
        <div
          key={alerte}
          className="mb-2.5 rounded-lg border border-white/10 border-l-2 border-l-bordeaux bg-white/5 px-3 py-2.5 text-[13px] text-white/80"
        >
          ⚠️ {alerte}
        </div>
      ))}

      {noteTraits && (
        <div className="mb-2.5 rounded-lg border border-white/10 border-l-2 border-l-gold-accent bg-white/5 px-3 py-2.5 text-[13px] text-white/80">
          🧬 {noteTraits}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-col gap-2.5">
        {onRelancer && (
          <button
            type="button"
            onClick={onRelancer}
            className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/90 transition-colors hover:border-gold/40"
          >
            🎲 Relancer
          </button>
        )}
        {onAjuster && (
          <button
            type="button"
            onClick={onAjuster}
            className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/90 transition-colors hover:border-gold/40"
          >
            ← Ajuster mes choix
          </button>
        )}
        {onContinuer && (
          <button
            type="button"
            onClick={onContinuer}
            className="rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-gold-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-accent"
          >
            Continuer dans le créateur →
          </button>
        )}
      </div>
    </div>
  );
};

export default FicheTirage;
