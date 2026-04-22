import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardTab } from "@/components/administration/DashboardTab";
import { useSearchParams } from "react-router-dom";

const Administration = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "dashboard";
  const [activeTab, setActiveTab] = useState(defaultTab);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  return (
    <div className="container py-8">
      <h1 className="font-cinzel text-3xl mb-6">Administration</h1>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="flex flex-wrap gap-2 bg-transparent p-0">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-gold data-[state=active]:text-black">
            Tableau de bord
          </TabsTrigger>
          {/* Les autres onglets seront ajoutés progressivement */}
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Administration;
