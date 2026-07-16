import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Link, Navigate } from "react-router-dom";

const Connexion = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // s334 [CGU-CONSENT] : version en vigueur des conditions (source unique : parametres_jeu).
  const [cguAccepte, setCguAccepte] = useState(false);
  const [cguVersion, setCguVersion] = useState<string | null>(null);
  useEffect(() => {
    supabase
      .from("parametres_jeu")
      .select("cgu_version_en_vigueur")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setCguVersion(data?.cgu_version_en_vigueur ?? null));
  }, []);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");

  if (user) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erreur de connexion", description: error.message, variant: "destructive" });
    } else {
      navigate("/");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupPassword !== signupConfirm) {
      toast({ title: "Erreur", description: "Les mots de passe ne correspondent pas.", variant: "destructive" });
      return;
    }
    if (!cguAccepte) {
      toast({
        title: "Conditions d'utilisation",
        description: "Veuillez lire et accepter les conditions d'utilisation pour créer un compte.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        emailRedirectTo: window.location.origin,
        // s334 [CGU-CONSENT] : le trigger creer_profil_nouveau_joueur copie cette valeur
        // dans profiles.cgu_version_acceptee. Si la version n'a pas pu être chargée,
        // la garde CguGate rattrapera le consentement à la première connexion.
        ...(cguVersion ? { data: { cgu_version_acceptee: cguVersion } } : {}),
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erreur d'inscription", description: error.message, variant: "destructive" });
    } else if (data.session) {
      toast({ title: "Inscription réussie", description: "Votre compte est prêt, vous êtes connecté." });
      navigate("/");
    } else {
      toast({ title: "Inscription réussie", description: "Vérifiez votre courriel pour confirmer votre compte." });
    }
  };

  return (
    <div className="container flex min-h-[80vh] items-center justify-center py-12">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="text-center">
          <CardTitle className="font-heading text-2xl text-primary">Hurlevent</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="connexion" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="connexion">Connexion</TabsTrigger>
              <TabsTrigger value="inscription">Inscription</TabsTrigger>
            </TabsList>

            <TabsContent value="connexion">
              <form onSubmit={handleLogin} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Courriel</Label>
                  <Input id="login-email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Mot de passe</Label>
                  <Input id="login-password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Connexion…" : "Se connecter"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="inscription">
              <form onSubmit={handleSignup} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Courriel</Label>
                  <Input id="signup-email" type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Mot de passe</Label>
                  <Input id="signup-password" type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirmer le mot de passe</Label>
                  <Input id="signup-confirm" type="password" value={signupConfirm} onChange={(e) => setSignupConfirm(e.target.value)} required />
                </div>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <Checkbox
                    checked={cguAccepte}
                    onCheckedChange={(v) => setCguAccepte(v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    J'ai lu et j'accepte les{" "}
                    <Link
                      to="/conditions-utilisation"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-4 hover:text-primary/80"
                    >
                      conditions d'utilisation
                    </Link>
                    .
                  </span>
                </label>
                <Button type="submit" className="w-full" disabled={loading || !cguAccepte}>
                  {loading ? "Inscription…" : "S'inscrire"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Connexion;
