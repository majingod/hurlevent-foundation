/** Libellé « ✓ ajout — annulable » (vert émeraude) marquant un item acquis
 *  depuis la dernière photo de compo en mode campagne : acheté/créé mais non
 *  scellé, donc encore désachetable. Pendant vert du `<BadgeAcquis />` or.
 *  Cosmétique — le backend (INV-3) reste l'autorité. */
export const LabelAjoutAnnulable = () => (
  <span className="text-[10px] font-semibold text-emerald-400">
    ✓ ajout — annulable
  </span>
);
