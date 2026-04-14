import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, MapPin, Users, Swords, Shield, Star, Sparkles } from "lucide-react";

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

/* ---------- component ---------- */
const Accueil = () => {
  const { user } = useAuth();
  const creerLink = user ? "/personnage/nouveau" : "/connexion";

  const [evenement, setEvenement] = useState<ProchainEvenement | null>(null);
  const [races, setRaces] = useState<Race[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [evRes, racesRes, classesRes] = await Promise.all([
        supabase.from("vue_prochain_evenement").select("*").maybeSingle(),
        supabase.from("races").select("*").eq("est_jouable", true).eq("est_actif", true),
        supabase.from("classes").select("*").eq("est_actif", true),
      ]);
      setEvenement(evRes.data as ProchainEvenement | null);
      setRaces((racesRes.data ?? []) as Race[]);
      setClasses((classesRes.data ?? []) as Classe[]);
      setLoading(false);
    };
    fetch();
  }, []);

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
              {!user && (
                <Button asChild size="sm">
                  <Link to="/connexion">S'inscrire</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <p className="text-center text-muted-foreground">
            Aucun événement à venir pour le moment. Revenez bientôt !
          </p>
        )}
      </section>

      {/* ── RACES ── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <h2 className="mb-8 text-center font-heading text-3xl font-bold text-primary">
          Les races de Destéa
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {races.map((r) => (
            <Card
              key={r.id}
              className="border-primary/10 transition-shadow duration-200 hover:shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
            >
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-xl">{r.nom}</CardTitle>
                {r.nom_latin && (
                  <p className="text-sm italic text-muted-foreground">{r.nom_latin}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                {r.esperance_vie && <p>Espérance de vie : {r.esperance_vie}</p>}
                <p>XP de départ : {r.xp_depart}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── CLASSES ── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <h2 className="mb-8 text-center font-heading text-3xl font-bold text-primary">
          Les classes de Destéa
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {classes.map((c) => (
            <Card key={c.id} className="border-primary/10">
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-xl">{c.nom}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                {c.description && <p>{c.description}</p>}
                <div className="flex gap-4 pt-2 text-xs">
                  <span className="flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5 text-primary/60" /> PV de départ : {c.pv_depart ?? "—"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Swords className="h-3.5 w-3.5 text-primary/60" /> PS de départ : {c.ps_depart ?? "—"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="flex flex-col items-center gap-6 px-4 py-20 text-center">
        <h2 className="font-heading text-3xl font-bold text-primary">
          Prêt à rejoindre l'aventure ?
        </h2>
        <Button asChild size="lg" className="text-base">
          <Link to={creerLink}>Créer mon personnage</Link>
        </Button>
      </section>
    </div>
  );
};

export default Accueil;
