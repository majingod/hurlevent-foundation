import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useProfil } from "@/contexts/ProfilContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarDays,
  Wallet,
  Bell,
  User,
  Edit2,
  ArrowRight,
  Lock,
  BookOpen,
  ScrollText,
  Users,
  Loader2,
  Compass,
  type LucideIcon,
} from "lucide-react";
import BoutonRemodeler from "@/components/personnage/BoutonRemodeler";
import {
  CarteEvenementJoueur,
  type EvenementPublie,
} from "@/components/evenements/CarteEvenementJoueur";
import { ModalesInscription } from "@/components/evenements/ModalesInscription";
import { useInscriptionEvenements } from "@/hooks/useInscriptionEvenements";
import { useNotifications } from "@/hooks/useNotifications";

/**
 * HubJoueur — « chez-soi » du joueur connecté (Décision UX A, session s337).
 * Rendu par pages/Accueil.tsx quand user && joueurId. Réutilise les briques
 * existantes. Le Tableau de bord reste la page de GESTION complète.
 */

interface PersoHub {
  id: string;
  nom: string | null;
  niveau: number;
  xp_total: number;
  xp_depense: number;
  etape_creation: number;
  est_finalise: boolean;
  race_nom: string;
  classe_nom: string;
  etat: string | null; // 'brouillon' | 'bloque' | 'gele' | 'mort' | null
  created_at: string;
}

/* ── Tuile de statut compacte (cliquable, sans dépliage) ── */
const TuileStatut = ({
  icone: Icone,
  valeur,
  libelle,
  to,
  pastille = false,
}: {
  icone: LucideIcon;
  valeur: string;
  libelle: string;
  to: string;
  pastille?: boolean;
}) => (
  <Link
    to={to}
    className="relative rounded-lg border border-white/10 bg-white/5 p-2.5 text-center transition-colors hover:border-gold/30"
  >
    <Icone className="mx-auto h-4 w-4 text-gold" />
    <p className="mt-1 text-[11px] font-bold leading-tight text-white/90">{valeur}</p>
    <p className="text-[10px] leading-tight text-white/45">{libelle}</p>
    {pastille && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-gold" />}
  </Link>
);

/* ── Carte perso « à la une » ── */
const CartePersoUne = ({ p, autres }: { p: PersoHub; autres: number }) => {
  const xpDispo = p.xp_total - p.xp_depense;
  const bloque = p.etat === "bloque";
  const etape = p.etape_creation ?? 0;
  const etapeCible = etape >= 11 ? 11 : Math.max(1, etape + 1);

  return (
    <Card
      className={`overflow-hidden border-white/10 bg-white/5 ${
        p.est_finalise ? "border-gold/25" : "border-amber-500/30"
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-heading text-2xl leading-tight text-gold">{p.nom}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {p.race_nom} · {p.classe_nom} · Niveau {p.niveau}
            </p>
          </div>
          {bloque ? (
            <span className="rounded-md border border-white/25 bg-white/10 px-2 py-1 text-[11px] font-bold text-white/60">
              Bloqué
            </span>
          ) : p.est_finalise ? (
            <span className="rounded-md border border-green-600/30 bg-green-600/20 px-2 py-1 text-[11px] font-bold text-green-400">
              Finalisé
            </span>
          ) : (
            <span className="rounded-md border border-amber-600/40 bg-amber-600/10 px-2 py-1 text-[11px] font-bold text-amber-400">
              Brouillon
            </span>
          )}
        </div>

        {!p.est_finalise && !bloque && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11.5px] text-muted-foreground">
              <span>Création · étape {Math.min(etape, 11)} / 11</span>
              <span>{Math.round((Math.min(etape, 11) / 11) * 100)} %</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-white/10">
              <div
                className="h-1.5 rounded-full bg-amber-400"
                style={{ width: `${(Math.min(etape, 11) / 11) * 100}%` }}
              />
            </div>
          </div>
        )}

        {p.est_finalise && (
          <div
            className={`mt-3 flex items-center justify-between rounded-lg border px-3 py-2 ${
              xpDispo > 0 ? "border-gold/35 bg-gold/10" : "border-white/10 bg-white/5"
            }`}
          >
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Wallet className={`h-4 w-4 ${xpDispo > 0 ? "text-gold" : "text-muted-foreground"}`} />
              XP disponible
            </span>
            <span className={`font-heading text-lg ${xpDispo > 0 ? "text-gold" : "text-muted-foreground"}`}>
              {xpDispo}
            </span>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {p.est_finalise || bloque ? (
            <Link to={`/personnage/${p.id}`} className="w-full">
              <Button className="w-full bg-gold font-bold text-black hover:bg-gold/80">
                <User className="mr-2 h-4 w-4" />
                Ouvrir ma fiche
                {bloque && <Lock className="ml-2 h-3.5 w-3.5" />}
              </Button>
            </Link>
          ) : (
            <Link to={`/personnage/nouveau?id=${p.id}&etape=${etapeCible}`} className="w-full">
              <Button className="w-full border border-gold/20 bg-gold/10 font-bold text-gold hover:bg-gold/20">
                <Edit2 className="mr-2 h-4 w-4" />
                Reprendre la création
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          )}

          {p.est_finalise && !bloque && <BoutonRemodeler personnageId={p.id} compact />}
        </div>

        {autres > 0 && (
          <Link
            to="/tableau-de-bord"
            className="mt-3 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-gold"
          >
            <Users className="h-3.5 w-3.5" />
            Mes autres personnages ({autres})
          </Link>
        )}
      </CardContent>
    </Card>
  );
};

/* ── Section prochain GN (motif repris de TableauDeBord.SectionProchainEvenement) ── */
const SectionProchainGN = () => {
  const inscription = useInscriptionEvenements();
  const { data: evenements = [], isLoading } = useQuery({
    queryKey: ["evenements-publies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vue_evenements_publies").select("*");
      if (error) throw error;
      return (data ?? []) as EvenementPublie[];
    },
  });

  const prochain = useMemo(() => {
    const now = Date.now();
    return (
      evenements
        .filter((e) => e.date_evenement && new Date(e.date_evenement).getTime() >= now)
        .sort(
          (a, b) => new Date(a.date_evenement!).getTime() - new Date(b.date_evenement!).getTime(),
        )[0] ?? null
    );
  }, [evenements]);

  if (isLoading) {
    return (
      <div className="flex h-24 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!prochain) return null;

  return (
    <div className="space-y-3">
      <h2 className="font-heading text-xl text-gold">Prochain événement</h2>
      <CarteEvenementJoueur
        ev={prochain}
        statut={inscription.statutPour(prochain)}
        onInscrire={inscription.ouvrirInscription}
        onDesinscrire={(e) =>
          inscription.ouvrirDesinscription(e, inscription.enAttenteIdsPour(e))
        }
      />
      <ModalesInscription ctrl={inscription} />
    </div>
  );
};

/* ── Liens rapides ── */
const LienRapide = ({ icone: Icone, label, to }: { icone: LucideIcon; label: string; to: string }) => (
  <Link
    to={to}
    className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground transition-colors hover:border-gold/30 hover:text-gold"
  >
    <Icone className="h-4 w-4 text-gold" />
    {label}
  </Link>
);

/* ── Accueil du nouveau joueur (0 personnage) ── */
const AccueilNouveau = ({ prenom }: { prenom: string }) => (
  <div className="space-y-6">
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-gold/70">Bienvenue</p>
      <h1 className="font-heading text-2xl text-gold">Salut, {prenom}</h1>
    </div>
    <Card className="border-white/10 bg-white/5">
      <CardContent className="space-y-4 p-5 text-center">
        <Compass className="mx-auto h-10 w-10 text-gold" />
        <p className="text-sm text-muted-foreground">
          Trois étapes pour te lancer dans le monde de Destéa :
        </p>
        <div className="space-y-2 text-left text-sm text-muted-foreground">
          <p><span className="font-semibold text-white/80">1.</span> Crée ton personnage (race, classe, compétences).</p>
          <p><span className="font-semibold text-white/80">2.</span> Explore les règles et l'encyclopédie de Destéa.</p>
          <p><span className="font-semibold text-white/80">3.</span> Inscris-toi au prochain GN.</p>
        </div>
        <Link to="/personnage/nouveau" className="block">
          <Button className="w-full bg-gold font-bold text-black hover:bg-gold/80">
            Créer mon personnage
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
    <div className="grid grid-cols-2 gap-2">
      <LienRapide icone={BookOpen} label="Encyclopédie" to="/encyclopedie" />
      <LienRapide icone={ScrollText} label="Règles" to="/regles" />
      <LienRapide icone={CalendarDays} label="Événements" to="/evenements" />
      <LienRapide icone={Users} label="Mon compte" to="/compte" />
    </div>
  </div>
);

/* ── Hub principal ── */
export default function HubJoueur() {
  const { joueurId, profilActif } = useProfil();
  const { nbNonLus } = useNotifications();
  const prenom = profilActif?.nom ?? "aventurier";

  const { data: banque } = useQuery({
    queryKey: ["banque-joueur", joueurId],
    enabled: !!joueurId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vue_banque_joueur")
        .select("solde")
        .eq("joueur_id", joueurId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? { solde: 0 };
    },
  });

  const { data: evenements = [] } = useQuery({
    queryKey: ["evenements-publies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vue_evenements_publies").select("*");
      if (error) throw error;
      return (data ?? []) as EvenementPublie[];
    },
  });
  const prochainDate = useMemo(() => {
    const now = Date.now();
    const p = evenements
      .filter((e) => e.date_evenement && new Date(e.date_evenement).getTime() >= now)
      .sort(
        (a, b) => new Date(a.date_evenement!).getTime() - new Date(b.date_evenement!).getTime(),
      )[0];
    return p?.date_evenement
      ? new Date(p.date_evenement).toLocaleDateString("fr-CA", { day: "numeric", month: "short" })
      : null;
  }, [evenements]);

  const { data: personnages = [], isLoading } = useQuery({
    queryKey: ["mes-personnages", joueurId],
    enabled: !!joueurId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vue_personnages_joueur")
        .select("*")
        .eq("joueur_id", joueurId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PersoHub[];
    },
  });

  // Perso « à la une » : finalisé non-mort d'abord, sinon brouillon, sinon rien.
  const { une, autres } = useMemo(() => {
    const vivants = personnages.filter((p) => p.etat !== "mort");
    const finalises = vivants.filter((p) => p.est_finalise);
    const brouillons = vivants.filter((p) => !p.est_finalise);
    const une = finalises[0] ?? brouillons[0] ?? null;
    return { une, autres: une ? vivants.length - 1 : 0 };
  }, [personnages]);

  const soldeXp = banque?.solde ?? 0;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-2xl animate-fade-in py-6">
      {!une ? (
        <AccueilNouveau prenom={prenom} />
      ) : (
        <div className="space-y-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-gold/70">Ton chez-soi</p>
            <h1 className="font-heading text-2xl text-gold">Salut, {prenom}</h1>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <TuileStatut
              icone={CalendarDays}
              valeur={prochainDate ?? "Aucun"}
              libelle={prochainDate ? "Prochain GN" : "Événement"}
              to="/evenements"
            />
            <TuileStatut
              icone={Wallet}
              valeur={`${soldeXp} XP`}
              libelle="Banque"
              to="/tableau-de-bord"
              pastille={soldeXp > 0}
            />
            <TuileStatut
              icone={Bell}
              valeur={nbNonLus > 0 ? `${nbNonLus}` : "À jour"}
              libelle="Notifs"
              to="/tableau-de-bord"
              pastille={nbNonLus > 0}
            />
          </div>

          <CartePersoUne p={une} autres={autres} />

          <SectionProchainGN />

          <div>
            <div className="grid grid-cols-2 gap-2">
              <LienRapide icone={BookOpen} label="Encyclopédie" to="/encyclopedie" />
              <LienRapide icone={ScrollText} label="Règles" to="/regles" />
              <LienRapide icone={CalendarDays} label="Événements" to="/evenements" />
              <LienRapide icone={Users} label="Tous mes persos" to="/tableau-de-bord" />
            </div>
            <p className="mt-2 text-center text-[11px] text-white/35">
              Gérer tous tes persos, transferts… → Tableau de bord
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
