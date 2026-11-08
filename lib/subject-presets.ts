export type SubjectPreset = { name: string; code: string }

/** East African / English-medium primary presets (legacy default). */
export const PRIMARY_PRESETS_EN: SubjectPreset[] = [
  { name: 'Mathematics', code: 'MATH' },
  { name: 'English Language', code: 'ENG' },
  { name: 'Kiswahili', code: 'KSW' },
  { name: 'Science', code: 'SCI' },
  { name: 'Social Studies', code: 'SST' },
  { name: 'Religious Education', code: 'RE' },
  { name: 'Creative Arts', code: 'ART' },
  { name: 'Physical Education', code: 'PE' },
  { name: 'Computer Studies', code: 'COMP' },
  { name: 'Life Skills', code: 'LS' },
  { name: 'Environmental Studies', code: 'ENV' },
  { name: 'Health Education', code: 'HE' },
]

/** East African / English-medium secondary presets (legacy default). */
export const SECONDARY_PRESETS_EN: SubjectPreset[] = [
  { name: 'Mathematics', code: 'MATH' },
  { name: 'English Language', code: 'ENG' },
  { name: 'Kiswahili', code: 'KSW' },
  { name: 'Physics', code: 'PHY' },
  { name: 'Chemistry', code: 'CHEM' },
  { name: 'Biology', code: 'BIO' },
  { name: 'History', code: 'HIST' },
  { name: 'Geography', code: 'GEO' },
  { name: 'Civics', code: 'CIV' },
  { name: 'Commerce', code: 'COM' },
  { name: 'Economics', code: 'ECON' },
  { name: 'Literature', code: 'LIT' },
  { name: 'Computer Science', code: 'CS' },
  { name: 'Agriculture', code: 'AGR' },
  { name: 'Business Studies', code: 'BUS' },
  { name: 'Fine Arts', code: 'ART' },
  { name: 'Physical Education', code: 'PE' },
  { name: 'Religious Education', code: 'RE' },
  { name: 'French', code: 'FRE' },
  { name: 'Arabic', code: 'ARB' },
]

/**
 * French école primaire (CP–CM2) — common national curriculum subjects.
 */
export const PRIMARY_PRESETS_FR: SubjectPreset[] = [
  { name: 'Français', code: 'FR' },
  { name: 'Lecture', code: 'LECT' },
  { name: 'Écriture', code: 'ECR' },
  { name: 'Orthographe', code: 'ORTH' },
  { name: 'Grammaire', code: 'GRAM' },
  { name: 'Conjugaison', code: 'CONJ' },
  { name: 'Vocabulaire', code: 'VOC' },
  { name: 'Mathématiques', code: 'MATH' },
  { name: 'Calcul', code: 'CALC' },
  { name: 'Géométrie', code: 'GEOM' },
  { name: 'Résolution de problèmes', code: 'PROB' },
  { name: 'Questionner le monde', code: 'QDM' },
  { name: 'Sciences et technologie', code: 'SCT' },
  { name: 'Histoire', code: 'HIST' },
  { name: 'Géographie', code: 'GEO' },
  { name: 'Enseignement moral et civique', code: 'EMC' },
  { name: 'Éducation physique et sportive', code: 'EPS' },
  { name: 'Arts plastiques', code: 'ART' },
  { name: 'Éducation musicale', code: 'MUS' },
  { name: 'Langue vivante — Anglais', code: 'ANG' },
  { name: 'Langue vivante — Allemand', code: 'ALL' },
  { name: 'Langue vivante — Espagnol', code: 'ESP' },
  { name: 'Informatique / Numérique', code: 'NUM' },
  { name: 'Éducation aux médias', code: 'EMI' },
  { name: 'Théâtre', code: 'THEA' },
  { name: 'Danse', code: 'DANS' },
  { name: 'Chant choral', code: 'CHOR' },
  { name: 'Travaux manuels', code: 'TM' },
  { name: 'Vie de classe', code: 'VIE' },
  { name: 'Éducation à la santé', code: 'SANTE' },
  { name: 'Éducation à l’environnement', code: 'ENV' },
]

/**
 * French collège + lycée (secondaire) — broad catalog covering common tracks.
 */
export const SECONDARY_PRESETS_FR: SubjectPreset[] = [
  // Tronc commun
  { name: 'Français', code: 'FR' },
  { name: 'Littérature', code: 'LIT' },
  { name: 'Philosophie', code: 'PHILO' },
  { name: 'Mathématiques', code: 'MATH' },
  { name: 'Mathématiques complémentaires', code: 'MATHC' },
  { name: 'Mathématiques expertes', code: 'MATHE' },
  { name: 'Histoire-Géographie', code: 'HG' },
  { name: 'Histoire', code: 'HIST' },
  { name: 'Géographie', code: 'GEO' },
  { name: 'Enseignement moral et civique', code: 'EMC' },
  { name: 'Éducation physique et sportive', code: 'EPS' },

  // Sciences
  { name: 'Physique-Chimie', code: 'PC' },
  { name: 'Physique', code: 'PHY' },
  { name: 'Chimie', code: 'CHIM' },
  { name: 'Sciences de la vie et de la Terre', code: 'SVT' },
  { name: 'Biologie', code: 'BIO' },
  { name: 'Technologie', code: 'TECH' },
  { name: 'Sciences numériques et technologie', code: 'SNT' },
  { name: 'Numérique et sciences informatiques', code: 'NSI' },
  { name: 'Sciences de l’ingénieur', code: 'SI' },
  { name: 'Informatique', code: 'INFO' },

  // Langues
  { name: 'Anglais (LV1)', code: 'ANG1' },
  { name: 'Anglais (LV2)', code: 'ANG2' },
  { name: 'Espagnol (LV2)', code: 'ESP2' },
  { name: 'Allemand (LV2)', code: 'ALL2' },
  { name: 'Italien (LV2)', code: 'ITA2' },
  { name: 'Chinois (LV3)', code: 'CHI3' },
  { name: 'Arabe (LV3)', code: 'ARA3' },
  { name: 'Portugais', code: 'PORT' },
  { name: 'Latin', code: 'LAT' },
  { name: 'Grec ancien', code: 'GREC' },
  { name: 'Langues et cultures de l’Antiquité', code: 'LCA' },
  { name: 'LLCE Anglais', code: 'LLCE' },

  // Sciences humaines & économiques
  { name: 'Sciences économiques et sociales', code: 'SES' },
  { name: 'Histoire-géographie, géopolitique et sciences politiques', code: 'HGGSP' },
  { name: 'Humanités, littérature et philosophie', code: 'HLP' },
  { name: 'Économie', code: 'ECO' },
  { name: 'Droit', code: 'DROIT' },
  { name: 'Management', code: 'MGMT' },
  { name: 'Sciences de gestion et numérique', code: 'SGN' },
  { name: 'Comptabilité', code: 'COMPT' },

  // Arts & options
  { name: 'Arts plastiques', code: 'ART' },
  { name: 'Éducation musicale', code: 'MUS' },
  { name: 'Théâtre', code: 'THEA' },
  { name: 'Cinéma-audiovisuel', code: 'CIN' },
  { name: 'Histoire des arts', code: 'HDA' },
  { name: 'Danse', code: 'DANS' },
  { name: 'Arts du cirque', code: 'CIRQ' },

  // Autres
  { name: 'Orientation / Vie scolaire', code: 'ORIENT' },
  { name: 'Accompagnement personnalisé', code: 'AP' },
  { name: 'Enseignement agricole', code: 'AGR' },
  { name: 'Éducation à la santé', code: 'SANTE' },
  { name: 'Éducation aux médias et à l’information', code: 'EMI' },
  { name: 'Religion / Culture religieuse', code: 'REL' },
]

export function getSubjectPresets(locale: string): {
  primary: SubjectPreset[]
  secondary: SubjectPreset[]
} {
  const isFrench = locale.toLowerCase().startsWith('fr')
  return {
    primary: isFrench ? PRIMARY_PRESETS_FR : PRIMARY_PRESETS_EN,
    secondary: isFrench ? SECONDARY_PRESETS_FR : SECONDARY_PRESETS_EN,
  }
}
