import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, MapPin, Users, Swords, Shield, Sparkles, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ---------- types ---------- */
interface ProchainEvenement {
  id: string | null;
  titre: string | null;
  date_evenement: string | null;
  date_fin: string | null;
  lieu: string | null;
  type_evenement: string | null;
  xp_recompense: number | null;
  nb_inscrits: number | null;
  places_restantes: number | null;
  description: string | null;
}

interface Race {
  id: string;
  nom: string | null;
  nom_latin: string | null;
  esperance_vie: string | null;
  xp_depart: number;
  description: string | null;
}

interface Classe {
  id: string;
  nom: string | null;
  description: string | null;
  pv_depart: number | null;
  ps_depart: number | null;
}

interface Personnage {
  id: string;
  nom: string | null;
}

/* ---------- helpers ---------- */
const formatDate = (d: string | null) => {
  if (!d) return "";
  return new Date(d).toLocaleDateString("fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const typeLabel = (t: string | null) => {
  switch (t) {
    case "mini_gn": return "Mini GN";
    case "gn_regulier": return "GN Régulier";
    case "entretien_terrain": return "Entretien du Terrain";
    default: return t ?? "";
  }
};

/* ---------- feature cards ---------- */
const featureCards = [
  { emoji: "👥", title: "Races jouables", desc: "Découvrez les races de Destéa, leurs traits uniques, leur espérance de vie et leurs XP de départ.", tab: "races" },
  { emoji: "✦", title: "Traits raciaux", desc: "Chaque race possède des traits uniques achetables avec vos XP pour personnaliser votre personnage.", tab: "traits-raciaux" },
  { emoji: "⚔️", title: "Classes de combat", desc: "Guerrier, Voleur, Mage ou Prêtre — choisissez votre voie et vos compétences de classe.", tab: "classes" },
  { emoji: "📜", title: "Compétences", desc: "Des dizaines de compétences à débloquer avec vos XP, réparties par classe et par niveau de maîtrise.", tab: "competences" },
  { emoji: "🔮", title: "Magie arcanique", desc: "11 cercles de magie, 135 sorts à personnaliser — zone, portée, durée et niveau sont tous modulables.", tab: "magie" },
  { emoji: "🙏", title: "Magie divine", desc: "8 domaines de prières pour les prêtres, liés aux religions et cultes du monde de Destéa.", tab: "prieres" },
  { emoji: "✝", title: "Religions & Cultes", desc: "Rejoignez l'un des cultes de Destéa, obtenez le pouvoir de votre symbole sacré et accédez à des domaines exclusifs.", tab: "religions" },
  { emoji: "🌍", title: "Régions & Cités", desc: "Explorez la géographie du monde de Destéa — royaumes, empires et cités qui forment l'univers d'Hurlevent.", tab: "monde" },
];

/* ---------- component ---------- */
const Accueil = () => {
  const { user } = useAuth();
  const creerLink = user ? "/personnage/nouveau" : "/connexion";

  const [evenement, setEvenement] = useState<ProchainEvenement | null>(null);
  const [loading, setLoading] = useState(true);

  // inscription state
  const [personnages, setPersonnages] = useState<Personnage[]>([]);
  const [personnagesLoaded, setPersonnagesLoaded] = useState(false);
  const [selectedPerso, setSelectedPerso] = useState<string | null>(null);
  const [dejaInscrit, setDejaInscrit] = useState(false);
  const [inscribing, setInscribing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const evRes = await supabase.from("vue_prochain_evenement").select("*").maybeSingle();
      setEvenement(evRes.data as ProchainEvenement | null);
      setLoading(false);
    };
    fetchData();
  }, []);

  // load player's active characters + check existing inscription
  useEffect(() => {
    if (!user || !evenement?.id) return;
    const load = async () => {
      const [pRes, iRes] = await Promise.all([
        supabase
          .from("personnages")
          .select("id, nom")
          .eq("joueur_id", user.id)
          .eq("est_actif", true)
          .order("created_at", { ascending: true }),
        supabase
          .from("inscriptions_evenements")
          .select("id")
          .eq("evenement_id", evenement.id)
          .eq("joueur_id", user.id)
          .limit(1),
      ]);
      const persos = (pRes.data ?? []) as Personnage[];
      setPersonnages(persos);
      if (persos.length === 1) setSelectedPerso(persos[0].id);
      setDejaInscrit((iRes.data ?? []).length > 0);
      setPersonnagesLoaded(true);
    };
    load();
  }, [user, evenement?.id]);

  const handleInscription = async () => {
    if (!user || !evenement?.id || !selectedPerso) return;
    setInscribing(true);
    const { data: { session } } = await supabase.auth.getSession();
    const joueurId = session?.user?.id;
    if (!joueurId) {
      toast.error("Session expirée, veuillez vous reconnecter.");
      setInscribing(false);
      return;
    }
    const { error } = await supabase.from("inscriptions_evenements").insert({
      evenement_id: evenement.id,
      personnage_id: selectedPerso,
      joueur_id: joueurId,
      statut: "en_attente",
    });
    setInscribing(false);
    if (error) {
      if (error.code === "23505") {
        setDejaInscrit(true);
      } else {
        toast.error("Erreur lors de l'inscription.");
      }
      return;
    }
    setDejaInscrit(true);
    toast.success(
      "Inscription complétée ! Après l'événement, l'organisation confirmera votre présence et vous recevrez les XP sur votre personnage."
    );
  };

  return (
    <div className="flex flex-col">
      {/* ── HERO ── */}
      <section className="relative flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-transparent" />
        <div className="relative z-10 mx-auto max-w-3xl space-y-6">
          <h1 className="font-heading text-5xl font-bold tracking-wide text-primary md:text-7xl">
            Hurlevent
          </h1>
          <p className="font-heading text-xl text-primary/80 md:text-2xl">
            GN Médiéval-Fantastique de Destéa
          </p>
          <p className="mx-auto max-w-xl text-base text-muted-foreground md:text-lg">
            Plongez dans le monde de Destéa, un univers médiéval-fantastique grandeur nature au
            Québec. Créez votre personnage, rejoignez les événements et écrivez votre légende.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Button asChild size="lg" className="text-base">
              <Link to={creerLink}>Créer mon personnage</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-base">
              <Link to="/evenements">Voir les événements</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── PROCHAIN ÉVÉNEMENT ── */}
      <section className="mx-auto w-full max-w-4xl px-4 py-16">
        <h2 className="mb-8 text-center font-heading text-3xl font-bold text-primary">
          Prochain événement
        </h2>
        {loading ? (
          <p className="text-center text-muted-foreground">Chargement…</p>
        ) : evenement ? (
          <Card className="border-primary/20 bg-card/80 backdrop-blur">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary">
                  {typeLabel(evenement.type_evenement)}
                </span>
                {evenement.xp_recompense != null && (
                  <span className="flex items-center gap-1 text-xs text-primary/70">
                    <Sparkles className="h-3.5 w-3.5" /> {evenement.xp_recompense} XP
                  </span>
                )}
              </div>
              <CardTitle className="font-heading text-2xl">{evenement.titre}</CardTitle>
              {evenement.description && (
                <p className="mt-1 text-sm italic text-muted-foreground">{evenement.description}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-primary/60" />
                  {formatDate(evenement.date_evenement)}
                  {evenement.date_fin && <> — {formatDate(evenement.date_fin)}</>}
                </span>
                {evenement.lieu && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-primary/60" /> {evenement.lieu}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-primary/60" />
                  {evenement.nb_inscrits ?? 0} inscrit(s)
                  {evenement.places_restantes != null && (
                    <> · {evenement.places_restantes} place(s) restante(s)</>
                  )}
                </span>
              </div>

              {/* Inscription */}
              <InscriptionBlock
                user={user}
                evenementId={evenement.id}
                personnages={personnages}
                personnagesLoaded={personnagesLoaded}
                selectedPerso={selectedPerso}
                setSelectedPerso={setSelectedPerso}
                dejaInscrit={dejaInscrit}
                inscribing={inscribing}
                onInscrire={handleInscription}
              />
            </CardContent>
          </Card>
        ) : (
          <p className="text-center text-muted-foreground">
            Aucun événement à venir pour le moment. Revenez bientôt !
          </p>
        )}
      </section>

      {/* ── TOUT CE DONT VOUS AVEZ BESOIN ── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <h2 className="mb-2 text-center font-heading text-3xl font-bold text-primary">
          Tout ce dont vous avez besoin
        </h2>
        <p className="mb-10 text-center text-muted-foreground">
          La plateforme Hurlevent centralise tout ce qu'il vous faut pour préparer votre aventure dans le monde de Destéa.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featureCards.map((c) => (
            <Link
              key={c.tab}
              to={`/encyclopedie?tab=${c.tab}`}
              className="group rounded-lg border p-5 transition-colors hover:border-primary/60"
              style={{ background: "#111111", borderColor: "#c9a84c33" }}
            >
              <span className="text-2xl">{c.emoji}</span>
              <h3 className="mt-2 font-heading text-base font-semibold text-foreground group-hover:text-primary">
                {c.title}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">{c.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="flex flex-col items-center gap-6 px-4 py-20 text-center">
        <h2 className="font-heading text-3xl font-bold text-primary">
          Prêt à rejoindre l'aventure ?
        </h2>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Connectez-vous pour créer votre personnage, gérer votre fiche et vous préparer pour le prochain événement Hurlevent dans le monde de Destéa.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {user ? (
            <>
              <Button asChild size="lg" className="text-base" style={{ background: "#c9a84c", color: "#0a0a0a" }}>
                <Link to="/tableau-de-bord">Voir mon compte</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-base" style={{ borderColor: "#6b1f2a", color: "#6b1f2a" }}>
                <Link to="/regles">Consulter les règles</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild size="lg" className="text-base" style={{ background: "#c9a84c", color: "#0a0a0a" }}>
                <Link to="/connexion">Créer mon personnage</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-base" style={{ borderColor: "#6b1f2a", color: "#6b1f2a" }}>
                <Link to="/regles">Consulter les règles</Link>
              </Button>
            </>
          )}
        </div>
      </section>
    </div>
  );
};

/* ---------- Inscription sub-component ---------- */
interface InscriptionBlockProps {
  user: any;
  evenementId: string | null;
  personnages: Personnage[];
  personnagesLoaded: boolean;
  selectedPerso: string | null;
  setSelectedPerso: (v: string | null) => void;
  dejaInscrit: boolean;
  inscribing: boolean;
  onInscrire: () => void;
}

const InscriptionBlock = ({
  user,
  evenementId,
  personnages,
  personnagesLoaded,
  selectedPerso,
  setSelectedPerso,
  dejaInscrit,
  inscribing,
  onInscrire,
}: InscriptionBlockProps) => {
  if (!evenementId) return null;

  if (!user) {
    return (
      <Button asChild size="sm">
        <Link to="/connexion">S'inscrire à cet événement</Link>
      </Button>
    );
  }

  if (dejaInscrit) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-sm font-medium text-primary">
        Déjà inscrit ✓
      </span>
    );
  }

  if (!personnagesLoaded) return null;

  if (personnages.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Vous devez d'abord créer un personnage.</p>
        <Button asChild size="sm">
          <Link to="/personnage/nouveau">Créer mon personnage</Link>
        </Button>
      </div>
    );
  }

  if (personnages.length === 1) {
    return (
      <Button size="sm" disabled={inscribing} onClick={onInscrire}>
        {inscribing ? "Inscription…" : "S'inscrire à cet événement"}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-56">
        <Select value={selectedPerso ?? ""} onValueChange={setSelectedPerso}>
          <SelectTrigger>
            <SelectValue placeholder="Choisir un personnage" />
          </SelectTrigger>
          <SelectContent>
            {personnages.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nom ?? "Sans nom"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button size="sm" disabled={!selectedPerso || inscribing} onClick={onInscrire}>
        {inscribing ? "Inscription…" : "Confirmer l'inscription"}
      </Button>
    </div>
  );
};

export default Accueil;
