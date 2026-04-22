import { useEffect } from "react";

const Administration = () => {
  useEffect(() => {
    alert("✅ La page Administration est bien chargée !");
  }, []);

  return (
    <div className="container py-8">
      <h1 className="font-cinzel text-3xl mb-6">Administration</h1>
      <p className="text-white/80">Page d'administration en construction.</p>
      <p className="text-white/60 text-sm mt-2">
        Les onglets (Dashboard, Joueurs, etc.) seront ajoutés ultérieurement.
      </p>
    </div>
  );
};

export default Administration;
