-- Phase 1 — Tâche 1.1 : Ajout des colonnes manquantes
-- 27/04/2026 : ces colonnes sont utilisées dans le code frontend mais absentes de la DB

-- Sous-type Chiméride sur les personnages
ALTER TABLE personnages
ADD COLUMN IF NOT EXISTS sous_type_chimeride text
CHECK (sous_type_chimeride IN ('carnivore', 'herbivore') OR sous_type_chimeride IS NULL);

-- Flag est_gratuit pour les acquisitions artisanales
ALTER TABLE personnage_assemblages
ADD COLUMN IF NOT EXISTS est_gratuit boolean NOT NULL DEFAULT false;

ALTER TABLE personnage_recettes
ADD COLUMN IF NOT EXISTS est_gratuit boolean NOT NULL DEFAULT false;
