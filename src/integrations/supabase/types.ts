export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assemblages_runes: {
        Row: {
          cible: string | null
          cout_ps: number | null
          cout_ps_maitrise: number | null
          cout_xp: number | null
          description: string | null
          description_longue: string | null
          effet: string | null
          effet_maitrise: string | null
          est_actif: boolean | null
          id: string
          nom: string | null
          runes_requises: string[] | null
        }
        Insert: {
          cible?: string | null
          cout_ps?: number | null
          cout_ps_maitrise?: number | null
          cout_xp?: number | null
          description?: string | null
          description_longue?: string | null
          effet?: string | null
          effet_maitrise?: string | null
          est_actif?: boolean | null
          id?: string
          nom?: string | null
          runes_requises?: string[] | null
        }
        Update: {
          cible?: string | null
          cout_ps?: number | null
          cout_ps_maitrise?: number | null
          cout_xp?: number | null
          description?: string | null
          description_longue?: string | null
          effet?: string | null
          effet_maitrise?: string | null
          est_actif?: boolean | null
          id?: string
          nom?: string | null
          runes_requises?: string[] | null
        }
        Relationships: []
      }
      bestiaire: {
        Row: {
          capacites_speciales: string | null
          categorie: string
          created_at: string | null
          description: string
          est_actif: boolean | null
          id: string
          immunites: string | null
          nom: string
          pv_formule: string | null
          updated_at: string | null
        }
        Insert: {
          capacites_speciales?: string | null
          categorie: string
          created_at?: string | null
          description: string
          est_actif?: boolean | null
          id?: string
          immunites?: string | null
          nom: string
          pv_formule?: string | null
          updated_at?: string | null
        }
        Update: {
          capacites_speciales?: string | null
          categorie?: string
          created_at?: string | null
          description?: string
          est_actif?: boolean | null
          id?: string
          immunites?: string | null
          nom?: string
          pv_formule?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cartes_accueil: {
        Row: {
          created_at: string | null
          description: string
          emoji: string
          est_actif: boolean
          id: string
          ordre: number
          tab_cible: string
          titre: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          emoji: string
          est_actif?: boolean
          id?: string
          ordre?: number
          tab_cible: string
          titre: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          emoji?: string
          est_actif?: boolean
          id?: string
          ordre?: number
          tab_cible?: string
          titre?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      categories_creatures: {
        Row: {
          created_at: string | null
          est_actif: boolean
          id: string
          nom: string
          ordre: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          est_actif?: boolean
          id?: string
          nom: string
          ordre?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          est_actif?: boolean
          id?: string
          nom?: string
          ordre?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      classes: {
        Row: {
          competences_gratuites: Json | null
          description: string | null
          est_actif: boolean | null
          id: string
          nom: string | null
          peut_utiliser_armes_deux_mains: boolean | null
          ps_depart: number | null
          pv_depart: number | null
          role_combat: string | null
        }
        Insert: {
          competences_gratuites?: Json | null
          description?: string | null
          est_actif?: boolean | null
          id?: string
          nom?: string | null
          peut_utiliser_armes_deux_mains?: boolean | null
          ps_depart?: number | null
          pv_depart?: number | null
          role_combat?: string | null
        }
        Update: {
          competences_gratuites?: Json | null
          description?: string | null
          est_actif?: boolean | null
          id?: string
          nom?: string | null
          peut_utiliser_armes_deux_mains?: boolean | null
          ps_depart?: number | null
          pv_depart?: number | null
          role_combat?: string | null
        }
        Relationships: []
      }
      competences: {
        Row: {
          categorie: string | null
          description: string | null
          est_actif: boolean | null
          est_general: boolean | null
          id: string
          niveaux: Json | null
          nom: string | null
          type_achat: string
          type_choix: string | null
          verrouillage_croise: boolean
        }
        Insert: {
          categorie?: string | null
          description?: string | null
          est_actif?: boolean | null
          est_general?: boolean | null
          id?: string
          niveaux?: Json | null
          nom?: string | null
          type_achat?: string
          type_choix?: string | null
          verrouillage_croise?: boolean
        }
        Update: {
          categorie?: string | null
          description?: string | null
          est_actif?: boolean | null
          est_general?: boolean | null
          id?: string
          niveaux?: Json | null
          nom?: string | null
          type_achat?: string
          type_choix?: string | null
          verrouillage_croise?: boolean
        }
        Relationships: []
      }
      config_jeu: {
        Row: {
          cle: string | null
          id: string
          valeur: Json | null
        }
        Insert: {
          cle?: string | null
          id?: string
          valeur?: Json | null
        }
        Update: {
          cle?: string | null
          id?: string
          valeur?: Json | null
        }
        Relationships: []
      }
      effets_combat: {
        Row: {
          conditions: string | null
          description: string | null
          duree: string | null
          id: string
          nom: string | null
          source: string | null
          type: string | null
        }
        Insert: {
          conditions?: string | null
          description?: string | null
          duree?: string | null
          id?: string
          nom?: string | null
          source?: string | null
          type?: string | null
        }
        Update: {
          conditions?: string | null
          description?: string | null
          duree?: string | null
          id?: string
          nom?: string | null
          source?: string | null
          type?: string | null
        }
        Relationships: []
      }
      evenements: {
        Row: {
          created_at: string | null
          created_by: string | null
          date_evenement: string | null
          date_fin: string | null
          description: string | null
          est_publie: boolean | null
          id: string
          lieu: string | null
          max_participants: number | null
          titre: string | null
          type_evenement: string | null
          updated_at: string | null
          xp_recompense: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date_evenement?: string | null
          date_fin?: string | null
          description?: string | null
          est_publie?: boolean | null
          id?: string
          lieu?: string | null
          max_participants?: number | null
          titre?: string | null
          type_evenement?: string | null
          updated_at?: string | null
          xp_recompense?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date_evenement?: string | null
          date_fin?: string | null
          description?: string | null
          est_publie?: boolean | null
          id?: string
          lieu?: string | null
          max_participants?: number | null
          titre?: string | null
          type_evenement?: string | null
          updated_at?: string | null
          xp_recompense?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evenements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evenements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vue_competences_maitre_attente"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "evenements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "evenements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_complete"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "evenements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_maitres"
            referencedColumns: ["joueur_id"]
          },
        ]
      }
      familles_criminelles: {
        Row: {
          avantages: string | null
          description: string | null
          description_longue: string | null
          est_actif: boolean | null
          id: string
          nom: string | null
        }
        Insert: {
          avantages?: string | null
          description?: string | null
          description_longue?: string | null
          est_actif?: boolean | null
          id?: string
          nom?: string | null
        }
        Update: {
          avantages?: string | null
          description?: string | null
          description_longue?: string | null
          est_actif?: boolean | null
          id?: string
          nom?: string | null
        }
        Relationships: []
      }
      ingredients_alchimiques: {
        Row: {
          id: string
          manipulations: string | null
          niveau: number | null
          nom: string | null
        }
        Insert: {
          id: string
          manipulations?: string | null
          niveau?: number | null
          nom?: string | null
        }
        Update: {
          id?: string
          manipulations?: string | null
          niveau?: number | null
          nom?: string | null
        }
        Relationships: []
      }
      inscriptions_evenements: {
        Row: {
          date_confirmation: string | null
          date_inscription: string | null
          evenement_id: string | null
          id: string
          joueur_id: string | null
          personnage_id: string | null
          statut: string | null
          updated_at: string | null
          xp_attribue: number | null
        }
        Insert: {
          date_confirmation?: string | null
          date_inscription?: string | null
          evenement_id?: string | null
          id?: string
          joueur_id?: string | null
          personnage_id?: string | null
          statut?: string | null
          updated_at?: string | null
          xp_attribue?: number | null
        }
        Update: {
          date_confirmation?: string | null
          date_inscription?: string | null
          evenement_id?: string | null
          id?: string
          joueur_id?: string | null
          personnage_id?: string | null
          statut?: string | null
          updated_at?: string | null
          xp_attribue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inscriptions_evenements_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "evenements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "vue_evenements_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "vue_prochain_evenement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_competences_maitre_attente"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_complete"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_maitres"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "personnages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_quotas"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_maitres"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_verrou_competences"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_xp_personnage"
            referencedColumns: ["id"]
          },
        ]
      }
      langues: {
        Row: {
          created_at: string | null
          est_actif: boolean
          est_ancienne: boolean
          id: string
          nom: string
          ordre: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          est_actif?: boolean
          est_ancienne?: boolean
          id?: string
          nom: string
          ordre?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          est_actif?: boolean
          est_ancienne?: boolean
          id?: string
          nom?: string
          ordre?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      lore: {
        Row: {
          categorie: string
          created_at: string | null
          description: string
          embleme: string | null
          est_actif: boolean | null
          id: string
          nom: string
          ordre: number | null
          sous_titre: string | null
          updated_at: string | null
        }
        Insert: {
          categorie: string
          created_at?: string | null
          description: string
          embleme?: string | null
          est_actif?: boolean | null
          id?: string
          nom: string
          ordre?: number | null
          sous_titre?: string | null
          updated_at?: string | null
        }
        Update: {
          categorie?: string
          created_at?: string | null
          description?: string
          embleme?: string | null
          est_actif?: boolean | null
          id?: string
          nom?: string
          ordre?: number | null
          sous_titre?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      menu_navigation: {
        Row: {
          afficher_footer: boolean
          afficher_navbar: boolean
          created_at: string | null
          est_actif: boolean
          id: string
          libelle: string
          ordre: number
          roles_autorises: string[] | null
          updated_at: string | null
          url: string
        }
        Insert: {
          afficher_footer?: boolean
          afficher_navbar?: boolean
          created_at?: string | null
          est_actif?: boolean
          id?: string
          libelle: string
          ordre?: number
          roles_autorises?: string[] | null
          updated_at?: string | null
          url: string
        }
        Update: {
          afficher_footer?: boolean
          afficher_navbar?: boolean
          created_at?: string | null
          est_actif?: boolean
          id?: string
          libelle?: string
          ordre?: number
          roles_autorises?: string[] | null
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          lu: boolean | null
          message: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lu?: boolean | null
          message?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lu?: boolean | null
          message?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vue_competences_maitre_attente"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_complete"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_maitres"
            referencedColumns: ["joueur_id"]
          },
        ]
      }
      objets_forge: {
        Row: {
          cout_xp: number | null
          description: string | null
          difficulte: number | null
          est_actif: boolean | null
          id: string
          nom: string | null
          stats: Json | null
          type: string | null
        }
        Insert: {
          cout_xp?: number | null
          description?: string | null
          difficulte?: number | null
          est_actif?: boolean | null
          id?: string
          nom?: string | null
          stats?: Json | null
          type?: string | null
        }
        Update: {
          cout_xp?: number | null
          description?: string | null
          difficulte?: number | null
          est_actif?: boolean | null
          id?: string
          nom?: string | null
          stats?: Json | null
          type?: string | null
        }
        Relationships: []
      }
      objets_joaillerie: {
        Row: {
          cout_xp: number | null
          description: string | null
          difficulte: number | null
          effet: string | null
          est_actif: boolean | null
          id: string
          nom: string | null
        }
        Insert: {
          cout_xp?: number | null
          description?: string | null
          difficulte?: number | null
          effet?: string | null
          est_actif?: boolean | null
          id?: string
          nom?: string | null
        }
        Update: {
          cout_xp?: number | null
          description?: string | null
          difficulte?: number | null
          effet?: string | null
          est_actif?: boolean | null
          id?: string
          nom?: string | null
        }
        Relationships: []
      }
      personnage_assemblages: {
        Row: {
          assemblage_id: string
          date_acquisition: string
          id: string
          personnage_id: string
          xp_depense: number
        }
        Insert: {
          assemblage_id: string
          date_acquisition?: string
          id?: string
          personnage_id: string
          xp_depense?: number
        }
        Update: {
          assemblage_id?: string
          date_acquisition?: string
          id?: string
          personnage_id?: string
          xp_depense?: number
        }
        Relationships: [
          {
            foreignKeyName: "personnage_assemblages_assemblage_id_fkey"
            columns: ["assemblage_id"]
            isOneToOne: false
            referencedRelation: "assemblages_runes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_assemblages_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "personnages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_assemblages_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_assemblages_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_quotas"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_assemblages_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_assemblages_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_maitres"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_assemblages_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_assemblages_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_assemblages_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_verrou_competences"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_assemblages_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_xp_personnage"
            referencedColumns: ["id"]
          },
        ]
      }
      personnage_competences: {
        Row: {
          appris_via_maitre: boolean
          choix_achat: string | null
          competence_id: string
          date_acquisition: string
          id: string
          niveau_acquis: number
          nom_maitre: string | null
          personnage_id: string
          statut_maitre: string | null
          xp_depense: number
        }
        Insert: {
          appris_via_maitre?: boolean
          choix_achat?: string | null
          competence_id: string
          date_acquisition?: string
          id?: string
          niveau_acquis?: number
          nom_maitre?: string | null
          personnage_id: string
          statut_maitre?: string | null
          xp_depense?: number
        }
        Update: {
          appris_via_maitre?: boolean
          choix_achat?: string | null
          competence_id?: string
          date_acquisition?: string
          id?: string
          niveau_acquis?: number
          nom_maitre?: string | null
          personnage_id?: string
          statut_maitre?: string | null
          xp_depense?: number
        }
        Relationships: [
          {
            foreignKeyName: "personnage_competences_competence_id_fkey"
            columns: ["competence_id"]
            isOneToOne: false
            referencedRelation: "competences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "personnages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_quotas"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_maitres"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_verrou_competences"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_xp_personnage"
            referencedColumns: ["id"]
          },
        ]
      }
      personnage_objets_forge: {
        Row: {
          date_acquisition: string
          id: string
          objet_id: string
          personnage_id: string
          xp_depense: number
        }
        Insert: {
          date_acquisition?: string
          id?: string
          objet_id: string
          personnage_id: string
          xp_depense?: number
        }
        Update: {
          date_acquisition?: string
          id?: string
          objet_id?: string
          personnage_id?: string
          xp_depense?: number
        }
        Relationships: [
          {
            foreignKeyName: "personnage_objets_forge_objet_id_fkey"
            columns: ["objet_id"]
            isOneToOne: false
            referencedRelation: "objets_forge"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_objets_forge_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "personnages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_objets_forge_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_objets_forge_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_quotas"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_objets_forge_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_objets_forge_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_maitres"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_objets_forge_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_objets_forge_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_objets_forge_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_verrou_competences"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_objets_forge_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_xp_personnage"
            referencedColumns: ["id"]
          },
        ]
      }
      personnage_objets_joaillerie: {
        Row: {
          date_acquisition: string
          id: string
          objet_id: string
          personnage_id: string
          xp_depense: number
        }
        Insert: {
          date_acquisition?: string
          id?: string
          objet_id: string
          personnage_id: string
          xp_depense?: number
        }
        Update: {
          date_acquisition?: string
          id?: string
          objet_id?: string
          personnage_id?: string
          xp_depense?: number
        }
        Relationships: [
          {
            foreignKeyName: "personnage_objets_joaillerie_objet_id_fkey"
            columns: ["objet_id"]
            isOneToOne: false
            referencedRelation: "objets_joaillerie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_objets_joaillerie_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "personnages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_objets_joaillerie_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_objets_joaillerie_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_quotas"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_objets_joaillerie_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_objets_joaillerie_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_maitres"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_objets_joaillerie_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_objets_joaillerie_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_objets_joaillerie_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_verrou_competences"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_objets_joaillerie_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_xp_personnage"
            referencedColumns: ["id"]
          },
        ]
      }
      personnage_prieres: {
        Row: {
          date_acquisition: string
          duree_choisie: string | null
          duree_incantation_calculee: number | null
          id: string
          niveau_priere: number
          nom_personnalise: string | null
          personnage_id: string
          portee_choisie: string | null
          priere_id: string
          xp_depense: number
          zone_choisie: string | null
        }
        Insert: {
          date_acquisition?: string
          duree_choisie?: string | null
          duree_incantation_calculee?: number | null
          id?: string
          niveau_priere?: number
          nom_personnalise?: string | null
          personnage_id: string
          portee_choisie?: string | null
          priere_id: string
          xp_depense?: number
          zone_choisie?: string | null
        }
        Update: {
          date_acquisition?: string
          duree_choisie?: string | null
          duree_incantation_calculee?: number | null
          id?: string
          niveau_priere?: number
          nom_personnalise?: string | null
          personnage_id?: string
          portee_choisie?: string | null
          priere_id?: string
          xp_depense?: number
          zone_choisie?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personnage_prieres_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "personnages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_prieres_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_prieres_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_quotas"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_prieres_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_prieres_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_maitres"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_prieres_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_prieres_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_prieres_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_verrou_competences"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_prieres_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_xp_personnage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_prieres_priere_id_fkey"
            columns: ["priere_id"]
            isOneToOne: false
            referencedRelation: "prieres"
            referencedColumns: ["id"]
          },
        ]
      }
      personnage_recettes: {
        Row: {
          date_acquisition: string
          id: string
          personnage_id: string
          recette_id: string
          xp_depense: number
        }
        Insert: {
          date_acquisition?: string
          id?: string
          personnage_id: string
          recette_id: string
          xp_depense?: number
        }
        Update: {
          date_acquisition?: string
          id?: string
          personnage_id?: string
          recette_id?: string
          xp_depense?: number
        }
        Relationships: [
          {
            foreignKeyName: "personnage_recettes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "personnages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_recettes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_recettes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_quotas"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_recettes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_recettes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_maitres"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_recettes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_recettes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_recettes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_verrou_competences"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_recettes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_xp_personnage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_recettes_recette_id_fkey"
            columns: ["recette_id"]
            isOneToOne: false
            referencedRelation: "recettes_alchimie"
            referencedColumns: ["id"]
          },
        ]
      }
      personnage_sorts: {
        Row: {
          date_acquisition: string
          duree_choisie: string | null
          formule_magique: string | null
          id: string
          niveau_sort: number
          nom_personnalise: string | null
          personnage_id: string
          portee_choisie: string | null
          sort_id: string
          xp_depense: number
          zone_choisie: string | null
        }
        Insert: {
          date_acquisition?: string
          duree_choisie?: string | null
          formule_magique?: string | null
          id?: string
          niveau_sort?: number
          nom_personnalise?: string | null
          personnage_id: string
          portee_choisie?: string | null
          sort_id: string
          xp_depense?: number
          zone_choisie?: string | null
        }
        Update: {
          date_acquisition?: string
          duree_choisie?: string | null
          formule_magique?: string | null
          id?: string
          niveau_sort?: number
          nom_personnalise?: string | null
          personnage_id?: string
          portee_choisie?: string | null
          sort_id?: string
          xp_depense?: number
          zone_choisie?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personnage_sorts_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "personnages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_sorts_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_sorts_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_quotas"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_sorts_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_sorts_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_maitres"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_sorts_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_sorts_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_sorts_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_verrou_competences"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_sorts_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_xp_personnage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_sorts_sort_id_fkey"
            columns: ["sort_id"]
            isOneToOne: false
            referencedRelation: "sorts"
            referencedColumns: ["id"]
          },
        ]
      }
      personnages: {
        Row: {
          a_forge_legendaire: boolean
          a_joaillerie_legendaire: boolean
          ame_personnage: string | null
          classe_id: string | null
          classe_secondaire_id: string | null
          created_at: string | null
          date_creation: string | null
          date_modification: string | null
          est_actif: boolean
          est_mort: boolean
          est_verrouille: boolean | null
          etape_creation: number
          famille_criminelle_id: string | null
          gn_completes: number | null
          historique: string | null
          id: string
          joueur_id: string
          mini_gn_completes: number | null
          niveau: number | null
          nom: string | null
          ouvertures_terrain: number | null
          ps_max: number
          pv_max: number
          race_id: string | null
          religion_id: string | null
          traits_raciaux_choisis: Json | null
          updated_at: string | null
          xp_depense: number | null
          xp_total: number | null
        }
        Insert: {
          a_forge_legendaire?: boolean
          a_joaillerie_legendaire?: boolean
          ame_personnage?: string | null
          classe_id?: string | null
          classe_secondaire_id?: string | null
          created_at?: string | null
          date_creation?: string | null
          date_modification?: string | null
          est_actif?: boolean
          est_mort?: boolean
          est_verrouille?: boolean | null
          etape_creation?: number
          famille_criminelle_id?: string | null
          gn_completes?: number | null
          historique?: string | null
          id: string
          joueur_id: string
          mini_gn_completes?: number | null
          niveau?: number | null
          nom?: string | null
          ouvertures_terrain?: number | null
          ps_max?: number
          pv_max?: number
          race_id?: string | null
          religion_id?: string | null
          traits_raciaux_choisis?: Json | null
          updated_at?: string | null
          xp_depense?: number | null
          xp_total?: number | null
        }
        Update: {
          a_forge_legendaire?: boolean
          a_joaillerie_legendaire?: boolean
          ame_personnage?: string | null
          classe_id?: string | null
          classe_secondaire_id?: string | null
          created_at?: string | null
          date_creation?: string | null
          date_modification?: string | null
          est_actif?: boolean
          est_mort?: boolean
          est_verrouille?: boolean | null
          etape_creation?: number
          famille_criminelle_id?: string | null
          gn_completes?: number | null
          historique?: string | null
          id?: string
          joueur_id?: string
          mini_gn_completes?: number | null
          niveau?: number | null
          nom?: string | null
          ouvertures_terrain?: number | null
          ps_max?: number
          pv_max?: number
          race_id?: string | null
          religion_id?: string | null
          traits_raciaux_choisis?: Json | null
          updated_at?: string | null
          xp_depense?: number | null
          xp_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "personnages_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnages_classe_secondaire_id_fkey"
            columns: ["classe_secondaire_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnages_famille_criminelle_id_fkey"
            columns: ["famille_criminelle_id"]
            isOneToOne: false
            referencedRelation: "familles_criminelles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_competences_maitre_attente"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_complete"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_maitres"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "personnages_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnages_religion_id_fkey"
            columns: ["religion_id"]
            isOneToOne: false
            referencedRelation: "religions"
            referencedColumns: ["id"]
          },
        ]
      }
      pieges: {
        Row: {
          cible: string
          construction: string | null
          cout_xp: number
          created_at: string
          duree: string
          effets: string
          est_actif: boolean
          id: string
          niveau: number
          niveau_effet: number | null
          nom: string
          type_piege: string
          updated_at: string
        }
        Insert: {
          cible: string
          construction?: string | null
          cout_xp: number
          created_at?: string
          duree: string
          effets: string
          est_actif?: boolean
          id?: string
          niveau: number
          niveau_effet?: number | null
          nom: string
          type_piege?: string
          updated_at?: string
        }
        Update: {
          cible?: string
          construction?: string | null
          cout_xp?: number
          created_at?: string
          duree?: string
          effets?: string
          est_actif?: boolean
          id?: string
          niveau?: number
          niveau_effet?: number | null
          nom?: string
          type_piege?: string
          updated_at?: string
        }
        Relationships: []
      }
      prieres: {
        Row: {
          cout_xp_base: number | null
          description: string | null
          domaine: string
          duree: string | null
          duree_incantation: string | null
          est_actif: boolean
          id: string
          niveau: number
          nom: string
          portee: string | null
          religion_id: string | null
          type_priere: string | null
          zone_effet: string | null
        }
        Insert: {
          cout_xp_base?: number | null
          description?: string | null
          domaine: string
          duree?: string | null
          duree_incantation?: string | null
          est_actif?: boolean
          id?: string
          niveau?: number
          nom: string
          portee?: string | null
          religion_id?: string | null
          type_priere?: string | null
          zone_effet?: string | null
        }
        Update: {
          cout_xp_base?: number | null
          description?: string | null
          domaine?: string
          duree?: string | null
          duree_incantation?: string | null
          est_actif?: boolean
          id?: string
          niveau?: number
          nom?: string
          portee?: string | null
          religion_id?: string | null
          type_priere?: string | null
          zone_effet?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prieres_religion_id_fkey"
            columns: ["religion_id"]
            isOneToOne: false
            referencedRelation: "religions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          nom_affichage: string | null
          role: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          is_active?: boolean | null
          nom_affichage?: string | null
          role?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          nom_affichage?: string | null
          role?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      race_traits: {
        Row: {
          id: string
          race_id: string
          sous_type: string | null
          trait_id: string
        }
        Insert: {
          id?: string
          race_id: string
          sous_type?: string | null
          trait_id: string
        }
        Update: {
          id?: string
          race_id?: string
          sous_type?: string | null
          trait_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "race_traits_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_traits_trait_id_fkey"
            columns: ["trait_id"]
            isOneToOne: false
            referencedRelation: "traits_raciaux"
            referencedColumns: ["id"]
          },
        ]
      }
      races: {
        Row: {
          description: string | null
          esperance_vie: string | null
          est_actif: boolean | null
          est_jouable: boolean
          exigences_costume: string | null
          id: string
          image_url: string | null
          nb_traits_raciaux: number
          nom: string | null
          nom_latin: string | null
          restrictions_classes: string[] | null
          xp_depart: number
        }
        Insert: {
          description?: string | null
          esperance_vie?: string | null
          est_actif?: boolean | null
          est_jouable?: boolean
          exigences_costume?: string | null
          id?: string
          image_url?: string | null
          nb_traits_raciaux?: number
          nom?: string | null
          nom_latin?: string | null
          restrictions_classes?: string[] | null
          xp_depart?: number
        }
        Update: {
          description?: string | null
          esperance_vie?: string | null
          est_actif?: boolean | null
          est_jouable?: boolean
          exigences_costume?: string | null
          id?: string
          image_url?: string | null
          nb_traits_raciaux?: number
          nom?: string | null
          nom_latin?: string | null
          restrictions_classes?: string[] | null
          xp_depart?: number
        }
        Relationships: []
      }
      recettes_alchimie: {
        Row: {
          cout_xp: number | null
          description: string | null
          effet: string | null
          est_actif: boolean | null
          formule: string | null
          id: string
          ingredients: Json | null
          niveau_requis: number | null
          nom: string | null
          type: string | null
        }
        Insert: {
          cout_xp?: number | null
          description?: string | null
          effet?: string | null
          est_actif?: boolean | null
          formule?: string | null
          id?: string
          ingredients?: Json | null
          niveau_requis?: number | null
          nom?: string | null
          type?: string | null
        }
        Update: {
          cout_xp?: number | null
          description?: string | null
          effet?: string | null
          est_actif?: boolean | null
          formule?: string | null
          id?: string
          ingredients?: Json | null
          niveau_requis?: number | null
          nom?: string | null
          type?: string | null
        }
        Relationships: []
      }
      religions: {
        Row: {
          description: string | null
          description_longue: string | null
          dirigeant: string | null
          domaines_principaux: string[] | null
          domaines_proscrits: string[] | null
          est_actif: boolean | null
          fondateur: string | null
          id: string
          nom: string | null
          pouvoir_symbole: string | null
          symbole_sacre: string | null
        }
        Insert: {
          description?: string | null
          description_longue?: string | null
          dirigeant?: string | null
          domaines_principaux?: string[] | null
          domaines_proscrits?: string[] | null
          est_actif?: boolean | null
          fondateur?: string | null
          id?: string
          nom?: string | null
          pouvoir_symbole?: string | null
          symbole_sacre?: string | null
        }
        Update: {
          description?: string | null
          description_longue?: string | null
          dirigeant?: string | null
          domaines_principaux?: string[] | null
          domaines_proscrits?: string[] | null
          est_actif?: boolean | null
          fondateur?: string | null
          id?: string
          nom?: string | null
          pouvoir_symbole?: string | null
          symbole_sacre?: string | null
        }
        Relationships: []
      }
      reparations_forge: {
        Row: {
          categorie: string
          created_at: string
          est_actif: boolean
          id: string
          materiaux: string
          materiaux_rares: string
          nom_affichage: string
          notes: string | null
          temps_minutes: number
          temps_rare_minutes: number
          updated_at: string
        }
        Insert: {
          categorie: string
          created_at?: string
          est_actif?: boolean
          id?: string
          materiaux: string
          materiaux_rares: string
          nom_affichage: string
          notes?: string | null
          temps_minutes: number
          temps_rare_minutes: number
          updated_at?: string
        }
        Update: {
          categorie?: string
          created_at?: string
          est_actif?: boolean
          id?: string
          materiaux?: string
          materiaux_rares?: string
          nom_affichage?: string
          notes?: string | null
          temps_minutes?: number
          temps_rare_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      sections_encyclopedie: {
        Row: {
          cle: string
          created_at: string | null
          est_actif: boolean
          icon_nom: string
          id: string
          label: string
          ordre: number
          updated_at: string | null
          url_key: string
        }
        Insert: {
          cle: string
          created_at?: string | null
          est_actif?: boolean
          icon_nom: string
          id?: string
          label: string
          ordre?: number
          updated_at?: string | null
          url_key: string
        }
        Update: {
          cle?: string
          created_at?: string | null
          est_actif?: boolean
          icon_nom?: string
          id?: string
          label?: string
          ordre?: number
          updated_at?: string | null
          url_key?: string
        }
        Relationships: []
      }
      sections_regles: {
        Row: {
          categorie: string
          contenu: string
          created_at: string | null
          est_actif: boolean | null
          id: string
          ordre: number
          titre: string
          updated_at: string | null
        }
        Insert: {
          categorie: string
          contenu: string
          created_at?: string | null
          est_actif?: boolean | null
          id?: string
          ordre?: number
          titre: string
          updated_at?: string | null
        }
        Update: {
          categorie?: string
          contenu?: string
          created_at?: string | null
          est_actif?: boolean | null
          id?: string
          ordre?: number
          titre?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sorts: {
        Row: {
          cercle: string
          cout_xp_base: number | null
          description: string | null
          duree: string | null
          est_actif: boolean
          id: string
          niveau: number
          nom: string
          portee: string | null
          type_sort: string | null
          zone_effet: string | null
        }
        Insert: {
          cercle: string
          cout_xp_base?: number | null
          description?: string | null
          duree?: string | null
          est_actif?: boolean
          id?: string
          niveau?: number
          nom: string
          portee?: string | null
          type_sort?: string | null
          zone_effet?: string | null
        }
        Update: {
          cercle?: string
          cout_xp_base?: number | null
          description?: string | null
          duree?: string | null
          est_actif?: boolean
          id?: string
          niveau?: number
          nom?: string
          portee?: string | null
          type_sort?: string | null
          zone_effet?: string | null
        }
        Relationships: []
      }
      traits_raciaux: {
        Row: {
          cout_xp: number
          created_at: string | null
          description: string
          est_actif: boolean | null
          id: string
          nom: string
          updated_at: string | null
        }
        Insert: {
          cout_xp?: number
          created_at?: string | null
          description: string
          est_actif?: boolean | null
          id?: string
          nom: string
          updated_at?: string | null
        }
        Update: {
          cout_xp?: number
          created_at?: string | null
          description?: string
          est_actif?: boolean | null
          id?: string
          nom?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      vue_artisanat_etat: {
        Row: {
          a_forge_legendaire: boolean | null
          a_joaillerie_legendaire: boolean | null
          niveau_alchimie: number | null
          niveau_forge: number | null
          niveau_joaillerie: number | null
          niveau_runes: number | null
          personnage_id: string | null
        }
        Relationships: []
      }
      vue_artisanat_quotas: {
        Row: {
          a_forge_legendaire: boolean | null
          a_joaillerie_legendaire: boolean | null
          niveau_alchimie: number | null
          niveau_forge: number | null
          niveau_joaillerie: number | null
          niveau_runes: number | null
          personnage_id: string | null
          quota_assemblages_total: number | null
          quota_recettes_total: number | null
        }
        Relationships: []
      }
      vue_cercles_disponibles: {
        Row: {
          cercle: string | null
          niveau_max_sorts: number | null
          personnage_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "personnages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_quotas"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_maitres"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_verrou_competences"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_xp_personnage"
            referencedColumns: ["id"]
          },
        ]
      }
      vue_competences_maitre_admin: {
        Row: {
          competence_nom: string | null
          date_demande: string | null
          id: string | null
          joueur_nom: string | null
          niveau_acquis: number | null
          nom_maitre: string | null
          personnage_nom: string | null
          statut_maitre: string | null
        }
        Relationships: []
      }
      vue_competences_maitre_attente: {
        Row: {
          competence_description: string | null
          competence_nom: string | null
          id: string | null
          joueur_id: string | null
          joueur_nom: string | null
          niveau_acquis: number | null
          nom_maitre: string | null
          personnage_id: string | null
          personnage_niveau: number | null
          personnage_nom: string | null
          statut_maitre: string | null
          xp_depense: number | null
        }
        Relationships: [
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "personnages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_quotas"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_maitres"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_verrou_competences"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_xp_personnage"
            referencedColumns: ["id"]
          },
        ]
      }
      vue_domaines_disponibles: {
        Row: {
          domaine: string | null
          niveau_max_prieres: number | null
          personnage_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "personnages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_quotas"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_maitres"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_verrou_competences"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_xp_personnage"
            referencedColumns: ["id"]
          },
        ]
      }
      vue_evenements_admin: {
        Row: {
          date_debut: string | null
          date_fin: string | null
          description: string | null
          est_publie: boolean | null
          id: string | null
          lieu: string | null
          nb_participants: number | null
          titre: string | null
        }
        Relationships: []
      }
      vue_inscriptions_par_evenement: {
        Row: {
          classe_nom: string | null
          date_confirmation: string | null
          date_evenement: string | null
          date_inscription: string | null
          est_actif: boolean | null
          est_mort: boolean | null
          est_verrouille: boolean | null
          evenement_id: string | null
          evenement_titre: string | null
          inscription_id: string | null
          joueur_email: string | null
          joueur_id: string | null
          joueur_nom: string | null
          joueur_username: string | null
          personnage_id: string | null
          personnage_niveau: number | null
          personnage_nom: string | null
          ps_max: number | null
          pv_max: number | null
          race_nom: string | null
          statut: string | null
          type_evenement: string | null
          xp_attribue: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inscriptions_evenements_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "evenements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "vue_evenements_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "vue_prochain_evenement"
            referencedColumns: ["id"]
          },
        ]
      }
      vue_inscriptions_resumees: {
        Row: {
          date_evenement: string | null
          date_fin: string | null
          date_inscription: string | null
          evenement_id: string | null
          evenement_titre: string | null
          id: string | null
          joueur_id: string | null
          joueur_nom: string | null
          lieu: string | null
          max_participants: number | null
          nb_inscrits_confirmes: number | null
          personnage_id: string | null
          personnage_nom: string | null
          statut: string | null
          type_evenement: string | null
          xp_attribue: number | null
          xp_recompense: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inscriptions_evenements_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "evenements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "vue_evenements_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "vue_prochain_evenement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_competences_maitre_attente"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_complete"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_maitres"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "personnages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_quotas"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_maitres"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_verrou_competences"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_xp_personnage"
            referencedColumns: ["id"]
          },
        ]
      }
      vue_joueurs_complete: {
        Row: {
          compte_cree_le: string | null
          email: string | null
          is_active: boolean | null
          joueur_id: string | null
          nb_personnages_actifs: number | null
          nb_personnages_archives: number | null
          nb_personnages_morts: number | null
          nb_personnages_total: number | null
          nom_affichage: string | null
          personnage_actif_principal: string | null
          role: string | null
          username: string | null
        }
        Relationships: []
      }
      vue_joueurs_maitres: {
        Row: {
          classe: string | null
          joueur_id: string | null
          joueur_nom: string | null
          niveau: number | null
          personnage_id: string | null
          personnage_nom: string | null
          race: string | null
          xp_total: number | null
        }
        Relationships: []
      }
      vue_personnage_etat: {
        Row: {
          a_connaissance_creatures_1: boolean | null
          a_connaissance_creatures_2: boolean | null
          a_connaissance_religions: boolean | null
          a_premiers_soins: boolean | null
          joueur_id: string | null
          niveau: number | null
          niveau_alchimie: number | null
          niveau_cercle: number | null
          niveau_domaine: number | null
          niveau_forge: number | null
          niveau_joaillerie: number | null
          niveau_runes: number | null
          personnage_id: string | null
          xp_disponible: number | null
        }
        Relationships: [
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_competences_maitre_attente"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_complete"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_maitres"
            referencedColumns: ["joueur_id"]
          },
        ]
      }
      vue_personnages_admin: {
        Row: {
          classe_nom: string | null
          created_at: string | null
          est_actif: boolean | null
          etape_creation: number | null
          id: string | null
          joueur_nom: string | null
          niveau: number | null
          nom: string | null
          race_nom: string | null
        }
        Relationships: []
      }
      vue_prochain_evenement: {
        Row: {
          created_by: string | null
          date_evenement: string | null
          date_fin: string | null
          description: string | null
          est_publie: boolean | null
          id: string | null
          lieu: string | null
          max_participants: number | null
          nb_inscrits: number | null
          places_restantes: number | null
          titre: string | null
          type_evenement: string | null
          xp_recompense: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evenements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evenements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vue_competences_maitre_attente"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "evenements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "evenements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_complete"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "evenements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_maitres"
            referencedColumns: ["joueur_id"]
          },
        ]
      }
      vue_stats_admin: {
        Row: {
          nb_competences_attente: number | null
          nb_joueurs: number | null
          nb_personnages_actifs: number | null
          nb_presences_attente: number | null
          prochain_evenement_date: string | null
          prochain_evenement_titre: string | null
        }
        Relationships: []
      }
      vue_traits_par_race: {
        Row: {
          cout_xp: number | null
          est_actif: boolean | null
          race_id: string | null
          race_nom: string | null
          race_trait_id: string | null
          sous_type: string | null
          trait_description: string | null
          trait_id: string | null
          trait_nom: string | null
        }
        Relationships: [
          {
            foreignKeyName: "race_traits_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_traits_trait_id_fkey"
            columns: ["trait_id"]
            isOneToOne: false
            referencedRelation: "traits_raciaux"
            referencedColumns: ["id"]
          },
        ]
      }
      vue_verrou_competences: {
        Row: {
          canalisation_verrouillee: boolean | null
          dev_spirituel_sup_verrouille: boolean | null
          dev_spirituel_verrouille: boolean | null
          personnage_id: string | null
          runes_verrouillees: boolean | null
        }
        Relationships: []
      }
      vue_xp_personnage: {
        Row: {
          classe_nom: string | null
          est_actif: boolean | null
          est_mort: boolean | null
          est_verrouille: boolean | null
          etape_creation: number | null
          famille_nom: string | null
          gn_completes: number | null
          id: string | null
          joueur_id: string | null
          joueur_nom: string | null
          mini_gn_completes: number | null
          niveau: number | null
          nom: string | null
          ouvertures_terrain: number | null
          ps_depart: number | null
          ps_max: number | null
          pv_depart: number | null
          pv_max: number | null
          race_latin: string | null
          race_nom: string | null
          religion_nom: string | null
          xp_depense: number | null
          xp_disponible: number | null
          xp_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_competences_maitre_attente"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_complete"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_joueurs_maitres"
            referencedColumns: ["joueur_id"]
          },
        ]
      }
    }
    Functions: {
      approuver_maitre_competence: {
        Args: { p_personnage_competence_id: string }
        Returns: Json
      }
      archiver_personnage: { Args: { p_personnage_id: string }; Returns: Json }
      attribuer_xp_evenement: {
        Args: { p_inscription_id: string; p_xp_montant: number }
        Returns: Json
      }
      deverrouiller_personnage: {
        Args: { p_personnage_id: string }
        Returns: Json
      }
      donner_xp_bonus: {
        Args: { p_montant: number; p_personnage_id: string; p_raison?: string }
        Returns: Json
      }
      est_animateur_ou_admin: { Args: never; Returns: boolean }
      get_joueurs_avec_count: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          nb_personnages: number
          nom_affichage: string
          role: string
        }[]
      }
      marquer_absent: { Args: { p_inscription_id: string }; Returns: Json }
      marquer_present: { Args: { p_inscription_id: string }; Returns: Json }
      peut_acheter_competence: {
        Args: {
          p_choix_achat?: string
          p_competence_id: string
          p_niveau_desire: number
          p_personnage_id: string
        }
        Returns: Json
      }
      peut_acheter_trait_racial: {
        Args: {
          p_personnage_id: string
          p_race_id: string
          p_sous_type?: string
          p_trait_id: string
        }
        Returns: Json
      }
      refuser_maitre_competence: {
        Args: { p_personnage_competence_id: string; p_raison?: string }
        Returns: Json
      }
      role_du_profil: { Args: { _user_id: string }; Returns: string }
      verrouiller_personnage: {
        Args: { p_personnage_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
