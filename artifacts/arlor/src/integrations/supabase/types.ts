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
      archive_description_courte_legacy: {
        Row: {
          archive_le: string
          description_courte: string | null
          nom: string | null
          record_id: string
          table_source: string
        }
        Insert: {
          archive_le?: string
          description_courte?: string | null
          nom?: string | null
          record_id: string
          table_source: string
        }
        Update: {
          archive_le?: string
          description_courte?: string | null
          nom?: string | null
          record_id?: string
          table_source?: string
        }
        Relationships: []
      }
      assemblages_runes: {
        Row: {
          cible: string | null
          cout_ps: number | null
          cout_ps_maitrise: number | null
          cout_xp: number | null
          description: string | null
          description_longue: string | null
          duree: string | null
          effet: string | null
          effet_maitrise: string | null
          est_actif: boolean | null
          id: string
          nom: string | null
          recherche_tsv: unknown
          resume_condense: string | null
          runes_requises: string[] | null
          texte_manuel: string | null
        }
        Insert: {
          cible?: string | null
          cout_ps?: number | null
          cout_ps_maitrise?: number | null
          cout_xp?: number | null
          description?: string | null
          description_longue?: string | null
          duree?: string | null
          effet?: string | null
          effet_maitrise?: string | null
          est_actif?: boolean | null
          id?: string
          nom?: string | null
          recherche_tsv?: unknown
          resume_condense?: string | null
          runes_requises?: string[] | null
          texte_manuel?: string | null
        }
        Update: {
          cible?: string | null
          cout_ps?: number | null
          cout_ps_maitrise?: number | null
          cout_xp?: number | null
          description?: string | null
          description_longue?: string | null
          duree?: string | null
          effet?: string | null
          effet_maitrise?: string | null
          est_actif?: boolean | null
          id?: string
          nom?: string | null
          recherche_tsv?: unknown
          resume_condense?: string | null
          runes_requises?: string[] | null
          texte_manuel?: string | null
        }
        Relationships: []
      }
      banque_xp_mouvements: {
        Row: {
          acteur_id: string | null
          created_at: string
          description: string
          evenement_id: string | null
          id: string
          joueur_id: string
          montant: number
          personnage_cible_id: string | null
          type_mouvement: string
        }
        Insert: {
          acteur_id?: string | null
          created_at?: string
          description: string
          evenement_id?: string | null
          id?: string
          joueur_id: string
          montant: number
          personnage_cible_id?: string | null
          type_mouvement: string
        }
        Update: {
          acteur_id?: string | null
          created_at?: string
          description?: string
          evenement_id?: string | null
          id?: string
          joueur_id?: string
          montant?: number
          personnage_cible_id?: string | null
          type_mouvement?: string
        }
        Relationships: [
          {
            foreignKeyName: "banque_xp_mouvements_acteur_id_fkey"
            columns: ["acteur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "evenements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "vue_evenements_publies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "vue_prochain_evenement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "profils_joueur"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_banque_joueur"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_personnage_cible_id_fkey"
            columns: ["personnage_cible_id"]
            isOneToOne: false
            referencedRelation: "personnages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_personnage_cible_id_fkey"
            columns: ["personnage_cible_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_personnage_cible_id_fkey"
            columns: ["personnage_cible_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_quotas"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_personnage_cible_id_fkey"
            columns: ["personnage_cible_id"]
            isOneToOne: false
            referencedRelation: "vue_fiche_personnage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_personnage_cible_id_fkey"
            columns: ["personnage_cible_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_personnage_cible_id_fkey"
            columns: ["personnage_cible_id"]
            isOneToOne: false
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_personnage_cible_id_fkey"
            columns: ["personnage_cible_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin_complet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_personnage_cible_id_fkey"
            columns: ["personnage_cible_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_joueur"
            referencedColumns: ["id"]
          },
        ]
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
          recherche_tsv: unknown
          resume_condense: string | null
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
          recherche_tsv?: unknown
          resume_condense?: string | null
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
          recherche_tsv?: unknown
          resume_condense?: string | null
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
      cimetiere: {
        Row: {
          classe: string | null
          created_at: string
          cree_par: string | null
          date_mort: string
          epitaphe: string | null
          id: string
          joueur_nom: string | null
          niveau: number | null
          nom: string
          personnage_id_origine: string | null
          race: string
          snapshot: Json
          statut: string
        }
        Insert: {
          classe?: string | null
          created_at?: string
          cree_par?: string | null
          date_mort?: string
          epitaphe?: string | null
          id?: string
          joueur_nom?: string | null
          niveau?: number | null
          nom: string
          personnage_id_origine?: string | null
          race: string
          snapshot: Json
          statut?: string
        }
        Update: {
          classe?: string | null
          created_at?: string
          cree_par?: string | null
          date_mort?: string
          epitaphe?: string | null
          id?: string
          joueur_nom?: string | null
          niveau?: number | null
          nom?: string
          personnage_id_origine?: string | null
          race?: string
          snapshot?: Json
          statut?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          competences_gratuites: Json | null
          description: string | null
          emoji: string | null
          est_actif: boolean | null
          id: string
          nom: string | null
          peut_utiliser_armes_deux_mains: boolean | null
          ps_depart: number | null
          pv_depart: number | null
          recherche_tsv: unknown
          resume_condense: string | null
          role_combat: string | null
        }
        Insert: {
          competences_gratuites?: Json | null
          description?: string | null
          emoji?: string | null
          est_actif?: boolean | null
          id?: string
          nom?: string | null
          peut_utiliser_armes_deux_mains?: boolean | null
          ps_depart?: number | null
          pv_depart?: number | null
          recherche_tsv?: unknown
          resume_condense?: string | null
          role_combat?: string | null
        }
        Update: {
          competences_gratuites?: Json | null
          description?: string | null
          emoji?: string | null
          est_actif?: boolean | null
          id?: string
          nom?: string | null
          peut_utiliser_armes_deux_mains?: boolean | null
          ps_depart?: number | null
          pv_depart?: number | null
          recherche_tsv?: unknown
          resume_condense?: string | null
          role_combat?: string | null
        }
        Relationships: []
      }
      competences: {
        Row: {
          categorie: string | null
          classes_requises: string[] | null
          desachat_force: boolean
          description: string | null
          est_actif: boolean | null
          est_general: boolean | null
          exige_ps: boolean
          id: string
          niveaux: Json | null
          nom: string | null
          prerequis_competences: Json | null
          recherche_tsv: unknown
          resume_condense: string | null
          type_achat: string
          type_choix: string | null
          verrouillage_croise: boolean
        }
        Insert: {
          categorie?: string | null
          classes_requises?: string[] | null
          desachat_force?: boolean
          description?: string | null
          est_actif?: boolean | null
          est_general?: boolean | null
          exige_ps?: boolean
          id?: string
          niveaux?: Json | null
          nom?: string | null
          prerequis_competences?: Json | null
          recherche_tsv?: unknown
          resume_condense?: string | null
          type_achat?: string
          type_choix?: string | null
          verrouillage_croise?: boolean
        }
        Update: {
          categorie?: string | null
          classes_requises?: string[] | null
          desachat_force?: boolean
          description?: string | null
          est_actif?: boolean | null
          est_general?: boolean | null
          exige_ps?: boolean
          id?: string
          niveaux?: Json | null
          nom?: string | null
          prerequis_competences?: Json | null
          recherche_tsv?: unknown
          resume_condense?: string | null
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
          adresse_physique: string | null
          created_at: string | null
          created_by: string | null
          date_evenement: string | null
          date_fin: string | null
          description: string | null
          est_publie: boolean | null
          est_termine: boolean | null
          gel_heures_avant: number | null
          id: string
          lieu: string | null
          max_participants: number | null
          niveaux_recompense: number | null
          titre: string | null
          type_evenement: string | null
          updated_at: string | null
          xp_recompense: number | null
        }
        Insert: {
          adresse_physique?: string | null
          created_at?: string | null
          created_by?: string | null
          date_evenement?: string | null
          date_fin?: string | null
          description?: string | null
          est_publie?: boolean | null
          est_termine?: boolean | null
          gel_heures_avant?: number | null
          id?: string
          lieu?: string | null
          max_participants?: number | null
          niveaux_recompense?: number | null
          titre?: string | null
          type_evenement?: string | null
          updated_at?: string | null
          xp_recompense?: number | null
        }
        Update: {
          adresse_physique?: string | null
          created_at?: string | null
          created_by?: string | null
          date_evenement?: string | null
          date_fin?: string | null
          description?: string | null
          est_publie?: boolean | null
          est_termine?: boolean | null
          gel_heures_avant?: number | null
          id?: string
          lieu?: string | null
          max_participants?: number | null
          niveaux_recompense?: number | null
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
      fiches_listes: {
        Row: {
          annexes: Json
          carte: Json
          categorie: string
          mis_a_jour: string
          navigation: Json
          recherche: Json
        }
        Insert: {
          annexes?: Json
          carte?: Json
          categorie: string
          mis_a_jour?: string
          navigation?: Json
          recherche?: Json
        }
        Update: {
          annexes?: Json
          carte?: Json
          categorie?: string
          mis_a_jour?: string
          navigation?: Json
          recherche?: Json
        }
        Relationships: []
      }
      fiches_schemas: {
        Row: {
          categorie: string
          champs_v2: Json | null
          mis_a_jour: string
        }
        Insert: {
          categorie: string
          champs_v2?: Json | null
          mis_a_jour?: string
        }
        Update: {
          categorie?: string
          champs_v2?: Json | null
          mis_a_jour?: string
        }
        Relationships: []
      }
      historique_xp: {
        Row: {
          acteur_id: string | null
          assemblage_id: string | null
          banque_mouvement_id: string | null
          competence_id: string | null
          created_at: string
          description: string
          evenement_id: string | null
          id: string
          inscription_id: string | null
          montant: number
          objet_forge_id: string | null
          objet_joaillerie_id: string | null
          personnage_id: string
          personnage_source_id: string | null
          piege_id: string | null
          priere_id: string | null
          recette_id: string | null
          sort_id: string | null
          trait_id: string | null
          type_mouvement: string
        }
        Insert: {
          acteur_id?: string | null
          assemblage_id?: string | null
          banque_mouvement_id?: string | null
          competence_id?: string | null
          created_at?: string
          description: string
          evenement_id?: string | null
          id?: string
          inscription_id?: string | null
          montant: number
          objet_forge_id?: string | null
          objet_joaillerie_id?: string | null
          personnage_id: string
          personnage_source_id?: string | null
          piege_id?: string | null
          priere_id?: string | null
          recette_id?: string | null
          sort_id?: string | null
          trait_id?: string | null
          type_mouvement: string
        }
        Update: {
          acteur_id?: string | null
          assemblage_id?: string | null
          banque_mouvement_id?: string | null
          competence_id?: string | null
          created_at?: string
          description?: string
          evenement_id?: string | null
          id?: string
          inscription_id?: string | null
          montant?: number
          objet_forge_id?: string | null
          objet_joaillerie_id?: string | null
          personnage_id?: string
          personnage_source_id?: string | null
          piege_id?: string | null
          priere_id?: string | null
          recette_id?: string | null
          sort_id?: string | null
          trait_id?: string | null
          type_mouvement?: string
        }
        Relationships: [
          {
            foreignKeyName: "historique_xp_assemblage_id_fkey"
            columns: ["assemblage_id"]
            isOneToOne: false
            referencedRelation: "assemblages_runes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_xp_banque_mouvement_id_fkey"
            columns: ["banque_mouvement_id"]
            isOneToOne: false
            referencedRelation: "banque_xp_mouvements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_xp_banque_mouvement_id_fkey"
            columns: ["banque_mouvement_id"]
            isOneToOne: false
            referencedRelation: "vue_banque_mouvements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_xp_competence_id_fkey"
            columns: ["competence_id"]
            isOneToOne: false
            referencedRelation: "competences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_xp_competence_id_fkey"
            columns: ["competence_id"]
            isOneToOne: false
            referencedRelation: "vue_competences_encyclopedie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_xp_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "evenements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_xp_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "vue_evenements_publies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_xp_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "vue_prochain_evenement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_xp_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "inscriptions_evenements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_xp_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["inscription_id"]
          },
          {
            foreignKeyName: "historique_xp_objet_forge_id_fkey"
            columns: ["objet_forge_id"]
            isOneToOne: false
            referencedRelation: "objets_forge"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_xp_objet_joaillerie_id_fkey"
            columns: ["objet_joaillerie_id"]
            isOneToOne: false
            referencedRelation: "objets_joaillerie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_xp_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "personnages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_xp_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "historique_xp_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_quotas"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "historique_xp_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_fiche_personnage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_xp_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "historique_xp_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "historique_xp_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin_complet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_xp_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_joueur"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_xp_personnage_source_id_fkey"
            columns: ["personnage_source_id"]
            isOneToOne: false
            referencedRelation: "personnages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_xp_personnage_source_id_fkey"
            columns: ["personnage_source_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "historique_xp_personnage_source_id_fkey"
            columns: ["personnage_source_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_quotas"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "historique_xp_personnage_source_id_fkey"
            columns: ["personnage_source_id"]
            isOneToOne: false
            referencedRelation: "vue_fiche_personnage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_xp_personnage_source_id_fkey"
            columns: ["personnage_source_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "historique_xp_personnage_source_id_fkey"
            columns: ["personnage_source_id"]
            isOneToOne: false
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "historique_xp_personnage_source_id_fkey"
            columns: ["personnage_source_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin_complet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_xp_personnage_source_id_fkey"
            columns: ["personnage_source_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_joueur"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_xp_piege_id_fkey"
            columns: ["piege_id"]
            isOneToOne: false
            referencedRelation: "pieges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_xp_priere_id_fkey"
            columns: ["priere_id"]
            isOneToOne: false
            referencedRelation: "prieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_xp_recette_id_fkey"
            columns: ["recette_id"]
            isOneToOne: false
            referencedRelation: "recettes_alchimie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_xp_sort_id_fkey"
            columns: ["sort_id"]
            isOneToOne: false
            referencedRelation: "sorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historique_xp_trait_id_fkey"
            columns: ["trait_id"]
            isOneToOne: false
            referencedRelation: "traits_raciaux"
            referencedColumns: ["id"]
          },
        ]
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
          recompense_distribuee: boolean | null
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
          recompense_distribuee?: boolean | null
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
          recompense_distribuee?: boolean | null
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
            referencedRelation: "vue_evenements_publies"
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
            referencedRelation: "profils_joueur"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_banque_joueur"
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
            referencedRelation: "vue_fiche_personnage"
            referencedColumns: ["id"]
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
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin_complet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscriptions_evenements_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_joueur"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_audit: {
        Row: {
          acteur_id: string | null
          acteur_role: string
          action: string
          cible_id: string
          cible_type: string
          created_at: string
          details: Json
          id: string
        }
        Insert: {
          acteur_id?: string | null
          acteur_role: string
          action: string
          cible_id: string
          cible_type: string
          created_at?: string
          details?: Json
          id?: string
        }
        Update: {
          acteur_id?: string | null
          acteur_role?: string
          action?: string
          cible_id?: string
          cible_type?: string
          created_at?: string
          details?: Json
          id?: string
        }
        Relationships: []
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
          recherche_tsv: unknown
          resume_condense: string | null
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
          recherche_tsv?: unknown
          resume_condense?: string | null
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
          recherche_tsv?: unknown
          resume_condense?: string | null
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
          section: string | null
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
          section?: string | null
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
          section?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_navigation_section_fkey"
            columns: ["section"]
            isOneToOne: false
            referencedRelation: "sections_menu"
            referencedColumns: ["slug"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          lu: boolean | null
          message: string | null
          profil_id: string | null
          reference_id: string | null
          statut: string
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lu?: boolean | null
          message?: string | null
          profil_id?: string | null
          reference_id?: string | null
          statut?: string
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lu?: boolean | null
          message?: string | null
          profil_id?: string | null
          reference_id?: string | null
          statut?: string
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profil_id_fkey"
            columns: ["profil_id"]
            isOneToOne: false
            referencedRelation: "profils_joueur"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_profil_id_fkey"
            columns: ["profil_id"]
            isOneToOne: false
            referencedRelation: "vue_banque_joueur"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "notifications_profil_id_fkey"
            columns: ["profil_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      objets_forge: {
        Row: {
          combats: number | null
          cout_xp: number | null
          degats_membre: number | null
          degats_torse: number | null
          description: string | null
          effet: string | null
          emplacement: string | null
          est_actif: boolean | null
          exemples: string | null
          fab_a_preciser: boolean
          id: string
          materiaux_communs: string | null
          materiaux_rares: string | null
          nom: string | null
          non_reparable: boolean
          points_armure: number | null
          portee: string | null
          pression_max: number | null
          prise: string | null
          recherche_tsv: unknown
          reparation_id: string | null
          resume_condense: string | null
          stats: Json | null
          taille_max: number | null
          taille_min: number | null
          temps_fabrication_minutes: number | null
          type: string | null
        }
        Insert: {
          combats?: number | null
          cout_xp?: number | null
          degats_membre?: number | null
          degats_torse?: number | null
          description?: string | null
          effet?: string | null
          emplacement?: string | null
          est_actif?: boolean | null
          exemples?: string | null
          fab_a_preciser?: boolean
          id?: string
          materiaux_communs?: string | null
          materiaux_rares?: string | null
          nom?: string | null
          non_reparable?: boolean
          points_armure?: number | null
          portee?: string | null
          pression_max?: number | null
          prise?: string | null
          recherche_tsv?: unknown
          reparation_id?: string | null
          resume_condense?: string | null
          stats?: Json | null
          taille_max?: number | null
          taille_min?: number | null
          temps_fabrication_minutes?: number | null
          type?: string | null
        }
        Update: {
          combats?: number | null
          cout_xp?: number | null
          degats_membre?: number | null
          degats_torse?: number | null
          description?: string | null
          effet?: string | null
          emplacement?: string | null
          est_actif?: boolean | null
          exemples?: string | null
          fab_a_preciser?: boolean
          id?: string
          materiaux_communs?: string | null
          materiaux_rares?: string | null
          nom?: string | null
          non_reparable?: boolean
          points_armure?: number | null
          portee?: string | null
          pression_max?: number | null
          prise?: string | null
          recherche_tsv?: unknown
          reparation_id?: string | null
          resume_condense?: string | null
          stats?: Json | null
          taille_max?: number | null
          taille_min?: number | null
          temps_fabrication_minutes?: number | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objets_forge_reparation_id_fkey"
            columns: ["reparation_id"]
            isOneToOne: false
            referencedRelation: "reparations_forge"
            referencedColumns: ["id"]
          },
        ]
      }
      objets_generateur: {
        Row: {
          est_actif: boolean
          groupe: string
          id: string
          libelle: string
          ordre: number
        }
        Insert: {
          est_actif?: boolean
          groupe: string
          id: string
          libelle: string
          ordre: number
        }
        Update: {
          est_actif?: boolean
          groupe?: string
          id?: string
          libelle?: string
          ordre?: number
        }
        Relationships: []
      }
      objets_joaillerie: {
        Row: {
          cout_xp: number | null
          description: string | null
          effet: string | null
          est_actif: boolean | null
          id: string
          materiaux_communs: string | null
          materiaux_rares: string | null
          nom: string | null
          recherche_tsv: unknown
          resume_condense: string | null
          temps_fabrication_minutes: number | null
          temps_rare_minutes: number | null
        }
        Insert: {
          cout_xp?: number | null
          description?: string | null
          effet?: string | null
          est_actif?: boolean | null
          id?: string
          materiaux_communs?: string | null
          materiaux_rares?: string | null
          nom?: string | null
          recherche_tsv?: unknown
          resume_condense?: string | null
          temps_fabrication_minutes?: number | null
          temps_rare_minutes?: number | null
        }
        Update: {
          cout_xp?: number | null
          description?: string | null
          effet?: string | null
          est_actif?: boolean | null
          id?: string
          materiaux_communs?: string | null
          materiaux_rares?: string | null
          nom?: string | null
          recherche_tsv?: unknown
          resume_condense?: string | null
          temps_fabrication_minutes?: number | null
          temps_rare_minutes?: number | null
        }
        Relationships: []
      }
      objets_requis: {
        Row: {
          commentaire: string | null
          competence_id: string | null
          id: string
          libelle_manque: string
          race_id: string | null
          variantes: Json
        }
        Insert: {
          commentaire?: string | null
          competence_id?: string | null
          id?: string
          libelle_manque: string
          race_id?: string | null
          variantes: Json
        }
        Update: {
          commentaire?: string | null
          competence_id?: string | null
          id?: string
          libelle_manque?: string
          race_id?: string | null
          variantes?: Json
        }
        Relationships: [
          {
            foreignKeyName: "objets_requis_competence_id_fkey"
            columns: ["competence_id"]
            isOneToOne: true
            referencedRelation: "competences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objets_requis_competence_id_fkey"
            columns: ["competence_id"]
            isOneToOne: true
            referencedRelation: "vue_competences_encyclopedie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objets_requis_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: true
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objets_requis_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: true
            referencedRelation: "vue_demandes_races_attente"
            referencedColumns: ["race_id"]
          },
        ]
      }
      parametres_jeu: {
        Row: {
          cgu_version_en_vigueur: string | null
          created_at: string | null
          description_gn: string | null
          email_contact: string | null
          id: string
          lien_discord: string | null
          lien_facebook: string | null
          lien_instagram: string | null
          lien_site_web: string | null
          nom_gn: string
          texte_envoi_photos_race: string | null
          updated_at: string | null
        }
        Insert: {
          cgu_version_en_vigueur?: string | null
          created_at?: string | null
          description_gn?: string | null
          email_contact?: string | null
          id?: string
          lien_discord?: string | null
          lien_facebook?: string | null
          lien_instagram?: string | null
          lien_site_web?: string | null
          nom_gn?: string
          texte_envoi_photos_race?: string | null
          updated_at?: string | null
        }
        Update: {
          cgu_version_en_vigueur?: string | null
          created_at?: string | null
          description_gn?: string | null
          email_contact?: string | null
          id?: string
          lien_discord?: string | null
          lien_facebook?: string | null
          lien_instagram?: string | null
          lien_site_web?: string | null
          nom_gn?: string
          texte_envoi_photos_race?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      personnage_assemblages: {
        Row: {
          assemblage_id: string
          date_acquisition: string
          est_gratuit: boolean
          id: string
          personnage_id: string
          xp_depense: number
        }
        Insert: {
          assemblage_id: string
          date_acquisition?: string
          est_gratuit?: boolean
          id?: string
          personnage_id: string
          xp_depense?: number
        }
        Update: {
          assemblage_id?: string
          date_acquisition?: string
          est_gratuit?: boolean
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
            referencedRelation: "vue_fiche_personnage"
            referencedColumns: ["id"]
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
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_assemblages_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin_complet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_assemblages_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_joueur"
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
          rabais_items: Json | null
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
          rabais_items?: Json | null
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
          rabais_items?: Json | null
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
            foreignKeyName: "personnage_competences_competence_id_fkey"
            columns: ["competence_id"]
            isOneToOne: false
            referencedRelation: "vue_competences_encyclopedie"
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
            referencedRelation: "vue_fiche_personnage"
            referencedColumns: ["id"]
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
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin_complet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_joueur"
            referencedColumns: ["id"]
          },
        ]
      }
      personnage_compo_photos: {
        Row: {
          acteur_id: string | null
          compo: Json
          created_at: string
          evenement_id: string | null
          id: string
          inscription_id: string | null
          personnage_id: string
        }
        Insert: {
          acteur_id?: string | null
          compo: Json
          created_at?: string
          evenement_id?: string | null
          id?: string
          inscription_id?: string | null
          personnage_id: string
        }
        Update: {
          acteur_id?: string | null
          compo?: Json
          created_at?: string
          evenement_id?: string | null
          id?: string
          inscription_id?: string | null
          personnage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personnage_compo_photos_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "evenements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_compo_photos_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "vue_evenements_publies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_compo_photos_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "vue_prochain_evenement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_compo_photos_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "inscriptions_evenements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_compo_photos_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["inscription_id"]
          },
          {
            foreignKeyName: "personnage_compo_photos_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "personnages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_compo_photos_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_compo_photos_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_quotas"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_compo_photos_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_fiche_personnage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_compo_photos_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_compo_photos_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_compo_photos_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin_complet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_compo_photos_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_joueur"
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
            referencedRelation: "vue_fiche_personnage"
            referencedColumns: ["id"]
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
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_objets_forge_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin_complet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_objets_forge_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_joueur"
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
            referencedRelation: "vue_fiche_personnage"
            referencedColumns: ["id"]
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
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_objets_joaillerie_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin_complet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_objets_joaillerie_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_joueur"
            referencedColumns: ["id"]
          },
        ]
      }
      personnage_pieges: {
        Row: {
          created_at: string
          date_acquisition: string
          est_gratuit: boolean
          id: string
          niveau_acquis: number
          personnage_id: string
          piege_id: string
          piege_nom: string
          updated_at: string
          xp_depense: number
        }
        Insert: {
          created_at?: string
          date_acquisition?: string
          est_gratuit?: boolean
          id?: string
          niveau_acquis?: number
          personnage_id: string
          piege_id: string
          piege_nom: string
          updated_at?: string
          xp_depense?: number
        }
        Update: {
          created_at?: string
          date_acquisition?: string
          est_gratuit?: boolean
          id?: string
          niveau_acquis?: number
          personnage_id?: string
          piege_id?: string
          piege_nom?: string
          updated_at?: string
          xp_depense?: number
        }
        Relationships: [
          {
            foreignKeyName: "personnage_pieges_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "personnages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_pieges_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_pieges_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_quotas"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_pieges_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_fiche_personnage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_pieges_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_pieges_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_pieges_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin_complet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_pieges_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_joueur"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_pieges_piege_id_fkey"
            columns: ["piege_id"]
            isOneToOne: false
            referencedRelation: "pieges"
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
          statut: string
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
          statut?: string
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
          statut?: string
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
            referencedRelation: "vue_fiche_personnage"
            referencedColumns: ["id"]
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
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_prieres_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin_complet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_prieres_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_joueur"
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
      personnage_races_demandes: {
        Row: {
          approuve_par: string | null
          background: string | null
          created_at: string
          date_approbation: string | null
          id: string
          personnage_id: string
          race_id: string
          raison_refus: string | null
          statut: string
          updated_at: string
        }
        Insert: {
          approuve_par?: string | null
          background?: string | null
          created_at?: string
          date_approbation?: string | null
          id?: string
          personnage_id: string
          race_id: string
          raison_refus?: string | null
          statut?: string
          updated_at?: string
        }
        Update: {
          approuve_par?: string | null
          background?: string | null
          created_at?: string
          date_approbation?: string | null
          id?: string
          personnage_id?: string
          race_id?: string
          raison_refus?: string | null
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personnage_races_demandes_approuve_par_fkey"
            columns: ["approuve_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_races_demandes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: true
            referencedRelation: "personnages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_races_demandes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: true
            referencedRelation: "vue_artisanat_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_races_demandes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: true
            referencedRelation: "vue_artisanat_quotas"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_races_demandes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: true
            referencedRelation: "vue_fiche_personnage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_races_demandes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: true
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_races_demandes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: true
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_races_demandes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: true
            referencedRelation: "vue_personnages_admin_complet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_races_demandes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: true
            referencedRelation: "vue_personnages_joueur"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_races_demandes_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_races_demandes_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "vue_demandes_races_attente"
            referencedColumns: ["race_id"]
          },
        ]
      }
      personnage_recettes: {
        Row: {
          date_acquisition: string
          est_gratuit: boolean
          id: string
          personnage_id: string
          recette_id: string
          xp_depense: number
        }
        Insert: {
          date_acquisition?: string
          est_gratuit?: boolean
          id?: string
          personnage_id: string
          recette_id: string
          xp_depense?: number
        }
        Update: {
          date_acquisition?: string
          est_gratuit?: boolean
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
            referencedRelation: "vue_fiche_personnage"
            referencedColumns: ["id"]
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
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_recettes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin_complet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_recettes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_joueur"
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
          statut: string
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
          statut?: string
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
          statut?: string
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
            referencedRelation: "vue_fiche_personnage"
            referencedColumns: ["id"]
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
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_sorts_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin_complet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_sorts_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_joueur"
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
          est_croyant: boolean
          est_finalise: boolean
          est_mort: boolean
          est_verrouille: boolean | null
          etape_creation: number
          famille_criminelle_id: string | null
          gn_completes: number | null
          gn_declares: number
          historique: string | null
          id: string
          joueur_id: string
          mini_gn_completes: number | null
          mini_gn_declares: number
          niveau: number | null
          niveau_correction: number
          nom: string | null
          ouvertures_declares: number
          ouvertures_terrain: number | null
          ps_max: number
          pv_max: number
          race_id: string | null
          religion_id: string | null
          sous_type_chimeride: string | null
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
          est_croyant?: boolean
          est_finalise?: boolean
          est_mort?: boolean
          est_verrouille?: boolean | null
          etape_creation?: number
          famille_criminelle_id?: string | null
          gn_completes?: number | null
          gn_declares?: number
          historique?: string | null
          id: string
          joueur_id: string
          mini_gn_completes?: number | null
          mini_gn_declares?: number
          niveau?: number | null
          niveau_correction?: number
          nom?: string | null
          ouvertures_declares?: number
          ouvertures_terrain?: number | null
          ps_max?: number
          pv_max?: number
          race_id?: string | null
          religion_id?: string | null
          sous_type_chimeride?: string | null
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
          est_croyant?: boolean
          est_finalise?: boolean
          est_mort?: boolean
          est_verrouille?: boolean | null
          etape_creation?: number
          famille_criminelle_id?: string | null
          gn_completes?: number | null
          gn_declares?: number
          historique?: string | null
          id?: string
          joueur_id?: string
          mini_gn_completes?: number | null
          mini_gn_declares?: number
          niveau?: number | null
          niveau_correction?: number
          nom?: string | null
          ouvertures_declares?: number
          ouvertures_terrain?: number | null
          ps_max?: number
          pv_max?: number
          race_id?: string | null
          religion_id?: string | null
          sous_type_chimeride?: string | null
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
            referencedRelation: "profils_joueur"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_banque_joueur"
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
            foreignKeyName: "personnages_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnages_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "vue_demandes_races_attente"
            referencedColumns: ["race_id"]
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
          effet_generique: string | null
          effets: string
          est_actif: boolean
          id: string
          magnitude: string | null
          magnitude_label: string | null
          niveau: number
          niveau_effet: number | null
          nom: string
          rayon: number | null
          recherche_tsv: unknown
          resume_condense: string | null
          type_piege: string
          updated_at: string
        }
        Insert: {
          cible: string
          construction?: string | null
          cout_xp: number
          created_at?: string
          duree: string
          effet_generique?: string | null
          effets: string
          est_actif?: boolean
          id?: string
          magnitude?: string | null
          magnitude_label?: string | null
          niveau: number
          niveau_effet?: number | null
          nom: string
          rayon?: number | null
          recherche_tsv?: unknown
          resume_condense?: string | null
          type_piege?: string
          updated_at?: string
        }
        Update: {
          cible?: string
          construction?: string | null
          cout_xp?: number
          created_at?: string
          duree?: string
          effet_generique?: string | null
          effets?: string
          est_actif?: boolean
          id?: string
          magnitude?: string | null
          magnitude_label?: string | null
          niveau?: number
          niveau_effet?: number | null
          nom?: string
          rayon?: number | null
          recherche_tsv?: unknown
          resume_condense?: string | null
          type_piege?: string
          updated_at?: string
        }
        Relationships: []
      }
      prieres: {
        Row: {
          bonus_niveau: Json | null
          cout_xp_base: number | null
          description: string | null
          description_tronc: string | null
          domaine: string
          duree: string | null
          duree_incantation: string | null
          effet_instance: Json | null
          est_actif: boolean
          id: string
          niveau: number
          nom: string
          paliers: Json | null
          portee: string | null
          recherche_tsv: unknown
          religion_id: string | null
          resume_condense: string | null
          type_priere: string | null
          zone_effet: string | null
        }
        Insert: {
          bonus_niveau?: Json | null
          cout_xp_base?: number | null
          description?: string | null
          description_tronc?: string | null
          domaine: string
          duree?: string | null
          duree_incantation?: string | null
          effet_instance?: Json | null
          est_actif?: boolean
          id?: string
          niveau?: number
          nom: string
          paliers?: Json | null
          portee?: string | null
          recherche_tsv?: unknown
          religion_id?: string | null
          resume_condense?: string | null
          type_priere?: string | null
          zone_effet?: string | null
        }
        Update: {
          bonus_niveau?: Json | null
          cout_xp_base?: number | null
          description?: string | null
          description_tronc?: string | null
          domaine?: string
          duree?: string | null
          duree_incantation?: string | null
          effet_instance?: Json | null
          est_actif?: boolean
          id?: string
          niveau?: number
          nom?: string
          paliers?: Json | null
          portee?: string | null
          recherche_tsv?: unknown
          religion_id?: string | null
          resume_condense?: string | null
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
          cgu_acceptee_le: string | null
          cgu_version_acceptee: string | null
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
          cgu_acceptee_le?: string | null
          cgu_version_acceptee?: string | null
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
          cgu_acceptee_le?: string | null
          cgu_version_acceptee?: string | null
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
      profils_joueur: {
        Row: {
          avatar_url: string | null
          compte_id: string
          cree_le: string
          est_actif: boolean
          est_principal: boolean
          id: string
          nom: string
        }
        Insert: {
          avatar_url?: string | null
          compte_id: string
          cree_le?: string
          est_actif?: boolean
          est_principal?: boolean
          id?: string
          nom: string
        }
        Update: {
          avatar_url?: string | null
          compte_id?: string
          cree_le?: string
          est_actif?: boolean
          est_principal?: boolean
          id?: string
          nom?: string
        }
        Relationships: [
          {
            foreignKeyName: "profils_joueur_compte_id_fkey"
            columns: ["compte_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "race_traits_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "vue_demandes_races_attente"
            referencedColumns: ["race_id"]
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
          emoji: string | null
          esperance_vie: string | null
          est_actif: boolean | null
          est_jouable: boolean
          exigences_costume: string | null
          id: string
          image_url: string | null
          nb_traits_raciaux: number
          nom: string | null
          nom_latin: string | null
          recherche_tsv: unknown
          restrictions_classes: string[] | null
          resume_condense: string | null
          xp_depart: number
        }
        Insert: {
          description?: string | null
          emoji?: string | null
          esperance_vie?: string | null
          est_actif?: boolean | null
          est_jouable?: boolean
          exigences_costume?: string | null
          id?: string
          image_url?: string | null
          nb_traits_raciaux?: number
          nom?: string | null
          nom_latin?: string | null
          recherche_tsv?: unknown
          restrictions_classes?: string[] | null
          resume_condense?: string | null
          xp_depart?: number
        }
        Update: {
          description?: string | null
          emoji?: string | null
          esperance_vie?: string | null
          est_actif?: boolean | null
          est_jouable?: boolean
          exigences_costume?: string | null
          id?: string
          image_url?: string | null
          nb_traits_raciaux?: number
          nom?: string | null
          nom_latin?: string | null
          recherche_tsv?: unknown
          restrictions_classes?: string[] | null
          resume_condense?: string | null
          xp_depart?: number
        }
        Relationships: []
      }
      recettes_alchimie: {
        Row: {
          cout_xp: number | null
          description: string | null
          description_verbatim: string | null
          duree: string | null
          effet: string | null
          est_actif: boolean | null
          formule: string | null
          id: string
          ingredients: Json | null
          niveau_requis: number | null
          nom: string | null
          recherche_tsv: unknown
          resume_condense: string | null
          type: string | null
        }
        Insert: {
          cout_xp?: number | null
          description?: string | null
          description_verbatim?: string | null
          duree?: string | null
          effet?: string | null
          est_actif?: boolean | null
          formule?: string | null
          id?: string
          ingredients?: Json | null
          niveau_requis?: number | null
          nom?: string | null
          recherche_tsv?: unknown
          resume_condense?: string | null
          type?: string | null
        }
        Update: {
          cout_xp?: number | null
          description?: string | null
          description_verbatim?: string | null
          duree?: string | null
          effet?: string | null
          est_actif?: boolean | null
          formule?: string | null
          id?: string
          ingredients?: Json | null
          niveau_requis?: number | null
          nom?: string | null
          recherche_tsv?: unknown
          resume_condense?: string | null
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
          lore_fiche: string | null
          lore_manuel: string | null
          nom: string | null
          pouvoir_symbole: string | null
          recherche_tsv: unknown
          rituels_fiche: string[] | null
          rituels_manuel: string[] | null
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
          lore_fiche?: string | null
          lore_manuel?: string | null
          nom?: string | null
          pouvoir_symbole?: string | null
          recherche_tsv?: unknown
          rituels_fiche?: string[] | null
          rituels_manuel?: string[] | null
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
          lore_fiche?: string | null
          lore_manuel?: string | null
          nom?: string | null
          pouvoir_symbole?: string | null
          recherche_tsv?: unknown
          rituels_fiche?: string[] | null
          rituels_manuel?: string[] | null
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
          materiaux_a_preciser: boolean
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
          materiaux_a_preciser?: boolean
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
          materiaux_a_preciser?: boolean
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
      sections_menu: {
        Row: {
          est_staff: boolean
          libelle: string
          ordre: number
          slug: string
        }
        Insert: {
          est_staff?: boolean
          libelle: string
          ordre: number
          slug: string
        }
        Update: {
          est_staff?: boolean
          libelle?: string
          ordre?: number
          slug?: string
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
          recherche_tsv: unknown
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
          recherche_tsv?: unknown
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
          recherche_tsv?: unknown
          titre?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sorts: {
        Row: {
          bonus_niveau: Json | null
          cercle: string
          cout_xp_base: number | null
          description: string | null
          description_tronc: string | null
          duree: string | null
          effet_instance: Json | null
          est_actif: boolean
          id: string
          niveau: number
          nom: string
          paliers: Json | null
          portee: string | null
          recherche_tsv: unknown
          resume_condense: string | null
          type_sort: string | null
          zone_effet: string | null
        }
        Insert: {
          bonus_niveau?: Json | null
          cercle: string
          cout_xp_base?: number | null
          description?: string | null
          description_tronc?: string | null
          duree?: string | null
          effet_instance?: Json | null
          est_actif?: boolean
          id?: string
          niveau?: number
          nom: string
          paliers?: Json | null
          portee?: string | null
          recherche_tsv?: unknown
          resume_condense?: string | null
          type_sort?: string | null
          zone_effet?: string | null
        }
        Update: {
          bonus_niveau?: Json | null
          cercle?: string
          cout_xp_base?: number | null
          description?: string | null
          description_tronc?: string | null
          duree?: string | null
          effet_instance?: Json | null
          est_actif?: boolean
          id?: string
          niveau?: number
          nom?: string
          paliers?: Json | null
          portee?: string | null
          recherche_tsv?: unknown
          resume_condense?: string | null
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
          recherche_tsv: unknown
          resume_condense: string | null
          texte_manuel: string | null
          updated_at: string | null
        }
        Insert: {
          cout_xp?: number
          created_at?: string | null
          description: string
          est_actif?: boolean | null
          id?: string
          nom: string
          recherche_tsv?: unknown
          resume_condense?: string | null
          texte_manuel?: string | null
          updated_at?: string | null
        }
        Update: {
          cout_xp?: number
          created_at?: string | null
          description?: string
          est_actif?: boolean | null
          id?: string
          nom?: string
          recherche_tsv?: unknown
          resume_condense?: string | null
          texte_manuel?: string | null
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
          niveau_pieges: number | null
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
          niveau_pieges: number | null
          niveau_runes: number | null
          personnage_id: string | null
          quota_alchimie_intermediaire_total: number | null
          quota_alchimie_intermediaire_utilises: number | null
          quota_alchimie_majeure_total: number | null
          quota_alchimie_majeure_utilises: number | null
          quota_alchimie_mineure_total: number | null
          quota_alchimie_mineure_utilises: number | null
          quota_assemblages_total: number | null
          quota_assemblages_utilises: number | null
          quota_pieges_amelioration_niv2_total: number | null
          quota_pieges_amelioration_niv2_utilises: number | null
          quota_pieges_amelioration_niv3_total: number | null
          quota_pieges_amelioration_niv3_utilises: number | null
          quota_pieges_niv1_total: number | null
          quota_pieges_niv1_utilises: number | null
          quota_recettes_total: number | null
        }
        Relationships: []
      }
      vue_assemblages_personnage: {
        Row: {
          cible: string | null
          cout_ps: number | null
          cout_ps_maitrise: number | null
          description: string | null
          duree: string | null
          effet: string | null
          effet_maitrise: string | null
          id: string | null
          nom: string | null
          personnage_id: string | null
          resume_condense: string | null
          runes_requises: string[] | null
          texte_manuel: string | null
          xp_depense: number | null
        }
        Relationships: [
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
            referencedRelation: "vue_fiche_personnage"
            referencedColumns: ["id"]
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
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_assemblages_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin_complet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_assemblages_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_joueur"
            referencedColumns: ["id"]
          },
        ]
      }
      vue_banque_joueur: {
        Row: {
          joueur_id: string | null
          solde: number | null
          total_gagne: number | null
          total_transfere: number | null
        }
        Relationships: []
      }
      vue_banque_mouvements: {
        Row: {
          acteur_id: string | null
          acteur_nom: string | null
          created_at: string | null
          description: string | null
          evenement_id: string | null
          evenement_titre: string | null
          evenement_type: string | null
          id: string | null
          joueur_id: string | null
          libelle: string | null
          montant: number | null
          personnage_cible_id: string | null
          personnage_cible_nom: string | null
          type_mouvement: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banque_xp_mouvements_acteur_id_fkey"
            columns: ["acteur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "evenements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "vue_evenements_publies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "vue_prochain_evenement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "profils_joueur"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_banque_joueur"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_personnage_cible_id_fkey"
            columns: ["personnage_cible_id"]
            isOneToOne: false
            referencedRelation: "personnages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_personnage_cible_id_fkey"
            columns: ["personnage_cible_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_personnage_cible_id_fkey"
            columns: ["personnage_cible_id"]
            isOneToOne: false
            referencedRelation: "vue_artisanat_quotas"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_personnage_cible_id_fkey"
            columns: ["personnage_cible_id"]
            isOneToOne: false
            referencedRelation: "vue_fiche_personnage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_personnage_cible_id_fkey"
            columns: ["personnage_cible_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_personnage_cible_id_fkey"
            columns: ["personnage_cible_id"]
            isOneToOne: false
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_personnage_cible_id_fkey"
            columns: ["personnage_cible_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin_complet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banque_xp_mouvements_personnage_cible_id_fkey"
            columns: ["personnage_cible_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_joueur"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "vue_fiche_personnage"
            referencedColumns: ["id"]
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
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin_complet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_joueur"
            referencedColumns: ["id"]
          },
        ]
      }
      vue_cimetiere: {
        Row: {
          classe: string | null
          created_at: string | null
          date_mort: string | null
          epitaphe: string | null
          id: string | null
          joueur_nom: string | null
          niveau: number | null
          nom: string | null
          personnage_id_origine: string | null
          race: string | null
          snapshot: Json | null
        }
        Insert: {
          classe?: string | null
          created_at?: string | null
          date_mort?: string | null
          epitaphe?: string | null
          id?: string | null
          joueur_nom?: string | null
          niveau?: number | null
          nom?: string | null
          personnage_id_origine?: string | null
          race?: string | null
          snapshot?: Json | null
        }
        Update: {
          classe?: string | null
          created_at?: string | null
          date_mort?: string | null
          epitaphe?: string | null
          id?: string | null
          joueur_nom?: string | null
          niveau?: number | null
          nom?: string | null
          personnage_id_origine?: string | null
          race?: string | null
          snapshot?: Json | null
        }
        Relationships: []
      }
      vue_competences_encyclopedie: {
        Row: {
          categorie: string | null
          classes_requises: string[] | null
          desachat_force: boolean | null
          description: string | null
          est_actif: boolean | null
          est_general: boolean | null
          id: string | null
          niveaux: Json | null
          nom: string | null
          prerequis_competences: Json | null
          prerequis_labels: Json | null
          recherche_tsv: unknown
          resume_condense: string | null
          type_achat: string | null
          type_choix: string | null
          verrouillage_croise: boolean | null
        }
        Insert: {
          categorie?: string | null
          classes_requises?: string[] | null
          desachat_force?: boolean | null
          description?: string | null
          est_actif?: boolean | null
          est_general?: boolean | null
          id?: string | null
          niveaux?: Json | null
          nom?: string | null
          prerequis_competences?: Json | null
          prerequis_labels?: never
          recherche_tsv?: unknown
          resume_condense?: string | null
          type_achat?: string | null
          type_choix?: string | null
          verrouillage_croise?: boolean | null
        }
        Update: {
          categorie?: string | null
          classes_requises?: string[] | null
          desachat_force?: boolean | null
          description?: string | null
          est_actif?: boolean | null
          est_general?: boolean | null
          id?: string | null
          niveaux?: Json | null
          nom?: string | null
          prerequis_competences?: Json | null
          prerequis_labels?: never
          recherche_tsv?: unknown
          resume_condense?: string | null
          type_achat?: string | null
          type_choix?: string | null
          verrouillage_croise?: boolean | null
        }
        Relationships: []
      }
      vue_competences_maitre_admin: {
        Row: {
          choix_achat: string | null
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
      vue_competences_personnage: {
        Row: {
          appris_via_maitre: boolean | null
          categorie: string | null
          choix_achat: string | null
          competence_description: string | null
          competence_id: string | null
          competence_resume_condense: string | null
          description_courte_niveau_acquis: string | null
          description_niveau_acquis: string | null
          id: string | null
          niveau_acquis: number | null
          niveau_max: number | null
          nom: string | null
          nom_maitre: string | null
          personnage_id: string | null
          statut_maitre: string | null
          type_achat: string | null
          xp_depense: number | null
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
            foreignKeyName: "personnage_competences_competence_id_fkey"
            columns: ["competence_id"]
            isOneToOne: false
            referencedRelation: "vue_competences_encyclopedie"
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
            referencedRelation: "vue_fiche_personnage"
            referencedColumns: ["id"]
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
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin_complet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_joueur"
            referencedColumns: ["id"]
          },
        ]
      }
      vue_demandes_morts_attente: {
        Row: {
          classe_nom: string | null
          created_at: string | null
          epitaphe: string | null
          id: string | null
          joueur_id: string | null
          joueur_nom: string | null
          niveau: number | null
          personnage_id: string | null
          personnage_nom: string | null
          race_nom: string | null
          statut: string | null
        }
        Insert: {
          classe_nom?: string | null
          created_at?: string | null
          epitaphe?: string | null
          id?: string | null
          joueur_id?: never
          joueur_nom?: string | null
          niveau?: number | null
          personnage_id?: string | null
          personnage_nom?: string | null
          race_nom?: string | null
          statut?: string | null
        }
        Update: {
          classe_nom?: string | null
          created_at?: string | null
          epitaphe?: string | null
          id?: string | null
          joueur_id?: never
          joueur_nom?: string | null
          niveau?: number | null
          personnage_id?: string | null
          personnage_nom?: string | null
          race_nom?: string | null
          statut?: string | null
        }
        Relationships: []
      }
      vue_demandes_races_attente: {
        Row: {
          background: string | null
          date_demande: string | null
          id: string | null
          joueur_email: string | null
          joueur_id: string | null
          joueur_nom: string | null
          personnage_id: string | null
          personnage_niveau: number | null
          personnage_nom: string | null
          race_id: string | null
          race_nom: string | null
          race_nom_latin: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personnage_races_demandes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: true
            referencedRelation: "personnages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_races_demandes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: true
            referencedRelation: "vue_artisanat_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_races_demandes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: true
            referencedRelation: "vue_artisanat_quotas"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_races_demandes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: true
            referencedRelation: "vue_fiche_personnage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_races_demandes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: true
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_races_demandes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: true
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_races_demandes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: true
            referencedRelation: "vue_personnages_admin_complet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_races_demandes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: true
            referencedRelation: "vue_personnages_joueur"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "profils_joueur"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_banque_joueur"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["joueur_id"]
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
            referencedRelation: "vue_fiche_personnage"
            referencedColumns: ["id"]
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
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin_complet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_competences_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_joueur"
            referencedColumns: ["id"]
          },
        ]
      }
      vue_evenements_publies: {
        Row: {
          adresse_physique: string | null
          date_evenement: string | null
          date_fin: string | null
          description: string | null
          id: string | null
          lieu: string | null
          max_participants: number | null
          nb_inscrits: number | null
          niveaux_recompense: number | null
          titre: string | null
          type_evenement: string | null
          xp_recompense: number | null
        }
        Insert: {
          adresse_physique?: string | null
          date_evenement?: string | null
          date_fin?: string | null
          description?: string | null
          id?: string | null
          lieu?: string | null
          max_participants?: number | null
          nb_inscrits?: never
          niveaux_recompense?: number | null
          titre?: string | null
          type_evenement?: string | null
          xp_recompense?: number | null
        }
        Update: {
          adresse_physique?: string | null
          date_evenement?: string | null
          date_fin?: string | null
          description?: string | null
          id?: string | null
          lieu?: string | null
          max_participants?: number | null
          nb_inscrits?: never
          niveaux_recompense?: number | null
          titre?: string | null
          type_evenement?: string | null
          xp_recompense?: number | null
        }
        Relationships: []
      }
      vue_fiche_personnage: {
        Row: {
          ame_personnage: string | null
          classe_description: string | null
          classe_emoji: string | null
          classe_id: string | null
          classe_nom: string | null
          classe_resume_condense: string | null
          classe_role_combat: string | null
          est_actif: boolean | null
          est_mort: boolean | null
          gn_completes: number | null
          historique: string | null
          id: string | null
          joueur_id: string | null
          mini_gn_completes: number | null
          niveau: number | null
          nom: string | null
          ouvertures_terrain: number | null
          ps_max: number | null
          pv_max: number | null
          race_description: string | null
          race_emoji: string | null
          race_esperance_vie: string | null
          race_exigences_costume: string | null
          race_id: string | null
          race_image_url: string | null
          race_nom: string | null
          race_nom_latin: string | null
          race_resume_condense: string | null
          religion_id: string | null
          religion_nom: string | null
          traits_raciaux_choisis: Json | null
          xp_depense: number | null
          xp_total: number | null
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
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "profils_joueur"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_banque_joueur"
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
            foreignKeyName: "personnages_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnages_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "vue_demandes_races_attente"
            referencedColumns: ["race_id"]
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
      vue_inscriptions_par_evenement: {
        Row: {
          classe_nom: string | null
          date_confirmation: string | null
          date_evenement: string | null
          date_inscription: string | null
          est_actif: boolean | null
          est_mort: boolean | null
          est_termine: boolean | null
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
            referencedRelation: "vue_evenements_publies"
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
      vue_journal_mon_personnage: {
        Row: {
          acteur_id: string | null
          acteur_nom: string | null
          acteur_role: string | null
          action: string | null
          cible_id: string | null
          cible_type: string | null
          created_at: string | null
          details: Json | null
          id: string | null
        }
        Insert: {
          acteur_id?: string | null
          acteur_nom?: never
          acteur_role?: string | null
          action?: string | null
          cible_id?: string | null
          cible_type?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string | null
        }
        Update: {
          acteur_id?: string | null
          acteur_nom?: never
          acteur_role?: string | null
          action?: string | null
          cible_id?: string | null
          cible_type?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string | null
        }
        Relationships: []
      }
      vue_journal_staff: {
        Row: {
          acteur_id: string | null
          acteur_nom: string | null
          acteur_role: string | null
          action: string | null
          cible_id: string | null
          cible_nom: string | null
          cible_type: string | null
          created_at: string | null
          details: Json | null
          id: string | null
          raison: string | null
        }
        Insert: {
          acteur_id?: string | null
          acteur_nom?: never
          acteur_role?: string | null
          action?: string | null
          cible_id?: string | null
          cible_nom?: never
          cible_type?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string | null
          raison?: never
        }
        Update: {
          acteur_id?: string | null
          acteur_nom?: never
          acteur_role?: string | null
          action?: string | null
          cible_id?: string | null
          cible_nom?: never
          cible_type?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string | null
          raison?: never
        }
        Relationships: []
      }
      vue_notifications_staff: {
        Row: {
          a_traiter: boolean | null
          created_at: string | null
          demande_statut: string | null
          id: string | null
          lu: boolean | null
          message: string | null
          profil_id: string | null
          reference_id: string | null
          traite_le: string | null
          traite_par_id: string | null
          traite_par_nom: string | null
          type: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profil_id_fkey"
            columns: ["profil_id"]
            isOneToOne: false
            referencedRelation: "profils_joueur"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_profil_id_fkey"
            columns: ["profil_id"]
            isOneToOne: false
            referencedRelation: "vue_banque_joueur"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "notifications_profil_id_fkey"
            columns: ["profil_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_races_demandes_approuve_par_fkey"
            columns: ["traite_par_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          niveau_pieges: number | null
          niveau_runes: number | null
          personnage_id: string | null
          xp_disponible: number | null
        }
        Relationships: [
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "profils_joueur"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_banque_joueur"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["joueur_id"]
          },
        ]
      }
      vue_personnages_admin_complet: {
        Row: {
          assemblages: Json | null
          classe_nom: string | null
          classe_secondaire_nom: string | null
          competences: Json | null
          created_at: string | null
          est_actif: boolean | null
          est_finalise: boolean | null
          est_mort: boolean | null
          est_verrouille: boolean | null
          etape_creation: number | null
          famille_nom: string | null
          id: string | null
          joueur_id: string | null
          joueur_nom: string | null
          niveau: number | null
          niveau_correction: number | null
          nom: string | null
          pieges: Json | null
          prieres: Json | null
          race_nom: string | null
          recettes: Json | null
          religion_nom: string | null
          sorts: Json | null
          traits_raciaux: Json | null
          xp_depense: number | null
          xp_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "profils_joueur"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_banque_joueur"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["joueur_id"]
          },
        ]
      }
      vue_personnages_joueur: {
        Row: {
          classe_nom: string | null
          created_at: string | null
          dans_fenetre_gel: boolean | null
          est_actif: boolean | null
          est_finalise: boolean | null
          etape_creation: number | null
          etat: string | null
          evenement_inscrit_date: string | null
          evenement_inscrit_titre: string | null
          gn_completes: number | null
          id: string | null
          joueur_id: string | null
          mini_gn_completes: number | null
          niveau: number | null
          nom: string | null
          ouvertures_terrain: number | null
          race_nom: string | null
          xp_depense: number | null
          xp_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "profils_joueur"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_banque_joueur"
            referencedColumns: ["joueur_id"]
          },
          {
            foreignKeyName: "personnages_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "vue_inscriptions_par_evenement"
            referencedColumns: ["joueur_id"]
          },
        ]
      }
      vue_prieres_personnage: {
        Row: {
          bonus_niveau: Json | null
          cout_xp_base: number | null
          description_tronc: string | null
          domaine: string | null
          duree_choisie: string | null
          duree_incantation: string | null
          duree_incantation_calculee: number | null
          effet_instance: Json | null
          id: string | null
          niveau_priere: number | null
          nom_personnalise: string | null
          paliers: Json | null
          personnage_id: string | null
          portee_choisie: string | null
          priere_description: string | null
          priere_resume_condense: string | null
          type_priere: string | null
          zone_choisie: string | null
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
            referencedRelation: "vue_fiche_personnage"
            referencedColumns: ["id"]
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
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_prieres_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin_complet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_prieres_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_joueur"
            referencedColumns: ["id"]
          },
        ]
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
        ]
      }
      vue_recettes_personnage: {
        Row: {
          description: string | null
          description_verbatim: string | null
          effet: string | null
          formule: string | null
          id: string | null
          ingredients: Json | null
          niveau_requis: number | null
          nom: string | null
          personnage_id: string | null
          type: string | null
          xp_depense: number | null
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
            referencedRelation: "vue_fiche_personnage"
            referencedColumns: ["id"]
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
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_recettes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin_complet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_recettes_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_joueur"
            referencedColumns: ["id"]
          },
        ]
      }
      vue_sorts_personnage: {
        Row: {
          bonus_niveau: Json | null
          cercle: string | null
          cout_xp_base: number | null
          description_tronc: string | null
          duree_choisie: string | null
          effet_instance: Json | null
          formule_magique: string | null
          id: string | null
          niveau_sort: number | null
          nom_personnalise: string | null
          paliers: Json | null
          personnage_id: string | null
          portee_choisie: string | null
          sort_description: string | null
          sort_nom_base: string | null
          sort_resume_condense: string | null
          type_sort: string | null
          zone_choisie: string | null
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
            referencedRelation: "vue_fiche_personnage"
            referencedColumns: ["id"]
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
            referencedRelation: "vue_personnage_etat"
            referencedColumns: ["personnage_id"]
          },
          {
            foreignKeyName: "personnage_sorts_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_admin_complet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnage_sorts_personnage_id_fkey"
            columns: ["personnage_id"]
            isOneToOne: false
            referencedRelation: "vue_personnages_joueur"
            referencedColumns: ["id"]
          },
        ]
      }
      vue_stats_admin: {
        Row: {
          nb_competences_attente: number | null
          nb_joueurs: number | null
          nb_personnages_actifs: number | null
          nb_presences_attente: number | null
          nb_races_attente: number | null
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
          trait_resume_condense: string | null
          trait_texte_manuel: string | null
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
            foreignKeyName: "race_traits_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "vue_demandes_races_attente"
            referencedColumns: ["race_id"]
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
    }
    Functions: {
      _figer_stele: {
        Args: {
          p_cree_par: string
          p_epitaphe: string
          p_personnage_id: string
          p_statut?: string
          p_tuer?: boolean
        }
        Returns: string
      }
      _purger_compte_interne: {
        Args: { p_compte_id: string }
        Returns: undefined
      }
      _purger_personnage_interne: {
        Args: { p_personnage_id: string }
        Returns: undefined
      }
      _purger_profil_interne: {
        Args: { p_profil_id: string }
        Returns: undefined
      }
      _snip_contient: {
        Args: { p_corps: string; p_terme_ua: string }
        Returns: string
      }
      accepter_cgu: { Args: { p_version: string }; Returns: Json }
      acheter_assemblage: {
        Args: { p_assemblage_id: string; p_personnage_id: string }
        Returns: Json
      }
      acheter_competence: {
        Args: {
          p_appris_via_maitre?: boolean
          p_choix_achat?: string
          p_competence_id: string
          p_niveau_desire: number
          p_nom_maitre?: string
          p_personnage_id: string
        }
        Returns: Json
      }
      acheter_piege: {
        Args: { p_personnage_id: string; p_piege_id: string }
        Returns: Json
      }
      acheter_priere: {
        Args: {
          p_duree_choisie: string
          p_niveau_priere: number
          p_nom_personnalise: string
          p_personnage_id: string
          p_portee_choisie: string
          p_priere_id: string
          p_zone_choisie: string
        }
        Returns: Json
      }
      acheter_recette: {
        Args: { p_personnage_id: string; p_recette_id: string }
        Returns: Json
      }
      acheter_sort: {
        Args: {
          p_duree_choisie: string
          p_niveau_sort: number
          p_nom_personnalise: string
          p_personnage_id: string
          p_portee_choisie: string
          p_sort_id: string
          p_zone_choisie: string
        }
        Returns: Json
      }
      acheter_trait_racial: {
        Args: { p_personnage_id: string; p_trait_id: string }
        Returns: Json
      }
      ajouter_presence_tardive: {
        Args: { p_evenement_id: string; p_personnage_id: string }
        Returns: Json
      }
      ajuster_banque_xp: {
        Args: { p_description: string; p_joueur_id: string; p_montant: number }
        Returns: Json
      }
      annuler_etape: {
        Args: {
          p_dry_run?: boolean
          p_etape_courante: number
          p_personnage_id: string
        }
        Returns: Json
      }
      anonymiser_journal_purges: { Args: { p_delai?: string }; Returns: Json }
      apercu_purge: { Args: { p_id: string; p_type: string }; Returns: Json }
      apercu_rabais_acquisition: {
        Args: {
          p_choix_achat: string
          p_competence_id: string
          p_niveau: number
          p_personnage_id: string
        }
        Returns: Json
      }
      apercu_rabais_acquisition_competence: {
        Args: { p_competence_id: string; p_personnage_id: string }
        Returns: Json
      }
      apercu_suppression: {
        Args: { p_cible: string; p_id_cible: string }
        Returns: Json
      }
      approuver_maitre_competence: {
        Args: { p_personnage_competence_id: string }
        Returns: Json
      }
      approuver_mort_demande: {
        Args: { p_epitaphe_finale?: string; p_stele_id: string }
        Returns: Json
      }
      approuver_race_demande: { Args: { p_demande_id: string }; Returns: Json }
      assembler_prerequis_labels: {
        Args: { p_competence_id: string }
        Returns: Json
      }
      attribuer_competences_gratuites_classe: {
        Args: { p_choix_par_competence?: Json; p_personnage_id: string }
        Returns: Json
      }
      attribuer_xp_evenement: {
        Args: { p_inscription_id: string }
        Returns: Json
      }
      avancer_etape: {
        Args: { p_etape_courante: number; p_personnage_id: string }
        Returns: Json
      }
      bloquer_compte: {
        Args: { p_compte_id: string; p_raison?: string }
        Returns: Json
      }
      bloquer_personnage: {
        Args: { p_personnage_id: string; p_raison?: string }
        Returns: Json
      }
      bloquer_profil: {
        Args: { p_profil_id: string; p_raison?: string }
        Returns: Json
      }
      calculer_cout_xp_magie: {
        Args: {
          p_cout_xp_base: number
          p_duree_choisie: string
          p_niveau: number
          p_portee_choisie: string
          p_zone_choisie: string
        }
        Returns: number
      }
      calculer_duree_incantation_priere: {
        Args: {
          p_duree_choisie: string
          p_niveau: number
          p_portee_choisie: string
          p_zone_choisie: string
        }
        Returns: number
      }
      capturer_compo_personnage: {
        Args: { p_personnage_id: string }
        Returns: Json
      }
      changer_classe_personnage: {
        Args: {
          p_choix_par_competence?: Json
          p_classe_id: string
          p_dry_run?: boolean
          p_personnage_id: string
        }
        Returns: Json
      }
      changer_classe_personnage_interne: {
        Args: {
          p_choix_par_competence?: Json
          p_classe_id: string
          p_dry_run?: boolean
          p_personnage_id: string
        }
        Returns: Json
      }
      changer_role_compte: {
        Args: { p_compte_id: string; p_role: string }
        Returns: Json
      }
      changer_statut_inscription: {
        Args: { p_inscription_id: string; p_nouveau_statut: string }
        Returns: Json
      }
      cloturer_evenement: { Args: { p_evenement_id: string }; Returns: Json }
      compte_voit_joueur: { Args: { p_joueur_id: string }; Returns: boolean }
      corriger_niveau_personnage: {
        Args: { p_delta: number; p_personnage_id: string; p_raison?: string }
        Returns: Json
      }
      corriger_xp_personnage: {
        Args: { p_montant: number; p_personnage_id: string; p_raison?: string }
        Returns: Json
      }
      cout_pts_duree: { Args: { p_duree: string }; Returns: number }
      cout_pts_portee: { Args: { p_portee: string }; Returns: number }
      cout_pts_zone: { Args: { p_zone: string }; Returns: number }
      crediter_banque_xp: {
        Args: {
          p_description?: string
          p_evenement_id: string
          p_joueur_id: string
          p_montant: number
        }
        Returns: Json
      }
      creer_demande_mort: {
        Args: { p_epitaphe: string; p_personnage_id: string }
        Returns: Json
      }
      creer_demande_race: {
        Args: { p_background: string; p_personnage_id: string }
        Returns: Json
      }
      creer_notification: {
        Args: {
          p_compte_id?: string
          p_message: string
          p_profil_id?: string
          p_reference_id?: string
          p_statut?: string
          p_type?: string
        }
        Returns: string
      }
      creer_notification_staff: {
        Args: { p_message: string; p_reference_id?: string; p_type: string }
        Returns: number
      }
      creer_stele_directe: {
        Args: { p_epitaphe?: string; p_personnage_id: string }
        Returns: Json
      }
      creer_steles_et_supprimer: {
        Args: { p_cible: string; p_demandes?: Json; p_id_cible: string }
        Returns: Json
      }
      debloquer_compte: { Args: { p_compte_id: string }; Returns: Json }
      debloquer_personnage: { Args: { p_personnage_id: string }; Returns: Json }
      debloquer_profil: { Args: { p_profil_id: string }; Returns: Json }
      definir_profil_principal: { Args: { p_profil_id: string }; Returns: Json }
      demarrer_creation_personnage: {
        Args: { p_profil_id?: string }
        Returns: Json
      }
      derniere_photo_compo: { Args: { p_personnage_id: string }; Returns: Json }
      desacheter_assemblage: {
        Args: { p_personnage_assemblage_id: string }
        Returns: Json
      }
      desacheter_competence: {
        Args: { p_dry_run?: boolean; p_personnage_competence_id: string }
        Returns: Json
      }
      desacheter_piege: {
        Args: { p_personnage_piege_id: string }
        Returns: Json
      }
      desacheter_priere: {
        Args: { p_dry_run?: boolean; p_personnage_priere_id: string }
        Returns: Json
      }
      desacheter_recette: {
        Args: { p_personnage_recette_id: string }
        Returns: Json
      }
      desacheter_sort: {
        Args: { p_dry_run?: boolean; p_personnage_sort_id: string }
        Returns: Json
      }
      deverrouiller_personnage: {
        Args: { p_personnage_id: string }
        Returns: Json
      }
      diff_compo_photos: {
        Args: { p_apres: Json; p_avant: Json }
        Returns: Json
      }
      doit_logger_action: { Args: { p_joueur_id: string }; Returns: boolean }
      donner_xp_bonus: {
        Args: { p_montant: number; p_personnage_id: string; p_raison?: string }
        Returns: Json
      }
      est_admin: { Args: never; Returns: boolean }
      est_animateur_ou_admin: { Args: never; Returns: boolean }
      etat_edition_personnage: {
        Args: { p_personnage_id: string }
        Returns: Json
      }
      f_unaccent: { Args: { "": string }; Returns: string }
      fixtures_parite_visiteur: { Args: never; Returns: Json }
      fixtures_parite_visiteur_type: { Args: { p_type: string }; Returns: Json }
      fixtures_visiteur_assemblages: { Args: never; Returns: Json }
      fixtures_visiteur_pieges: { Args: never; Returns: Json }
      fixtures_visiteur_prieres: { Args: never; Returns: Json }
      fixtures_visiteur_recettes: { Args: never; Returns: Json }
      fixtures_visiteur_sorts: { Args: never; Returns: Json }
      fixtures_visiteur_traits_raciaux: { Args: never; Returns: Json }
      formater_classes_requises_label: {
        Args: { p_classes: string[] }
        Returns: string
      }
      formater_prereq_label: {
        Args: { p_niveau_min: number; p_nom: string }
        Returns: string
      }
      gate_edition_personnage: {
        Args: { p_mode: string; p_personnage_id: string }
        Returns: Json
      }
      generer_formule_magique: {
        Args: {
          p_cercle: string
          p_duree: string
          p_niveau: number
          p_portee: string
          p_zone: string
        }
        Returns: string
      }
      get_stats_admin: { Args: never; Returns: Json }
      immutable_array_to_string: { Args: { arr: string[] }; Returns: string }
      joueur_actif: { Args: { p_profil_id?: string }; Returns: string }
      journal_evolution_personnage: {
        Args: { p_personnage_id: string }
        Returns: Json
      }
      journaliser_changement_role: {
        Args: {
          p_acteur: string
          p_ancien: string
          p_cible: string
          p_nom: string
          p_nouveau: string
        }
        Returns: undefined
      }
      log_audit: {
        Args: {
          p_action: string
          p_cible_id: string
          p_cible_type: string
          p_details?: Json
        }
        Returns: string
      }
      marquer_absent: { Args: { p_inscription_id: string }; Returns: Json }
      marquer_present: { Args: { p_inscription_id: string }; Returns: Json }
      mode_staff_serveur_actif: { Args: never; Returns: boolean }
      modifier_priere: {
        Args: {
          p_duree_choisie: string
          p_niveau_priere: number
          p_nom_personnalise?: string
          p_personnage_priere_id: string
          p_portee_choisie: string
          p_zone_choisie: string
        }
        Returns: Json
      }
      modifier_sort: {
        Args: {
          p_duree_choisie: string
          p_niveau_sort: number
          p_nom_personnalise?: string
          p_personnage_sort_id: string
          p_portee_choisie: string
          p_zone_choisie: string
        }
        Returns: Json
      }
      modifier_stele: {
        Args: {
          p_cimetiere_id: string
          p_date_mort?: string
          p_epitaphe?: string
          p_joueur_nom?: string
        }
        Returns: Json
      }
      nom_profil_principal: { Args: { p_acteur_id: string }; Returns: string }
      personnage_a_des_prieres: {
        Args: { p_personnage_id: string }
        Returns: boolean
      }
      personnage_a_des_sorts: {
        Args: { p_personnage_id: string }
        Returns: boolean
      }
      personnage_est_modifiable: {
        Args: { p_personnage_id: string }
        Returns: boolean
      }
      personnage_est_runiste: {
        Args: { p_personnage_id: string }
        Returns: boolean
      }
      personnage_inapte_magie: {
        Args: { p_personnage_id: string }
        Returns: boolean
      }
      peut_acheter_assemblage: {
        Args: { p_assemblage_id: string; p_personnage_id: string }
        Returns: Json
      }
      peut_acheter_competence: {
        Args: {
          p_choix_achat?: string
          p_competence_id: string
          p_niveau_desire: number
          p_personnage_id: string
        }
        Returns: Json
      }
      peut_acheter_competence_noyau: {
        Args: {
          p_choix_achat?: string
          p_competence_id: string
          p_niveau_desire: number
          p_personnage_id: string
        }
        Returns: Json
      }
      peut_acheter_piege: {
        Args: { p_personnage_id: string; p_piege_id: string }
        Returns: Json
      }
      peut_acheter_priere: {
        Args: {
          p_duree_choisie: string
          p_niveau_priere: number
          p_personnage_id: string
          p_portee_choisie: string
          p_priere_id: string
          p_zone_choisie: string
        }
        Returns: Json
      }
      peut_acheter_recette: {
        Args: { p_personnage_id: string; p_recette_id: string }
        Returns: Json
      }
      peut_acheter_sort: {
        Args: {
          p_duree_choisie: string
          p_niveau_sort: number
          p_personnage_id: string
          p_portee_choisie: string
          p_sort_id: string
          p_zone_choisie: string
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
      peut_editer_personnage: {
        Args: { p_joueur_id: string }
        Returns: boolean
      }
      plafond_cout_magie: { Args: { p_niveau: number }; Returns: number }
      profils_du_compte: { Args: { c: string }; Returns: string[] }
      purger_compte: {
        Args: { p_compte_id: string; p_raison?: string }
        Returns: Json
      }
      purger_notifications_anciennes: { Args: never; Returns: number }
      purger_personnage: {
        Args: { p_personnage_id: string; p_raison?: string }
        Returns: Json
      }
      purger_profil: {
        Args: { p_profil_id: string; p_raison?: string }
        Returns: Json
      }
      recalculer_ps_max: {
        Args: { p_personnage_id: string }
        Returns: undefined
      }
      recalculer_pv_max: {
        Args: { p_personnage_id: string }
        Returns: undefined
      }
      recalculer_xp_personnage: {
        Args: { p_personnage_id: string }
        Returns: Json
      }
      recalculer_xp_valeurs: {
        Args: {
          p_gn_completes: number
          p_gn_declares?: number
          p_mini_gn_completes: number
          p_mini_gn_declares?: number
          p_niveau_correction: number
          p_ouvertures_declares?: number
          p_ouvertures_terrain: number
          p_personnage_id: string
          p_race_id: string
        }
        Returns: {
          niveau: number
          xp_depense: number
          xp_total: number
        }[]
      }
      rechercher_encyclopedie: {
        Args: { p_terme: string }
        Returns: {
          categorie: string
          id: string
          rang: number
          snippet: string
          sous_titre: string
          titre: string
          type: string
        }[]
      }
      reconcilier_assemblages: {
        Args: { p_personnage_id: string }
        Returns: undefined
      }
      reconcilier_recettes: {
        Args: { p_personnage_id: string }
        Returns: undefined
      }
      refus_plafond_magie: {
        Args: { p_cout_xp: number; p_niveau: number; p_type: string }
        Returns: string
      }
      refuser_maitre_competence: {
        Args: { p_personnage_competence_id: string; p_raison?: string }
        Returns: Json
      }
      refuser_mort_demande: {
        Args: { p_raison?: string; p_stele_id: string }
        Returns: Json
      }
      refuser_race_demande: {
        Args: { p_demande_id: string; p_raison: string }
        Returns: Json
      }
      reouvrir_personnage: { Args: { p_personnage_id: string }; Returns: Json }
      role_du_profil: { Args: { _user_id: string }; Returns: string }
      sauvegarder_etape_1: {
        Args: {
          p_ame_personnage?: string
          p_brouillon?: boolean
          p_est_croyant: boolean
          p_gn_completes: number
          p_historique?: string
          p_mini_gn_completes: number
          p_nom: string
          p_ouvertures_terrain: number
          p_personnage_id: string
          p_religion_id: string
        }
        Returns: Json
      }
      sauvegarder_etape_2: {
        Args: {
          p_brouillon?: boolean
          p_justification?: string
          p_personnage_id: string
          p_race_id: string
          p_sous_type_chimeride?: string
        }
        Returns: Json
      }
      sauvegarder_etape_3: {
        Args: {
          p_brouillon?: boolean
          p_personnage_id: string
          p_traits_raciaux_choisis: Json
        }
        Returns: Json
      }
      sauvegarder_etape_4: {
        Args: {
          p_brouillon?: boolean
          p_choix_par_competence?: Json
          p_classe_id: string
          p_personnage_id: string
        }
        Returns: Json
      }
      snapshot_visiteur: { Args: never; Returns: Json }
      supprimer_stele: { Args: { p_cimetiere_id: string }; Returns: Json }
      transferer_banque_vers_personnage: {
        Args: { p_montant: number; p_personnage_cible_id: string }
        Returns: Json
      }
      transferer_personnage: {
        Args: { p_personnage_id: string; p_profil_cible_id: string }
        Returns: Json
      }
      valider_etape: {
        Args: { p_etape: number; p_personnage_id: string }
        Returns: Json
      }
      valider_etape_1: { Args: { p_personnage_id: string }; Returns: Json }
      valider_etape_10: { Args: { p_personnage_id: string }; Returns: Json }
      valider_etape_2: { Args: { p_personnage_id: string }; Returns: Json }
      valider_etape_3: { Args: { p_personnage_id: string }; Returns: Json }
      valider_etape_4: { Args: { p_personnage_id: string }; Returns: Json }
      valider_etape_5: { Args: { p_personnage_id: string }; Returns: Json }
      valider_etape_6: { Args: { p_personnage_id: string }; Returns: Json }
      valider_etape_7: { Args: { p_personnage_id: string }; Returns: Json }
      valider_etape_8: { Args: { p_personnage_id: string }; Returns: Json }
      valider_etape_9: { Args: { p_personnage_id: string }; Returns: Json }
      valider_format_traits_raciaux: {
        Args: { p_traits: Json }
        Returns: boolean
      }
      valider_personnage_final: {
        Args: { p_personnage_id: string }
        Returns: Json
      }
      verifier_invariant_ps: {
        Args: never
        Returns: {
          nom: string
          personnage_id: string
          ps_attendu: number
          ps_stocke: number
        }[]
      }
      verifier_invariant_pv: {
        Args: never
        Returns: {
          nom: string
          personnage_id: string
          pv_attendu: number
          pv_stocke: number
        }[]
      }
      verifier_invariant_xp: {
        Args: never
        Returns: {
          niveau_calc: number
          niveau_stocke: number
          nom: string
          personnage_id: string
          xp_depense_calc: number
          xp_depense_stocke: number
          xp_total_calc: number
          xp_total_stocke: number
        }[]
      }
      verifier_prerequis_competences: {
        Args: { p_personnage_id: string }
        Returns: Json
      }
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
