UPDATE competences
SET prerequis_competences = '{"1": [{"niveau_min": 1, "competence_nom": "Connaissances des Créatures"}, {"niveau_min": 1, "competence_nom": "Premiers Soins"}], "2": [{"niveau_min": 2, "competence_nom": "Connaissances des Créatures"}]}'::jsonb
WHERE nom = 'Dépeçage' AND categorie = 'generale';
