import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

/**
 * Garde de consentement CGU (s334) — montée en permanence sous le Router (App.tsx).
 * Affiche une modale non fermable quand le compte connecté n'a pas accepté la version
 * en vigueur des Conditions d'utilisation (parametres_jeu.cgu_version_en_vigueur vs
 * profiles.cgu_version_acceptee). L'acceptation passe par le guichet RPC accepter_cgu
 * (auth → validation de version → écriture → journal d'audit).
 * Consentement par COMPTE (titulaire adulte), pas par profil joueur.
 */
export default function CguGate() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [versionEnVigueur, setVersionEnVigueur] = useState<string | null>(null);
  const [versionAcceptee, setVersionAcceptee] = useState<string | null>(null);
  const [charge, setCharge] = useState(false);
  const [caseCochee, setCaseCochee] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    let actif = true;
    setCharge(false);
    setCaseCochee(false);
    if (!user) {
      setVersionAcceptee(null);
      return;
    }
    (async () => {
      const [param, profil] = await Promise.all([
        supabase.from("parametres_jeu").select("cgu_version_en_vigueur").limit(1).maybeSingle(),
        supabase.from("profiles").select("cgu_version_acceptee").eq("id", user.id).maybeSingle(),
      ]);
      if (!actif) return;
      setVersionEnVigueur(param.data?.cgu_version_en_vigueur ?? null);
      setVersionAcceptee(profil.data?.cgu_version_acceptee ?? null);
      setCharge(true);
    })();
    return () => {
      actif = false;
    };
  }, [user?.id]);

  const doitAccepter = Boolean(
    user && charge && versionEnVigueur && versionAcceptee !== versionEnVigueur,
  );

  const accepter = async () => {
    if (!versionEnVigueur) return;
    setEnvoi(true);
    const { data, error } = await supabase.rpc("accepter_cgu", { p_version: versionEnVigueur });
    setEnvoi(false);
    const res = data as {
      succes?: boolean;
      erreurs?: { code?: string; message?: string }[];
      donnees?: { version_en_vigueur?: string } | null;
    } | null;
    if (error || !res?.succes) {
      const code = res?.erreurs?.[0]?.code;
      if (code === "VERSION_OBSOLETE" && res?.donnees?.version_en_vigueur) {
        setVersionEnVigueur(res.donnees.version_en_vigueur);
        setCaseCochee(false);
        toast({
          title: "Version mise à jour",
          description: "Les conditions ont changé entre-temps, merci de les relire puis d'accepter.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erreur",
          description:
            res?.erreurs?.[0]?.message ?? error?.message ?? "Impossible d'enregistrer l'acceptation.",
          variant: "destructive",
        });
      }
      return;
    }
    setVersionAcceptee(versionEnVigueur);
    toast({
      title: "Merci !",
      description: "Votre acceptation des conditions d'utilisation a été enregistrée.",
    });
  };

  return (
    <Dialog open={doitAccepter}>
      <DialogContent
        className="max-w-md [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-primary">Conditions d'utilisation</DialogTitle>
          <DialogDescription>
            Pour continuer à utiliser la plateforme, merci de lire et d'accepter les conditions
            d'utilisation (version du {versionEnVigueur}).
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          <Link
            to="/conditions-utilisation"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Lire les conditions d'utilisation
          </Link>{" "}
          (ouvre un nouvel onglet).
        </p>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox
            checked={caseCochee}
            onCheckedChange={(v) => setCaseCochee(v === true)}
            className="mt-0.5"
          />
          <span>J'ai lu et j'accepte les conditions d'utilisation.</span>
        </label>
        <DialogFooter>
          <Button className="w-full" disabled={!caseCochee || envoi} onClick={accepter}>
            {envoi ? "Enregistrement…" : "Accepter et continuer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
