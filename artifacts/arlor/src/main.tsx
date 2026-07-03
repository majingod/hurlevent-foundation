import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import { ProfilProvider } from "./contexts/ProfilContext.tsx";
import { ModeStaffProvider } from "./contexts/ModeStaffContext.tsx";
import { ModeAffichageProvider } from "./contexts/ModeAffichageContext.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ModeAffichageProvider>
    <AuthProvider>
      <ProfilProvider>
        <ModeStaffProvider>
          <App />
        </ModeStaffProvider>
      </ProfilProvider>
    </AuthProvider>
  </ModeAffichageProvider>
);
