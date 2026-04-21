import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardTab } from "@/components/administration/DashboardTab";
import { JoueursTab } from "@/components/administration/JoueursTab";
import { PersonnagesTab } from "@/components/administration/PersonnagesTab";
import { EvenementsTab } from "@/components/administration/EvenementsTab";
import { ApprobationsTab } from "@/components/administration/ApprobationsTab";
import { DonneesTab } from "@/components/administration/DonneesTab";
import { useSearchParams } from "react-router-dom";

const Administration = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "dashboard";
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    alert("✅ La page Administration est bien chargée !");
  }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  return (
    <div className="container py-8">
      <h1 className="font-cinzel text-3xl mb-6">Administration</h1>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="flex flex-wrap gap-2 bg-transparent p-0">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-gold data-[state=active]:text-black">Tableau de bord</TabsTrigger>
          <TabsTrigger value="joueurs" className="data-[state=active]:bg-gold data-[state=active]:text-black">Joueurs</TabsTrigger>
          <TabsTrigger value="personnages" className="data-[state=active]:bg-gold data-[state=active]:text-black">Personnages</TabsTrigger>
          <TabsTrigger value="evenements" className="data-[state=active]:bg-gold data-[state=active]:text-black">Événements</TabsTrigger>
          <TabsTrigger value="approbations" className="data-[state=active]:bg-gold data-[state=active]:text-black">Approbations</TabsTrigger>
          <TabsTrigger value="donnees" className="data-[state=active]:bg-gold data-[state=active]:text-black">Données de jeu</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardTab />
        </TabsContent>
        <TabsContent value="joueurs">
          <JoueursTab />
        </TabsContent>
        <TabsContent value="personnages">
          <PersonnagesTab />
        </TabsContent>
        <TabsContent value="evenements">
          <EvenementsTab />
        </TabsContent>
        <TabsContent value="approbations">
          <ApprobationsTab />
        </TabsContent>
        <TabsContent value="donnees">
          <DonneesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Administration;
