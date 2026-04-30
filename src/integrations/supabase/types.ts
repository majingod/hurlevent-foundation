export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      assemblages_runes: {
        Row: {
          id: string
          nom: string | null
          description: string | null
          runes_requises: string[] | null
          effet: string | null
          cout_xp: number | null
          est_actif: boolean | null
          description_longue: string | null
          cible: string | null
          cout_ps: number | null
          effet_maitrise: string | null
          cout_ps_maitrise: number | null
        }
        Insert: {
          id?: string | null
          nom?: string | null
          description?: string | null
          runes_requises?: string[] | null
          effet?: string | null
          cout_xp?: number | null
          est_actif?: boolean | null
          description_longue?: string | null
          cible?: string | null
          cout_ps?: number | null
          effet_maitrise?: string | null
          cout_ps_maitrise?: number | null
        }
        Update: {
          id?: string | null
          nom?: string | null
          description?: string | null
          runes_requises?: string[] | null
          effet?: string | null
          cout_xp?: number | null
          est_actif?: boolean | null
          description_longue?: string | null
          cible?: string | null
          cout_ps?: number | null
          effet_maitrise?: string | null
          cout_ps_maitrise?: number | null
        }
        Relationships: []
      }
      bestiaire: {
        Row: {
          id: string
          nom: string
          categorie: string
          pv_formule: string | null
          description: string
          immunites: string | null
          capacites_speciales: string | null
          est_actif: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string | null
          nom?: string | null
          categorie?: string | null
          pv_formule?: string | null
          description?: string | null
          immunites?: string | null
          capacites_speciales?: string | null
          est_actif?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          nom?: string | null
          categorie?: string | null
          pv_formule?: string | null
          description?: string | null
          immunites?: string | null
          capacites_speciales?: string | null
          est_actif?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cartes_accueil: {
        Row: {
          id: string
          emoji: string
          titre: string
          description: string
          tab_cible: string
          ordre: number
          est_actif: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string | null
          emoji?: string | null
          titre?: string | null
          description?: string | null
          tab_cible?: string | null
          ordre?: number | null
          est_actif?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          emoji?: string | null
          titre?: string | null
          description?: string | null
          tab_cible?: string | null
          ordre?: number | null
          est_actif?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      categories_creatures: {
        Row: {
          id: string
          nom: string
          ordre: number
          est_actif: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string | null
          nom?: string | null
          ordre?: number | null
          est_actif?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          nom?: string | null
          ordre?: number | null
          est_actif?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      classes: {
        Row: {
          id: string
          nom: string | null
          description: string | null
          role_combat: string | null
          pv_depart: number | null
          ps_depart: number | null
          competences_gratuites: Json | null
          est_actif: boolean | null
          peut_utiliser_armes_deux_mains: boolean | null
          emoji: string | null
        }
        Insert: {
          id?: string | null
          nom?: string | null
          description?: string | null
          role_combat?: string | null
          pv_depart?: number | null
          ps_depart?: number | null
          competences_gratuites?: Json | null
          est_actif?: boolean | null
          peut_utiliser_armes_deux_mains?: boolean | null
          emoji?: string | null
        }
        Update: {
          id?: string | null
          nom?: string | null
          description?: string | null
          role_combat?: string | null
          pv_depart?: number | null
          ps_depart?: number | null
          competences_gratuites?: Json | null
          est_actif?: boolean | null
          peut_utiliser_armes_deux_mains?: boolean | null
          emoji?: string | null
        }
        Relationships: []
      }
      competences: {
        Row: {
          id: string
          nom: string | null
          description: string | null
          categorie: string | null
          niveaux: Json | null
          est_general: boolean | null
          est_actif: boolean | null
          type_achat: string
          type_choix: string | null
          verrouillage_croise: boolean
        }
        Insert: {
          id?: string | null
          nom?: string | null
          description?: string | null
          categorie?: string | null
          niveaux?: Json | null
          est_general?: boolean | null
          est_actif?: boolean | null
          type_achat?: string | null
          type_choix?: string | null
          verrouillage_croise?: boolean | null
        }
        Update: {
          id?: string | null
          nom?: string | null
          description?: string | null
          categorie?: string | null
          niveaux?: Json | null
          est_general?: boolean | null
          est_actif?: boolean | null
          type_achat?: string | null
          type_choix?: string | null
          verrouillage_croise?: boolean | null
        }
        Relationships: []
      }
      config_jeu: {
        Row: {
          id: string
          cle: string | null
          valeur: Json | null
        }
        Insert: {
          id?: string | null
          cle?: string | null
          valeur?: Json | null
        }
        Update: {
          id?: string | null
          cle?: string | null
          valeur?: Json | null
        }
        Relationships: []
      }
      effets_combat: {
        Row: {
          id: string
          nom: string | null
          description: string | null
          duree: string | null
          conditions: string | null
          type: string | null
          source: string | null
        }
        Insert: {
          id?: string | null
          nom?: string | null
          description?: string | null
          duree?: string | null
          conditions?: string | null
          type?: string | null
          source?: string | null
        }
        Update: {
          id?: string | null
          nom?: string | null
          description?: string | null
          duree?: string | null
          conditions?: string | null
          type?: string | null
          source?: string | null
        }
        Relationships: []
      }
      evenements: {
        Row: {
          id: string
          titre: string | null
          description: string | null
          date_evenement: string | null
          lieu: string | null
          xp_recompense: number | null
          max_participants: number | null
          est_publie: boolean | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
          date_fin: string | null
          type_evenement: string | null
        }
        Insert: {
          id?: string | null
          titre?: string | null
          description?: string | null
          date_evenement?: string | null
          lieu?: string | null
          xp_recompense?: number | null
          max_participants?: number | null
          est_publie?: boolean | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          date_fin?: string | null
          type_evenement?: string | null
        }
        Update: {
          id?: string | null
          titre?: string | null
          description?: string | null
          date_evenement?: string | null
          lieu?: string | null
          xp_recompense?: number | null
          max_participants?: number | null
          est_publie?: boolean | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          date_fin?: string | null
          type_evenement?: string | null
        }
        Relationships: []
      }
      familles_criminelles: {
        Row: {
          id: string
          nom: string | null
          description: string | null
          avantages: string | null
          est_actif: boolean | null
          description_longue: string | null
        }
        Insert: {
          id?: string | null
          nom?: string | null
          description?: string | null
          avantages?: string | null
          est_actif?: boolean | null
          description_longue?: string | null
        }
        Update: {
          id?: string | null
          nom?: string | null
          description?: string | null
          avantages?: string | null
          est_actif?: boolean | null
          description_longue?: string | null
        }
        Relationships: []
      }
      ingredients_alchimiques: {
        Row: {
          id: string
          nom: string | null
          manipulations: string | null
          niveau: number | null
        }
        Insert: {
          id?: string | null
          nom?: string | null
          manipulations?: string | null
          niveau?: number | null
        }
        Update: {
          id?: string | null
          nom?: string | null
          manipulations?: string | null
          niveau?: number | null
        }
        Relationships: []
      }
      inscriptions_evenements: {
        Row: {
          id: string
          evenement_id: string | null
          personnage_id: string | null
          joueur_id: string | null
          statut: string | null
          date_inscription: string | null
          date_confirmation: string | null
          updated_at: string | null
          xp_attribue: number | null
        }
        Insert: {
          id?: string | null
          evenement_id?: string | null
          personnage_id?: string | null
          joueur_id?: string | null
          statut?: string | null
          date_inscription?: string | null
          date_confirmation?: string | null
          updated_at?: string | null
          xp_attribue?: number | null
        }
        Update: {
          id?: string | null
          evenement_id?: string | null
          personnage_id?: string | null
          joueur_id?: string | null
          statut?: string | null
          date_inscription?: string | null
          date_confirmation?: string | null
          updated_at?: string | null
          xp_attribue?: number | null
        }
        Relationships: []
      }
      langues: {
        Row: {
          id: string
          nom: string
          est_ancienne: boolean
          ordre: number
          est_actif: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string | null
          nom?: string | null
          est_ancienne?: boolean | null
          ordre?: number | null
          est_actif?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          nom?: string | null
          est_ancienne?: boolean | null
          ordre?: number | null
          est_actif?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      lore: {
        Row: {
          id: string
          categorie: string
          nom: string
          sous_titre: string | null
          embleme: string | null
          description: string
          ordre: number | null
          est_actif: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string | null
          categorie?: string | null
          nom?: string | null
          sous_titre?: string | null
          embleme?: string | null
          description?: string | null
          ordre?: number | null
          est_actif?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          categorie?: string | null
          nom?: string | null
          sous_titre?: string | null
          embleme?: string | null
          description?: string | null
          ordre?: number | null
          est_actif?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      menu_navigation: {
        Row: {
          id: string
          libelle: string
          url: string
          roles_autorises: string[] | null
          afficher_navbar: boolean
          afficher_footer: boolean
          ordre: number
          est_actif: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string | null
          libelle?: string | null
          url?: string | null
          roles_autorises?: string[] | null
          afficher_navbar?: boolean | null
          afficher_footer?: boolean | null
          ordre?: number | null
          est_actif?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          libelle?: string | null
          url?: string | null
          roles_autorises?: string[] | null
          afficher_navbar?: boolean | null
          afficher_footer?: boolean | null
          ordre?: number | null
          est_actif?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string | null
          message: string | null
          lu: boolean | null
          created_at: string | null
          updated_at: string | null
          type: string
          reference_id: string | null
          statut: string
        }
        Insert: {
          id?: string | null
          user_id?: string | null
          message?: string | null
          lu?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          type?: string | null
          reference_id?: string | null
          statut?: string | null
        }
        Update: {
          id?: string | null
          user_id?: string | null
          message?: string | null
          lu?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          type?: string | null
          reference_id?: string | null
          statut?: string | null
        }
        Relationships: []
      }
      objets_forge: {
        Row: {
          id: string
          nom: string | null
          description: string | null
          type: string | null
          stats: Json | null
          difficulte: number | null
          cout_xp: number | null
          est_actif: boolean | null
          materiaux_communs: string | null
          materiaux_rares: string | null
        }
        Insert: {
          id?: string | null
          nom?: string | null
          description?: string | null
          type?: string | null
          stats?: Json | null
          difficulte?: number | null
          cout_xp?: number | null
          est_actif?: boolean | null
          materiaux_communs?: string | null
          materiaux_rares?: string | null
        }
        Update: {
          id?: string | null
          nom?: string | null
          description?: string | null
          type?: string | null
          stats?: Json | null
          difficulte?: number | null
          cout_xp?: number | null
          est_actif?: boolean | null
          materiaux_communs?: string | null
          materiaux_rares?: string | null
        }
        Relationships: []
      }
      objets_joaillerie: {
        Row: {
          id: string
          nom: string | null
          description: string | null
          effet: string | null
          difficulte: number | null
          cout_xp: number | null
          est_actif: boolean | null
          materiaux_communs: string | null
          materiaux_rares: string | null
        }
        Insert: {
          id?: string | null
          nom?: string | null
          description?: string | null
          effet?: string | null
          difficulte?: number | null
          cout_xp?: number | null
          est_actif?: boolean | null
          materiaux_communs?: string | null
          materiaux_rares?: string | null
        }
        Update: {
          id?: string | null
          nom?: string | null
          description?: string | null
          effet?: string | null
          difficulte?: number | null
          cout_xp?: number | null
          est_actif?: boolean | null
          materiaux_communs?: string | null
          materiaux_rares?: string | null
        }
        Relationships: []
      }
      personnage_assemblages: {
        Row: {
          id: string
          personnage_id: string
          assemblage_id: string
          xp_depense: number
          date_acquisition: string
          est_gratuit: boolean
        }
        Insert: {
          id?: string | null
          personnage_id?: string | null
          assemblage_id?: string | null
          xp_depense?: number | null
          date_acquisition?: string | null
          est_gratuit?: boolean | null
        }
        Update: {
          id?: string | null
          personnage_id?: string | null
          assemblage_id?: string | null
          xp_depense?: number | null
          date_acquisition?: string | null
          est_gratuit?: boolean | null
        }
        Relationships: []
      }
      personnage_competences: {
        Row: {
          id: string
          personnage_id: string
          competence_id: string
          niveau_acquis: number
          appris_via_maitre: boolean
          xp_depense: number
          date_acquisition: string
          nom_maitre: string | null
          statut_maitre: string | null
          choix_achat: string | null
        }
        Insert: {
          id?: string | null
          personnage_id?: string | null
          competence_id?: string | null
          niveau_acquis?: number | null
          appris_via_maitre?: boolean | null
          xp_depense?: number | null
          date_acquisition?: string | null
          nom_maitre?: string | null
          statut_maitre?: string | null
          choix_achat?: string | null
        }
        Update: {
          id?: string | null
          personnage_id?: string | null
          competence_id?: string | null
          niveau_acquis?: number | null
          appris_via_maitre?: boolean | null
          xp_depense?: number | null
          date_acquisition?: string | null
          nom_maitre?: string | null
          statut_maitre?: string | null
          choix_achat?: string | null
        }
        Relationships: []
      }
      personnage_objets_forge: {
        Row: {
          id: string
          personnage_id: string
          objet_id: string
          xp_depense: number
          date_acquisition: string
        }
        Insert: {
          id?: string | null
          personnage_id?: string | null
          objet_id?: string | null
          xp_depense?: number | null
          date_acquisition?: string | null
        }
        Update: {
          id?: string | null
          personnage_id?: string | null
          objet_id?: string | null
          xp_depense?: number | null
          date_acquisition?: string | null
        }
        Relationships: []
      }
      personnage_objets_joaillerie: {
        Row: {
          id: string
          personnage_id: string
          objet_id: string
          xp_depense: number
          date_acquisition: string
        }
        Insert: {
          id?: string | null
          personnage_id?: string | null
          objet_id?: string | null
          xp_depense?: number | null
          date_acquisition?: string | null
        }
        Update: {
          id?: string | null
          personnage_id?: string | null
          objet_id?: string | null
          xp_depense?: number | null
          date_acquisition?: string | null
        }
        Relationships: []
      }
      personnage_prieres: {
        Row: {
          id: string
          personnage_id: string
          priere_id: string
          niveau_priere: number
          xp_depense: number
          date_acquisition: string
          nom_personnalise: string | null
          zone_choisie: string | null
          portee_choisie: string | null
          duree_choisie: string | null
          duree_incantation_calculee: number | null
        }
        Insert: {
          id?: string | null
          personnage_id?: string | null
          priere_id?: string | null
          niveau_priere?: number | null
          xp_depense?: number | null
          date_acquisition?: string | null
          nom_personnalise?: string | null
          zone_choisie?: string | null
          portee_choisie?: string | null
          duree_choisie?: string | null
          duree_incantation_calculee?: number | null
        }
        Update: {
          id?: string | null
          personnage_id?: string | null
          priere_id?: string | null
          niveau_priere?: number | null
          xp_depense?: number | null
          date_acquisition?: string | null
          nom_personnalise?: string | null
          zone_choisie?: string | null
          portee_choisie?: string | null
          duree_choisie?: string | null
          duree_incantation_calculee?: number | null
        }
        Relationships: []
      }
      personnage_races_demandes: {
        Row: {
          id: string
          personnage_id: string
          race_id: string
          background: string
          statut: string
          raison_refus: string | null
          approuve_par: string | null
          created_at: string
          updated_at: string
          date_approbation: string | null
        }
        Insert: {
          id?: string | null
          personnage_id?: string | null
          race_id?: string | null
          background?: string | null
          statut?: string | null
          raison_refus?: string | null
          approuve_par?: string | null
          created_at?: string | null
          updated_at?: string | null
          date_approbation?: string | null
        }
        Update: {
          id?: string | null
          personnage_id?: string | null
          race_id?: string | null
          background?: string | null
          statut?: string | null
          raison_refus?: string | null
          approuve_par?: string | null
          created_at?: string | null
          updated_at?: string | null
          date_approbation?: string | null
        }
        Relationships: []
      }
      personnage_recettes: {
        Row: {
          id: string
          personnage_id: string
          recette_id: string
          xp_depense: number
          date_acquisition: string
          est_gratuit: boolean
        }
        Insert: {
          id?: string | null
          personnage_id?: string | null
          recette_id?: string | null
          xp_depense?: number | null
          date_acquisition?: string | null
          est_gratuit?: boolean | null
        }
        Update: {
          id?: string | null
          personnage_id?: string | null
          recette_id?: string | null
          xp_depense?: number | null
          date_acquisition?: string | null
          est_gratuit?: boolean | null
        }
        Relationships: []
      }
      personnage_sorts: {
        Row: {
          id: string
          personnage_id: string
          sort_id: string
          niveau_sort: number
          xp_depense: number
          date_acquisition: string
          nom_personnalise: string | null
          zone_choisie: string | null
          portee_choisie: string | null
          duree_choisie: string | null
          formule_magique: string | null
        }
        Insert: {
          id?: string | null
          personnage_id?: string | null
          sort_id?: string | null
          niveau_sort?: number | null
          xp_depense?: number | null
          date_acquisition?: string | null
          nom_personnalise?: string | null
          zone_choisie?: string | null
          portee_choisie?: string | null
          duree_choisie?: string | null
          formule_magique?: string | null
        }
        Update: {
          id?: string | null
          personnage_id?: string | null
          sort_id?: string | null
          niveau_sort?: number | null
          xp_depense?: number | null
          date_acquisition?: string | null
          nom_personnalise?: string | null
          zone_choisie?: string | null
          portee_choisie?: string | null
          duree_choisie?: string | null
          formule_magique?: string | null
        }
        Relationships: []
      }
      personnages: {
        Row: {
          id: string
          joueur_id: string
          nom: string | null
          race_id: string | null
          classe_id: string | null
          niveau: number | null
          xp_total: number | null
          xp_depense: number | null
          traits_raciaux_choisis: Json | null
          famille_criminelle_id: string | null
          religion_id: string | null
          historique: string | null
          ame_personnage: string | null
          est_verrouille: boolean | null
          etape_creation: number
          date_creation: string | null
          date_modification: string | null
          gn_completes: number | null
          mini_gn_completes: number | null
          ouvertures_terrain: number | null
          created_at: string | null
          updated_at: string | null
          pv_max: number
          ps_max: number
          est_actif: boolean
          est_mort: boolean
          classe_secondaire_id: string | null
          a_forge_legendaire: boolean
          a_joaillerie_legendaire: boolean
          sous_type_chimeride: string | null
          est_croyant: boolean
        }
        Insert: {
          id?: string | null
          joueur_id?: string | null
          nom?: string | null
          race_id?: string | null
          classe_id?: string | null
          niveau?: number | null
          xp_total?: number | null
          xp_depense?: number | null
          traits_raciaux_choisis?: Json | null
          famille_criminelle_id?: string | null
          religion_id?: string | null
          historique?: string | null
          ame_personnage?: string | null
          est_verrouille?: boolean | null
          etape_creation?: number | null
          date_creation?: string | null
          date_modification?: string | null
          gn_completes?: number | null
          mini_gn_completes?: number | null
          ouvertures_terrain?: number | null
          created_at?: string | null
          updated_at?: string | null
          pv_max?: number | null
          ps_max?: number | null
          est_actif?: boolean | null
          est_mort?: boolean | null
          classe_secondaire_id?: string | null
          a_forge_legendaire?: boolean | null
          a_joaillerie_legendaire?: boolean | null
          sous_type_chimeride?: string | null
          est_croyant?: boolean | null
        }
        Update: {
          id?: string | null
          joueur_id?: string | null
          nom?: string | null
          race_id?: string | null
          classe_id?: string | null
          niveau?: number | null
          xp_total?: number | null
          xp_depense?: number | null
          traits_raciaux_choisis?: Json | null
          famille_criminelle_id?: string | null
          religion_id?: string | null
          historique?: string | null
          ame_personnage?: string | null
          est_verrouille?: boolean | null
          etape_creation?: number | null
          date_creation?: string | null
          date_modification?: string | null
          gn_completes?: number | null
          mini_gn_completes?: number | null
          ouvertures_terrain?: number | null
          created_at?: string | null
          updated_at?: string | null
          pv_max?: number | null
          ps_max?: number | null
          est_actif?: boolean | null
          est_mort?: boolean | null
          classe_secondaire_id?: string | null
          a_forge_legendaire?: boolean | null
          a_joaillerie_legendaire?: boolean | null
          sous_type_chimeride?: string | null
          est_croyant?: boolean | null
        }
        Relationships: []
      }
      pieges: {
        Row: {
          id: string
          nom: string
          niveau: number
          cout_xp: number
          cible: string
          duree: string
          effets: string
          niveau_effet: number | null
          type_piege: string
          est_actif: boolean
          created_at: string
          updated_at: string
          construction: string | null
        }
        Insert: {
          id?: string | null
          nom?: string | null
          niveau?: number | null
          cout_xp?: number | null
          cible?: string | null
          duree?: string | null
          effets?: string | null
          niveau_effet?: number | null
          type_piege?: string | null
          est_actif?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          construction?: string | null
        }
        Update: {
          id?: string | null
          nom?: string | null
          niveau?: number | null
          cout_xp?: number | null
          cible?: string | null
          duree?: string | null
          effets?: string | null
          niveau_effet?: number | null
          type_piege?: string | null
          est_actif?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          construction?: string | null
        }
        Relationships: []
      }
      prieres: {
        Row: {
          id: string
          nom: string
          domaine: string
          niveau: number
          description: string | null
          type_priere: string | null
          zone_effet: string | null
          portee: string | null
          duree: string | null
          duree_incantation: string | null
          cout_xp_base: number | null
          religion_id: string | null
          est_actif: boolean
        }
        Insert: {
          id?: string | null
          nom?: string | null
          domaine?: string | null
          niveau?: number | null
          description?: string | null
          type_priere?: string | null
          zone_effet?: string | null
          portee?: string | null
          duree?: string | null
          duree_incantation?: string | null
          cout_xp_base?: number | null
          religion_id?: string | null
          est_actif?: boolean | null
        }
        Update: {
          id?: string | null
          nom?: string | null
          domaine?: string | null
          niveau?: number | null
          description?: string | null
          type_priere?: string | null
          zone_effet?: string | null
          portee?: string | null
          duree?: string | null
          duree_incantation?: string | null
          cout_xp_base?: number | null
          religion_id?: string | null
          est_actif?: boolean | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          username: string | null
          email: string | null
          role: string | null
          created_at: string | null
          is_active: boolean | null
          updated_at: string | null
          nom_affichage: string | null
          avatar_url: string | null
        }
        Insert: {
          id?: string | null
          username?: string | null
          email?: string | null
          role?: string | null
          created_at?: string | null
          is_active?: boolean | null
          updated_at?: string | null
          nom_affichage?: string | null
          avatar_url?: string | null
        }
        Update: {
          id?: string | null
          username?: string | null
          email?: string | null
          role?: string | null
          created_at?: string | null
          is_active?: boolean | null
          updated_at?: string | null
          nom_affichage?: string | null
          avatar_url?: string | null
        }
        Relationships: []
      }
      race_traits: {
        Row: {
          id: string
          race_id: string
          trait_id: string
          sous_type: string | null
        }
        Insert: {
          id?: string | null
          race_id?: string | null
          trait_id?: string | null
          sous_type?: string | null
        }
        Update: {
          id?: string | null
          race_id?: string | null
          trait_id?: string | null
          sous_type?: string | null
        }
        Relationships: []
      }
      races: {
        Row: {
          id: string
          nom: string | null
          description: string | null
          restrictions_classes: string[] | null
          image_url: string | null
          est_actif: boolean | null
          nom_latin: string | null
          xp_depart: number
          esperance_vie: string | null
          exigences_costume: string | null
          nb_traits_raciaux: number
          est_jouable: boolean
          emoji: string | null
        }
        Insert: {
          id?: string | null
          nom?: string | null
          description?: string | null
          restrictions_classes?: string[] | null
          image_url?: string | null
          est_actif?: boolean | null
          nom_latin?: string | null
          xp_depart?: number | null
          esperance_vie?: string | null
          exigences_costume?: string | null
          nb_traits_raciaux?: number | null
          est_jouable?: boolean | null
          emoji?: string | null
        }
        Update: {
          id?: string | null
          nom?: string | null
          description?: string | null
          restrictions_classes?: string[] | null
          image_url?: string | null
          est_actif?: boolean | null
          nom_latin?: string | null
          xp_depart?: number | null
          esperance_vie?: string | null
          exigences_costume?: string | null
          nb_traits_raciaux?: number | null
          est_jouable?: boolean | null
          emoji?: string | null
        }
        Relationships: []
      }
      recettes_alchimie: {
        Row: {
          id: string
          nom: string | null
          description: string | null
          formule: string | null
          effet: string | null
          ingredients: Json | null
          niveau_requis: number | null
          cout_xp: number | null
          est_actif: boolean | null
          type: string | null
        }
        Insert: {
          id?: string | null
          nom?: string | null
          description?: string | null
          formule?: string | null
          effet?: string | null
          ingredients?: Json | null
          niveau_requis?: number | null
          cout_xp?: number | null
          est_actif?: boolean | null
          type?: string | null
        }
        Update: {
          id?: string | null
          nom?: string | null
          description?: string | null
          formule?: string | null
          effet?: string | null
          ingredients?: Json | null
          niveau_requis?: number | null
          cout_xp?: number | null
          est_actif?: boolean | null
          type?: string | null
        }
        Relationships: []
      }
      religions: {
        Row: {
          id: string
          nom: string | null
          dirigeant: string | null
          fondateur: string | null
          description: string | null
          domaines_principaux: string[] | null
          domaines_proscrits: string[] | null
          symbole_sacre: string | null
          pouvoir_symbole: string | null
          est_actif: boolean | null
          description_longue: string | null
        }
        Insert: {
          id?: string | null
          nom?: string | null
          dirigeant?: string | null
          fondateur?: string | null
          description?: string | null
          domaines_principaux?: string[] | null
          domaines_proscrits?: string[] | null
          symbole_sacre?: string | null
          pouvoir_symbole?: string | null
          est_actif?: boolean | null
          description_longue?: string | null
        }
        Update: {
          id?: string | null
          nom?: string | null
          dirigeant?: string | null
          fondateur?: string | null
          description?: string | null
          domaines_principaux?: string[] | null
          domaines_proscrits?: string[] | null
          symbole_sacre?: string | null
          pouvoir_symbole?: string | null
          est_actif?: boolean | null
          description_longue?: string | null
        }
        Relationships: []
      }
      reparations_forge: {
        Row: {
          id: string
          categorie: string
          nom_affichage: string
          temps_minutes: number
          temps_rare_minutes: number
          materiaux: string
          materiaux_rares: string
          notes: string | null
          est_actif: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          categorie?: string | null
          nom_affichage?: string | null
          temps_minutes?: number | null
          temps_rare_minutes?: number | null
          materiaux?: string | null
          materiaux_rares?: string | null
          notes?: string | null
          est_actif?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          categorie?: string | null
          nom_affichage?: string | null
          temps_minutes?: number | null
          temps_rare_minutes?: number | null
          materiaux?: string | null
          materiaux_rares?: string | null
          notes?: string | null
          est_actif?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sections_encyclopedie: {
        Row: {
          id: string
          cle: string
          label: string
          icon_nom: string
          url_key: string
          ordre: number
          est_actif: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string | null
          cle?: string | null
          label?: string | null
          icon_nom?: string | null
          url_key?: string | null
          ordre?: number | null
          est_actif?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          cle?: string | null
          label?: string | null
          icon_nom?: string | null
          url_key?: string | null
          ordre?: number | null
          est_actif?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sections_regles: {
        Row: {
          id: string
          categorie: string
          titre: string
          contenu: string
          ordre: number
          est_actif: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string | null
          categorie?: string | null
          titre?: string | null
          contenu?: string | null
          ordre?: number | null
          est_actif?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          categorie?: string | null
          titre?: string | null
          contenu?: string | null
          ordre?: number | null
          est_actif?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sorts: {
        Row: {
          id: string
          nom: string
          cercle: string
          niveau: number
          description: string | null
          type_sort: string | null
          zone_effet: string | null
          portee: string | null
          duree: string | null
          cout_xp_base: number | null
          est_actif: boolean
        }
        Insert: {
          id?: string | null
          nom?: string | null
          cercle?: string | null
          niveau?: number | null
          description?: string | null
          type_sort?: string | null
          zone_effet?: string | null
          portee?: string | null
          duree?: string | null
          cout_xp_base?: number | null
          est_actif?: boolean | null
        }
        Update: {
          id?: string | null
          nom?: string | null
          cercle?: string | null
          niveau?: number | null
          description?: string | null
          type_sort?: string | null
          zone_effet?: string | null
          portee?: string | null
          duree?: string | null
          cout_xp_base?: number | null
          est_actif?: boolean | null
        }
        Relationships: []
      }
      traits_raciaux: {
        Row: {
          id: string
          nom: string
          description: string
          cout_xp: number
          est_actif: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string | null
          nom?: string | null
          description?: string | null
          cout_xp?: number | null
          est_actif?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          nom?: string | null
          description?: string | null
          cout_xp?: number | null
          est_actif?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vue_admin_joueurs: {
        Row: {
          joueur_id: string | null
          username: string | null
          email: string | null
          nom_affichage: string | null
          role: string | null
          is_active: boolean | null
          compte_cree_le: string | null
          nb_personnages_actifs: number | null
          nb_personnages_morts: number | null
          nb_personnages_archives: number | null
          nb_personnages_total: number | null
          personnage_actif_principal: string | null
        }
        Insert: {
          joueur_id?: string | null
          username?: string | null
          email?: string | null
          nom_affichage?: string | null
          role?: string | null
          is_active?: boolean | null
          compte_cree_le?: string | null
          nb_personnages_actifs?: number | null
          nb_personnages_morts?: number | null
          nb_personnages_archives?: number | null
          nb_personnages_total?: number | null
          personnage_actif_principal?: string | null
        }
        Update: {
          joueur_id?: string | null
          username?: string | null
          email?: string | null
          nom_affichage?: string | null
          role?: string | null
          is_active?: boolean | null
          compte_cree_le?: string | null
          nb_personnages_actifs?: number | null
          nb_personnages_morts?: number | null
          nb_personnages_archives?: number | null
          nb_personnages_total?: number | null
          personnage_actif_principal?: string | null
        }
        Relationships: []
      }
      vue_artisanat_etat: {
        Row: {
          personnage_id: string | null
          niveau_alchimie: number | null
          niveau_forge: number | null
          niveau_joaillerie: number | null
          niveau_runes: number | null
          a_forge_legendaire: boolean | null
          a_joaillerie_legendaire: boolean | null
        }
        Insert: {
          personnage_id?: string | null
          niveau_alchimie?: number | null
          niveau_forge?: number | null
          niveau_joaillerie?: number | null
          niveau_runes?: number | null
          a_forge_legendaire?: boolean | null
          a_joaillerie_legendaire?: boolean | null
        }
        Update: {
          personnage_id?: string | null
          niveau_alchimie?: number | null
          niveau_forge?: number | null
          niveau_joaillerie?: number | null
          niveau_runes?: number | null
          a_forge_legendaire?: boolean | null
          a_joaillerie_legendaire?: boolean | null
        }
        Relationships: []
      }
      vue_artisanat_quotas: {
        Row: {
          personnage_id: string | null
          niveau_alchimie: number | null
          niveau_forge: number | null
          niveau_joaillerie: number | null
          niveau_runes: number | null
          a_forge_legendaire: boolean | null
          a_joaillerie_legendaire: boolean | null
          quota_recettes_total: number | null
          quota_assemblages_total: number | null
          quota_alchimie_mineure_total: number | null
          quota_alchimie_intermediaire_total: number | null
          quota_alchimie_majeure_total: number | null
          quota_alchimie_mineure_utilises: number | null
          quota_alchimie_intermediaire_utilises: number | null
          quota_alchimie_majeure_utilises: number | null
          quota_assemblages_utilises: number | null
        }
        Insert: {
          personnage_id?: string | null
          niveau_alchimie?: number | null
          niveau_forge?: number | null
          niveau_joaillerie?: number | null
          niveau_runes?: number | null
          a_forge_legendaire?: boolean | null
          a_joaillerie_legendaire?: boolean | null
          quota_recettes_total?: number | null
          quota_assemblages_total?: number | null
          quota_alchimie_mineure_total?: number | null
          quota_alchimie_intermediaire_total?: number | null
          quota_alchimie_majeure_total?: number | null
          quota_alchimie_mineure_utilises?: number | null
          quota_alchimie_intermediaire_utilises?: number | null
          quota_alchimie_majeure_utilises?: number | null
          quota_assemblages_utilises?: number | null
        }
        Update: {
          personnage_id?: string | null
          niveau_alchimie?: number | null
          niveau_forge?: number | null
          niveau_joaillerie?: number | null
          niveau_runes?: number | null
          a_forge_legendaire?: boolean | null
          a_joaillerie_legendaire?: boolean | null
          quota_recettes_total?: number | null
          quota_assemblages_total?: number | null
          quota_alchimie_mineure_total?: number | null
          quota_alchimie_intermediaire_total?: number | null
          quota_alchimie_majeure_total?: number | null
          quota_alchimie_mineure_utilises?: number | null
          quota_alchimie_intermediaire_utilises?: number | null
          quota_alchimie_majeure_utilises?: number | null
          quota_assemblages_utilises?: number | null
        }
        Relationships: []
      }
      vue_cercles_disponibles: {
        Row: {
          personnage_id: string | null
          cercle: string | null
          niveau_max_sorts: number | null
        }
        Insert: {
          personnage_id?: string | null
          cercle?: string | null
          niveau_max_sorts?: number | null
        }
        Update: {
          personnage_id?: string | null
          cercle?: string | null
          niveau_max_sorts?: number | null
        }
        Relationships: []
      }
      vue_competences_maitre_admin: {
        Row: {
          id: string | null
          personnage_nom: string | null
          joueur_nom: string | null
          competence_nom: string | null
          niveau_acquis: number | null
          nom_maitre: string | null
          statut_maitre: string | null
          date_demande: string | null
        }
        Insert: {
          id?: string | null
          personnage_nom?: string | null
          joueur_nom?: string | null
          competence_nom?: string | null
          niveau_acquis?: number | null
          nom_maitre?: string | null
          statut_maitre?: string | null
          date_demande?: string | null
        }
        Update: {
          id?: string | null
          personnage_nom?: string | null
          joueur_nom?: string | null
          competence_nom?: string | null
          niveau_acquis?: number | null
          nom_maitre?: string | null
          statut_maitre?: string | null
          date_demande?: string | null
        }
        Relationships: []
      }
      vue_competences_maitre_attente: {
        Row: {
          id: string | null
          niveau_acquis: number | null
          nom_maitre: string | null
          statut_maitre: string | null
          xp_depense: number | null
          personnage_id: string | null
          competence_nom: string | null
          competence_description: string | null
          personnage_nom: string | null
          personnage_niveau: number | null
          joueur_nom: string | null
          joueur_id: string | null
        }
        Insert: {
          id?: string | null
          niveau_acquis?: number | null
          nom_maitre?: string | null
          statut_maitre?: string | null
          xp_depense?: number | null
          personnage_id?: string | null
          competence_nom?: string | null
          competence_description?: string | null
          personnage_nom?: string | null
          personnage_niveau?: number | null
          joueur_nom?: string | null
          joueur_id?: string | null
        }
        Update: {
          id?: string | null
          niveau_acquis?: number | null
          nom_maitre?: string | null
          statut_maitre?: string | null
          xp_depense?: number | null
          personnage_id?: string | null
          competence_nom?: string | null
          competence_description?: string | null
          personnage_nom?: string | null
          personnage_niveau?: number | null
          joueur_nom?: string | null
          joueur_id?: string | null
        }
        Relationships: []
      }
      vue_demandes_races_attente: {
        Row: {
          id: string | null
          personnage_id: string | null
          personnage_nom: string | null
          personnage_niveau: number | null
          joueur_id: string | null
          joueur_nom: string | null
          joueur_email: string | null
          race_id: string | null
          race_nom: string | null
          race_nom_latin: string | null
          background: string | null
          date_demande: string | null
        }
        Insert: {
          id?: string | null
          personnage_id?: string | null
          personnage_nom?: string | null
          personnage_niveau?: number | null
          joueur_id?: string | null
          joueur_nom?: string | null
          joueur_email?: string | null
          race_id?: string | null
          race_nom?: string | null
          race_nom_latin?: string | null
          background?: string | null
          date_demande?: string | null
        }
        Update: {
          id?: string | null
          personnage_id?: string | null
          personnage_nom?: string | null
          personnage_niveau?: number | null
          joueur_id?: string | null
          joueur_nom?: string | null
          joueur_email?: string | null
          race_id?: string | null
          race_nom?: string | null
          race_nom_latin?: string | null
          background?: string | null
          date_demande?: string | null
        }
        Relationships: []
      }
      vue_demandes_races_complet: {
        Row: {
          id: string | null
          personnage_id: string | null
          personnage_nom: string | null
          personnage_niveau: number | null
          joueur_id: string | null
          joueur_nom: string | null
          joueur_email: string | null
          race_id: string | null
          race_nom: string | null
          race_nom_latin: string | null
          background: string | null
          statut: string | null
          raison_refus: string | null
          approuve_par: string | null
          approuve_par_nom: string | null
          date_demande: string | null
          date_approbation: string | null
        }
        Insert: {
          id?: string | null
          personnage_id?: string | null
          personnage_nom?: string | null
          personnage_niveau?: number | null
          joueur_id?: string | null
          joueur_nom?: string | null
          joueur_email?: string | null
          race_id?: string | null
          race_nom?: string | null
          race_nom_latin?: string | null
          background?: string | null
          statut?: string | null
          raison_refus?: string | null
          approuve_par?: string | null
          approuve_par_nom?: string | null
          date_demande?: string | null
          date_approbation?: string | null
        }
        Update: {
          id?: string | null
          personnage_id?: string | null
          personnage_nom?: string | null
          personnage_niveau?: number | null
          joueur_id?: string | null
          joueur_nom?: string | null
          joueur_email?: string | null
          race_id?: string | null
          race_nom?: string | null
          race_nom_latin?: string | null
          background?: string | null
          statut?: string | null
          raison_refus?: string | null
          approuve_par?: string | null
          approuve_par_nom?: string | null
          date_demande?: string | null
          date_approbation?: string | null
        }
        Relationships: []
      }
      vue_domaines_disponibles: {
        Row: {
          personnage_id: string | null
          domaine: string | null
          niveau_max_prieres: number | null
        }
        Insert: {
          personnage_id?: string | null
          domaine?: string | null
          niveau_max_prieres?: number | null
        }
        Update: {
          personnage_id?: string | null
          domaine?: string | null
          niveau_max_prieres?: number | null
        }
        Relationships: []
      }
      vue_evenements_admin: {
        Row: {
          id: string | null
          titre: string | null
          description: string | null
          date_debut: string | null
          date_fin: string | null
          lieu: string | null
          nb_participants: number | null
          est_publie: boolean | null
        }
        Insert: {
          id?: string | null
          titre?: string | null
          description?: string | null
          date_debut?: string | null
          date_fin?: string | null
          lieu?: string | null
          nb_participants?: number | null
          est_publie?: boolean | null
        }
        Update: {
          id?: string | null
          titre?: string | null
          description?: string | null
          date_debut?: string | null
          date_fin?: string | null
          lieu?: string | null
          nb_participants?: number | null
          est_publie?: boolean | null
        }
        Relationships: []
      }
      vue_inscriptions_par_evenement: {
        Row: {
          inscription_id: string | null
          evenement_id: string | null
          statut: string | null
          xp_attribue: number | null
          date_inscription: string | null
          date_confirmation: string | null
          evenement_titre: string | null
          date_evenement: string | null
          type_evenement: string | null
          personnage_id: string | null
          personnage_nom: string | null
          personnage_niveau: number | null
          pv_max: number | null
          ps_max: number | null
          est_mort: boolean | null
          est_actif: boolean | null
          est_verrouille: boolean | null
          race_nom: string | null
          classe_nom: string | null
          joueur_id: string | null
          joueur_nom: string | null
          joueur_email: string | null
          joueur_username: string | null
        }
        Insert: {
          inscription_id?: string | null
          evenement_id?: string | null
          statut?: string | null
          xp_attribue?: number | null
          date_inscription?: string | null
          date_confirmation?: string | null
          evenement_titre?: string | null
          date_evenement?: string | null
          type_evenement?: string | null
          personnage_id?: string | null
          personnage_nom?: string | null
          personnage_niveau?: number | null
          pv_max?: number | null
          ps_max?: number | null
          est_mort?: boolean | null
          est_actif?: boolean | null
          est_verrouille?: boolean | null
          race_nom?: string | null
          classe_nom?: string | null
          joueur_id?: string | null
          joueur_nom?: string | null
          joueur_email?: string | null
          joueur_username?: string | null
        }
        Update: {
          inscription_id?: string | null
          evenement_id?: string | null
          statut?: string | null
          xp_attribue?: number | null
          date_inscription?: string | null
          date_confirmation?: string | null
          evenement_titre?: string | null
          date_evenement?: string | null
          type_evenement?: string | null
          personnage_id?: string | null
          personnage_nom?: string | null
          personnage_niveau?: number | null
          pv_max?: number | null
          ps_max?: number | null
          est_mort?: boolean | null
          est_actif?: boolean | null
          est_verrouille?: boolean | null
          race_nom?: string | null
          classe_nom?: string | null
          joueur_id?: string | null
          joueur_nom?: string | null
          joueur_email?: string | null
          joueur_username?: string | null
        }
        Relationships: []
      }
      vue_inscriptions_resumees: {
        Row: {
          id: string | null
          joueur_id: string | null
          personnage_id: string | null
          evenement_id: string | null
          statut: string | null
          xp_attribue: number | null
          date_inscription: string | null
          evenement_titre: string | null
          date_evenement: string | null
          date_fin: string | null
          lieu: string | null
          type_evenement: string | null
          xp_recompense: number | null
          max_participants: number | null
          personnage_nom: string | null
          joueur_nom: string | null
          nb_inscrits_confirmes: number | null
        }
        Insert: {
          id?: string | null
          joueur_id?: string | null
          personnage_id?: string | null
          evenement_id?: string | null
          statut?: string | null
          xp_attribue?: number | null
          date_inscription?: string | null
          evenement_titre?: string | null
          date_evenement?: string | null
          date_fin?: string | null
          lieu?: string | null
          type_evenement?: string | null
          xp_recompense?: number | null
          max_participants?: number | null
          personnage_nom?: string | null
          joueur_nom?: string | null
          nb_inscrits_confirmes?: number | null
        }
        Update: {
          id?: string | null
          joueur_id?: string | null
          personnage_id?: string | null
          evenement_id?: string | null
          statut?: string | null
          xp_attribue?: number | null
          date_inscription?: string | null
          evenement_titre?: string | null
          date_evenement?: string | null
          date_fin?: string | null
          lieu?: string | null
          type_evenement?: string | null
          xp_recompense?: number | null
          max_participants?: number | null
          personnage_nom?: string | null
          joueur_nom?: string | null
          nb_inscrits_confirmes?: number | null
        }
        Relationships: []
      }
      vue_joueurs_complete: {
        Row: {
          joueur_id: string | null
          username: string | null
          email: string | null
          nom_affichage: string | null
          role: string | null
          is_active: boolean | null
          compte_cree_le: string | null
          nb_personnages_actifs: number | null
          nb_personnages_morts: number | null
          nb_personnages_archives: number | null
          nb_personnages_total: number | null
          personnage_actif_principal: string | null
        }
        Insert: {
          joueur_id?: string | null
          username?: string | null
          email?: string | null
          nom_affichage?: string | null
          role?: string | null
          is_active?: boolean | null
          compte_cree_le?: string | null
          nb_personnages_actifs?: number | null
          nb_personnages_morts?: number | null
          nb_personnages_archives?: number | null
          nb_personnages_total?: number | null
          personnage_actif_principal?: string | null
        }
        Update: {
          joueur_id?: string | null
          username?: string | null
          email?: string | null
          nom_affichage?: string | null
          role?: string | null
          is_active?: boolean | null
          compte_cree_le?: string | null
          nb_personnages_actifs?: number | null
          nb_personnages_morts?: number | null
          nb_personnages_archives?: number | null
          nb_personnages_total?: number | null
          personnage_actif_principal?: string | null
        }
        Relationships: []
      }
      vue_joueurs_maitres: {
        Row: {
          joueur_id: string | null
          joueur_nom: string | null
          personnage_id: string | null
          personnage_nom: string | null
          race: string | null
          classe: string | null
          niveau: number | null
          xp_total: number | null
        }
        Insert: {
          joueur_id?: string | null
          joueur_nom?: string | null
          personnage_id?: string | null
          personnage_nom?: string | null
          race?: string | null
          classe?: string | null
          niveau?: number | null
          xp_total?: number | null
        }
        Update: {
          joueur_id?: string | null
          joueur_nom?: string | null
          personnage_id?: string | null
          personnage_nom?: string | null
          race?: string | null
          classe?: string | null
          niveau?: number | null
          xp_total?: number | null
        }
        Relationships: []
      }
      vue_personnage_etat: {
        Row: {
          personnage_id: string | null
          joueur_id: string | null
          xp_disponible: number | null
          niveau: number | null
          niveau_alchimie: number | null
          niveau_forge: number | null
          niveau_joaillerie: number | null
          niveau_runes: number | null
          niveau_cercle: number | null
          niveau_domaine: number | null
          a_connaissance_religions: boolean | null
          a_premiers_soins: boolean | null
          a_connaissance_creatures_1: boolean | null
          a_connaissance_creatures_2: boolean | null
        }
        Insert: {
          personnage_id?: string | null
          joueur_id?: string | null
          xp_disponible?: number | null
          niveau?: number | null
          niveau_alchimie?: number | null
          niveau_forge?: number | null
          niveau_joaillerie?: number | null
          niveau_runes?: number | null
          niveau_cercle?: number | null
          niveau_domaine?: number | null
          a_connaissance_religions?: boolean | null
          a_premiers_soins?: boolean | null
          a_connaissance_creatures_1?: boolean | null
          a_connaissance_creatures_2?: boolean | null
        }
        Update: {
          personnage_id?: string | null
          joueur_id?: string | null
          xp_disponible?: number | null
          niveau?: number | null
          niveau_alchimie?: number | null
          niveau_forge?: number | null
          niveau_joaillerie?: number | null
          niveau_runes?: number | null
          niveau_cercle?: number | null
          niveau_domaine?: number | null
          a_connaissance_religions?: boolean | null
          a_premiers_soins?: boolean | null
          a_connaissance_creatures_1?: boolean | null
          a_connaissance_creatures_2?: boolean | null
        }
        Relationships: []
      }
      vue_personnages_admin: {
        Row: {
          id: string | null
          nom: string | null
          joueur_nom: string | null
          race_nom: string | null
          classe_nom: string | null
          niveau: number | null
          est_actif: boolean | null
          etape_creation: number | null
          created_at: string | null
        }
        Insert: {
          id?: string | null
          nom?: string | null
          joueur_nom?: string | null
          race_nom?: string | null
          classe_nom?: string | null
          niveau?: number | null
          est_actif?: boolean | null
          etape_creation?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string | null
          nom?: string | null
          joueur_nom?: string | null
          race_nom?: string | null
          classe_nom?: string | null
          niveau?: number | null
          est_actif?: boolean | null
          etape_creation?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      vue_prochain_evenement: {
        Row: {
          id: string | null
          titre: string | null
          description: string | null
          date_evenement: string | null
          date_fin: string | null
          lieu: string | null
          xp_recompense: number | null
          max_participants: number | null
          type_evenement: string | null
          est_publie: boolean | null
          created_by: string | null
          nb_inscrits: number | null
          places_restantes: number | null
        }
        Insert: {
          id?: string | null
          titre?: string | null
          description?: string | null
          date_evenement?: string | null
          date_fin?: string | null
          lieu?: string | null
          xp_recompense?: number | null
          max_participants?: number | null
          type_evenement?: string | null
          est_publie?: boolean | null
          created_by?: string | null
          nb_inscrits?: number | null
          places_restantes?: number | null
        }
        Update: {
          id?: string | null
          titre?: string | null
          description?: string | null
          date_evenement?: string | null
          date_fin?: string | null
          lieu?: string | null
          xp_recompense?: number | null
          max_participants?: number | null
          type_evenement?: string | null
          est_publie?: boolean | null
          created_by?: string | null
          nb_inscrits?: number | null
          places_restantes?: number | null
        }
        Relationships: []
      }
      vue_stats_admin: {
        Row: {
          nb_joueurs: number | null
          nb_personnages_actifs: number | null
          nb_presences_attente: number | null
          nb_competences_attente: number | null
          prochain_evenement_titre: string | null
          prochain_evenement_date: string | null
        }
        Insert: {
          nb_joueurs?: number | null
          nb_personnages_actifs?: number | null
          nb_presences_attente?: number | null
          nb_competences_attente?: number | null
          prochain_evenement_titre?: string | null
          prochain_evenement_date?: string | null
        }
        Update: {
          nb_joueurs?: number | null
          nb_personnages_actifs?: number | null
          nb_presences_attente?: number | null
          nb_competences_attente?: number | null
          prochain_evenement_titre?: string | null
          prochain_evenement_date?: string | null
        }
        Relationships: []
      }
      vue_tableau_de_bord: {
        Row: {
          id: string | null
          joueur_id: string | null
          nom: string | null
          niveau: number | null
          xp_total: number | null
          xp_depense: number | null
          est_mort: boolean | null
          est_actif: boolean | null
          date_creation: string | null
          race_nom: string | null
          classe_nom: string | null
          classe_secondaire_nom: string | null
          joueur_email: string | null
        }
        Insert: {
          id?: string | null
          joueur_id?: string | null
          nom?: string | null
          niveau?: number | null
          xp_total?: number | null
          xp_depense?: number | null
          est_mort?: boolean | null
          est_actif?: boolean | null
          date_creation?: string | null
          race_nom?: string | null
          classe_nom?: string | null
          classe_secondaire_nom?: string | null
          joueur_email?: string | null
        }
        Update: {
          id?: string | null
          joueur_id?: string | null
          nom?: string | null
          niveau?: number | null
          xp_total?: number | null
          xp_depense?: number | null
          est_mort?: boolean | null
          est_actif?: boolean | null
          date_creation?: string | null
          race_nom?: string | null
          classe_nom?: string | null
          classe_secondaire_nom?: string | null
          joueur_email?: string | null
        }
        Relationships: []
      }
      vue_traits_par_race: {
        Row: {
          race_trait_id: string | null
          race_id: string | null
          trait_id: string | null
          sous_type: string | null
          race_nom: string | null
          trait_nom: string | null
          trait_description: string | null
          cout_xp: number | null
          est_actif: boolean | null
        }
        Insert: {
          race_trait_id?: string | null
          race_id?: string | null
          trait_id?: string | null
          sous_type?: string | null
          race_nom?: string | null
          trait_nom?: string | null
          trait_description?: string | null
          cout_xp?: number | null
          est_actif?: boolean | null
        }
        Update: {
          race_trait_id?: string | null
          race_id?: string | null
          trait_id?: string | null
          sous_type?: string | null
          race_nom?: string | null
          trait_nom?: string | null
          trait_description?: string | null
          cout_xp?: number | null
          est_actif?: boolean | null
        }
        Relationships: []
      }
      vue_verrou_competences: {
        Row: {
          personnage_id: string | null
          runes_verrouillees: boolean | null
          dev_spirituel_verrouille: boolean | null
          dev_spirituel_sup_verrouille: boolean | null
          canalisation_verrouillee: boolean | null
        }
        Insert: {
          personnage_id?: string | null
          runes_verrouillees?: boolean | null
          dev_spirituel_verrouille?: boolean | null
          dev_spirituel_sup_verrouille?: boolean | null
          canalisation_verrouillee?: boolean | null
        }
        Update: {
          personnage_id?: string | null
          runes_verrouillees?: boolean | null
          dev_spirituel_verrouille?: boolean | null
          dev_spirituel_sup_verrouille?: boolean | null
          canalisation_verrouillee?: boolean | null
        }
        Relationships: []
      }
      vue_xp_personnage: {
        Row: {
          id: string | null
          nom: string | null
          joueur_id: string | null
          xp_total: number | null
          xp_depense: number | null
          xp_disponible: number | null
          niveau: number | null
          pv_max: number | null
          ps_max: number | null
          est_actif: boolean | null
          est_mort: boolean | null
          est_verrouille: boolean | null
          etape_creation: number | null
          gn_completes: number | null
          mini_gn_completes: number | null
          ouvertures_terrain: number | null
          race_nom: string | null
          race_latin: string | null
          classe_nom: string | null
          pv_depart: number | null
          ps_depart: number | null
          religion_nom: string | null
          famille_nom: string | null
          joueur_nom: string | null
        }
        Insert: {
          id?: string | null
          nom?: string | null
          joueur_id?: string | null
          xp_total?: number | null
          xp_depense?: number | null
          xp_disponible?: number | null
          niveau?: number | null
          pv_max?: number | null
          ps_max?: number | null
          est_actif?: boolean | null
          est_mort?: boolean | null
          est_verrouille?: boolean | null
          etape_creation?: number | null
          gn_completes?: number | null
          mini_gn_completes?: number | null
          ouvertures_terrain?: number | null
          race_nom?: string | null
          race_latin?: string | null
          classe_nom?: string | null
          pv_depart?: number | null
          ps_depart?: number | null
          religion_nom?: string | null
          famille_nom?: string | null
          joueur_nom?: string | null
        }
        Update: {
          id?: string | null
          nom?: string | null
          joueur_id?: string | null
          xp_total?: number | null
          xp_depense?: number | null
          xp_disponible?: number | null
          niveau?: number | null
          pv_max?: number | null
          ps_max?: number | null
          est_actif?: boolean | null
          est_mort?: boolean | null
          est_verrouille?: boolean | null
          etape_creation?: number | null
          gn_completes?: number | null
          mini_gn_completes?: number | null
          ouvertures_terrain?: number | null
          race_nom?: string | null
          race_latin?: string | null
          classe_nom?: string | null
          pv_depart?: number | null
          ps_depart?: number | null
          religion_nom?: string | null
          famille_nom?: string | null
          joueur_nom?: string | null
        }
        Relationships: []
      }
    }
    Views: {
    }
    Functions: {
    }
    Enums: {
    }
    CompositeTypes: {
    }
  }
}