import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import { ProfilProvider } from "./contexts/ProfilContext.tsx";
import { ModeStaffProvider } from "./contexts/ModeStaffContext.tsx";
import { ModeAffichageProvider } from "./contexts/ModeAffichageContext.tsx";
import FiletErreur from "./components/FiletErreur.tsx";
import { installerFilet } from "./lib/filet.ts";
import "./polices.ts";
import "./index.css";

installerFilet();

createRoot(document.getElementById("root")!).render(
  <FiletErreur>
    <ModeAffichageProvider>
      <AuthProvider>
        <ProfilProvider>
          <ModeStaffProvider>
            <App />
          </ModeStaffProvider>
        </ProfilProvider>
      </AuthProvider>
    </ModeAffichageProvider>
  </FiletErreur>
);
