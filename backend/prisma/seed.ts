import "dotenv/config";
import {
  AgeGroup,
  AuditAction,
  PrismaClient,
  Sex,
  TriageLevel,
  TriageStatus,
} from "@prisma/client";
import { dobFromAge, minutesAgo, type FlowAction } from "../src/types";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const NOW = new Date();

interface SeedPatient {
  mrn: string;
  firstName: string;
  lastName: string;
  ageYears: number;
  sex: Sex;
  ageGroup: AgeGroup;
  medicalHistory: { condition: string; diagnosedYear?: number; notes?: string }[];
  allergies: { allergen: string; reaction?: string }[];
  medications: { name: string; dosage?: string; frequency?: string }[];
  isFirstVisit: boolean;
  arrivalMinutesAgo: number;
  triage: {
    aiSuggestedLevel: TriageLevel;
    aiConfidenceScore: number;
    suggestedActions: FlowAction[];
    vitalSigns: {
      heartRateBpm: number;
      bloodPressure: string;
      temperatureCelsius: number;
      respiratoryRate: number;
      oxygenSaturationPct: number;
      painScore: number;
    };
    symptoms: string[];
    presentationNotes: string;
    uncertaintyReason?: string;
    status: TriageStatus;
    triageMinutesAgo: number;
  };
  reassessment?: {
    aiSuggestedLevel: TriageLevel;
    aiConfidenceScore: number;
    suggestedActions: FlowAction[];
    vitalSigns: {
      heartRateBpm: number;
      bloodPressure: string;
      temperatureCelsius: number;
      respiratoryRate: number;
      oxygenSaturationPct: number;
      painScore: number;
    };
    symptoms: string[];
    presentationNotes: string;
    uncertaintyReason?: string;
    status: TriageStatus;
    triageMinutesAgo: number;
  };
  auditOverride?: {
    clinicianId: string;
    clinicianName: string;
    clinicianRole: string;
    overrideLevel: TriageLevel;
    overrideReason: string;
    metadata: {
      ipAddress: string;
      sessionId: string;
      suggestedActionsBefore: FlowAction[];
      suggestedActionsAfter: FlowAction[];
    };
  };
}

const SEED_PATIENTS: SeedPatient[] = [
  // 1 — Pediatric
  {
    mrn: "MRN-10001",
    firstName: "Emma",
    lastName: "Chen",
    ageYears: 3,
    sex: Sex.FEMALE,
    ageGroup: AgeGroup.PEDIATRIC,
    medicalHistory: [
      { condition: "Asthma", diagnosedYear: 2024, notes: "Mild intermittent" },
    ],
    allergies: [{ allergen: "Peanuts", reaction: "Hives" }],
    medications: [{ name: "Albuterol", dosage: "2 puffs", frequency: "PRN" }],
    isFirstVisit: false,
    arrivalMinutesAgo: 45,
    triage: {
      aiSuggestedLevel: TriageLevel.LEVEL_3,
      aiConfidenceScore: 0.58,
      suggestedActions: [
        "PEDIATRIC_CONSULT",
        "REPEAT_VITALS_15MIN",
        "DRAW_CBC",
        "NOTIFY_CHARGE_NURSE",
      ],
      vitalSigns: {
        heartRateBpm: 132,
        bloodPressure: "98/62",
        temperatureCelsius: 38.5,
        respiratoryRate: 28,
        oxygenSaturationPct: 97,
        painScore: 4,
      },
      symptoms: ["Fever", "Irritability", "Decreased oral intake"],
      presentationNotes:
        "Parent reports 24h fever, pulling at ears. Child fussy but alert.",
      uncertaintyReason:
        "Pediatric fever threshold borderline; age-adjusted vitals differ from adult norms.",
      status: TriageStatus.WAITING,
      triageMinutesAgo: 40,
    },
  },
  // 2 — Geriatric
  {
    mrn: "MRN-10002",
    firstName: "Harold",
    lastName: "Whitfield",
    ageYears: 78,
    sex: Sex.MALE,
    ageGroup: AgeGroup.GERIATRIC,
    medicalHistory: [
      { condition: "Atrial fibrillation", diagnosedYear: 2018 },
      { condition: "Hypertension", diagnosedYear: 2010 },
      { condition: "Mild cognitive impairment", diagnosedYear: 2023 },
    ],
    allergies: [{ allergen: "Penicillin", reaction: "Rash" }],
    medications: [
      { name: "Warfarin", dosage: "5mg", frequency: "Daily" },
      { name: "Metoprolol", dosage: "50mg", frequency: "BID" },
    ],
    isFirstVisit: false,
    arrivalMinutesAgo: 35,
    triage: {
      aiSuggestedLevel: TriageLevel.LEVEL_2,
      aiConfidenceScore: 0.62,
      suggestedActions: [
        "ORDER_ECG",
        "DRAW_TROPONIN",
        "GERIATRIC_CONSULT",
        "PREPARE_BED_1",
        "NOTIFY_ATTENDING",
      ],
      vitalSigns: {
        heartRateBpm: 88,
        bloodPressure: "156/92",
        temperatureCelsius: 36.8,
        respiratoryRate: 18,
        oxygenSaturationPct: 95,
        painScore: 5,
      },
      symptoms: ["Vague chest discomfort", "Epigastric pressure", "Lightheadedness"],
      presentationNotes:
        "Elderly male, poor historian. Denies classic chest pain but wife reports confusion since morning.",
      uncertaintyReason:
        "Geriatric atypical ACS presentation; anticoagulant use increases bleed risk if misdiagnosed.",
      status: TriageStatus.IN_REVIEW,
      triageMinutesAgo: 30,
    },
  },
  // 3 — First-time / zero history
  {
    mrn: "MRN-10003",
    firstName: "Jordan",
    lastName: "Reyes",
    ageYears: 24,
    sex: Sex.OTHER,
    ageGroup: AgeGroup.ADULT,
    medicalHistory: [],
    allergies: [],
    medications: [],
    isFirstVisit: true,
    arrivalMinutesAgo: 20,
    triage: {
      aiSuggestedLevel: TriageLevel.LEVEL_4,
      aiConfidenceScore: 0.71,
      suggestedActions: [
        "CLINICIAN_REVIEW",
        "PREPARE_BED_3",
        "REPEAT_VITALS_30MIN",
      ],
      vitalSigns: {
        heartRateBpm: 78,
        bloodPressure: "118/76",
        temperatureCelsius: 37.1,
        respiratoryRate: 16,
        oxygenSaturationPct: 99,
        painScore: 3,
      },
      symptoms: ["Sore throat", "Nasal congestion"],
      presentationNotes:
        "No prior records on file. Unknown allergy/medication history. Appears stable.",
      status: TriageStatus.WAITING,
      triageMinutesAgo: 18,
    },
  },
  // 4 — Ambiguous: headache ± neck stiffness
  {
    mrn: "MRN-10004",
    firstName: "Priya",
    lastName: "Sharma",
    ageYears: 34,
    sex: Sex.FEMALE,
    ageGroup: AgeGroup.ADULT,
    medicalHistory: [{ condition: "Migraine", diagnosedYear: 2019 }],
    allergies: [],
    medications: [{ name: "Sumatriptan", dosage: "50mg", frequency: "PRN" }],
    isFirstVisit: false,
    arrivalMinutesAgo: 55,
    triage: {
      aiSuggestedLevel: TriageLevel.LEVEL_3,
      aiConfidenceScore: 0.52,
      suggestedActions: [
        "ORDER_CT",
        "DRAW_CBC",
        "NOTIFY_ATTENDING",
        "PREPARE_BED_2",
      ],
      vitalSigns: {
        heartRateBpm: 82,
        bloodPressure: "128/84",
        temperatureCelsius: 37.0,
        respiratoryRate: 14,
        oxygenSaturationPct: 99,
        painScore: 8,
      },
      symptoms: ["Sudden severe headache", "Mild neck stiffness", "Photophobia"],
      presentationNotes:
        "Thunderclap onset 2h ago. History of migraines but states this feels different.",
      uncertaintyReason:
        "SAH vs severe migraine overlap; cannot rule out subarachnoid hemorrhage without imaging.",
      status: TriageStatus.WAITING,
      triageMinutesAgo: 50,
    },
  },
  // 5 — Ambiguous: abdominal pain
  {
    mrn: "MRN-10005",
    firstName: "Marcus",
    lastName: "Johnson",
    ageYears: 29,
    sex: Sex.MALE,
    ageGroup: AgeGroup.ADULT,
    medicalHistory: [],
    allergies: [],
    medications: [],
    isFirstVisit: true,
    arrivalMinutesAgo: 40,
    triage: {
      aiSuggestedLevel: TriageLevel.LEVEL_3,
      aiConfidenceScore: 0.48,
      suggestedActions: [
        "ORDER_X_RAY",
        "DRAW_CBC",
        "DRAW_BMP",
        "CLINICIAN_REVIEW",
        "PREPARE_BED_2",
      ],
      vitalSigns: {
        heartRateBpm: 96,
        bloodPressure: "122/78",
        temperatureCelsius: 37.4,
        respiratoryRate: 18,
        oxygenSaturationPct: 98,
        painScore: 6,
      },
      symptoms: ["Right lower quadrant pain", "Nausea", "Anorexia"],
      presentationNotes:
        "Pain migrated from periumbilical to RLQ over 12h. No prior surgical history on file.",
      uncertaintyReason:
        "Appendicitis vs gastroenteritis; pain score under-reported per nurse observation.",
      status: TriageStatus.WAITING,
      triageMinutesAgo: 35,
    },
  },
  // 6 — Ambiguous: syncope with normal vitals
  {
    mrn: "MRN-10006",
    firstName: "Elena",
    lastName: "Vasquez",
    ageYears: 52,
    sex: Sex.FEMALE,
    ageGroup: AgeGroup.ADULT,
    medicalHistory: [
      { condition: "Type 2 diabetes", diagnosedYear: 2015 },
      { condition: "Anxiety disorder", diagnosedYear: 2020 },
    ],
    allergies: [{ allergen: "Sulfa drugs", reaction: "Nausea" }],
    medications: [
      { name: "Metformin", dosage: "1000mg", frequency: "BID" },
      { name: "Sertraline", dosage: "100mg", frequency: "Daily" },
    ],
    isFirstVisit: false,
    arrivalMinutesAgo: 25,
    triage: {
      aiSuggestedLevel: TriageLevel.LEVEL_3,
      aiConfidenceScore: 0.55,
      suggestedActions: [
        "ORDER_ECG",
        "DRAW_BMP",
        "DRAW_CBC",
        "REPEAT_VITALS_15MIN",
        "NOTIFY_CHARGE_NURSE",
      ],
      vitalSigns: {
        heartRateBpm: 72,
        bloodPressure: "118/74",
        temperatureCelsius: 36.9,
        respiratoryRate: 14,
        oxygenSaturationPct: 99,
        painScore: 1,
      },
      symptoms: ["Syncope", "Brief loss of consciousness", "Mild dizziness"],
      presentationNotes:
        "Single syncopal episode at work, recovered fully. Vitals currently normal.",
      uncertaintyReason:
        "Cardiac arrhythmia vs vasovagal vs hypoglycemia; normal vitals do not exclude serious cause.",
      status: TriageStatus.WAITING,
      triageMinutesAgo: 22,
    },
    auditOverride: {
      clinicianId: "RN-0042",
      clinicianName: "Sarah Mitchell",
      clinicianRole: "Charge Nurse",
      overrideLevel: TriageLevel.LEVEL_2,
      overrideReason:
        "Patient reports palpitations prior to syncope. AI level 3 insufficient given cardiac risk factors; escalating per safety-first protocol.",
      metadata: {
        ipAddress: "10.0.12.45",
        sessionId: "sess-20260829-0042",
        suggestedActionsBefore: [
          "ORDER_ECG",
          "DRAW_BMP",
          "DRAW_CBC",
          "REPEAT_VITALS_15MIN",
          "NOTIFY_CHARGE_NURSE",
        ],
        suggestedActionsAfter: [
          "ORDER_ECG",
          "DRAW_TROPONIN",
          "PREPARE_BED_1",
          "NOTIFY_ATTENDING",
          "REPEAT_VITALS_15MIN",
        ],
      },
    },
  },
  // 7 — Clear critical: STEMI presentation
  {
    mrn: "MRN-10007",
    firstName: "Robert",
    lastName: "Kim",
    ageYears: 61,
    sex: Sex.MALE,
    ageGroup: AgeGroup.ADULT,
    medicalHistory: [
      { condition: "Hyperlipidemia", diagnosedYear: 2012 },
      { condition: "Former smoker", diagnosedYear: 2018, notes: "Quit 8 years ago" },
    ],
    allergies: [],
    medications: [{ name: "Atorvastatin", dosage: "40mg", frequency: "Daily" }],
    isFirstVisit: false,
    arrivalMinutesAgo: 8,
    triage: {
      aiSuggestedLevel: TriageLevel.LEVEL_1,
      aiConfidenceScore: 0.94,
      suggestedActions: [
        "ORDER_ECG",
        "DRAW_TROPONIN",
        "PREPARE_BED_1",
        "NOTIFY_ATTENDING",
        "OXYGEN_THERAPY",
        "IV_ACCESS",
      ],
      vitalSigns: {
        heartRateBpm: 104,
        bloodPressure: "98/60",
        temperatureCelsius: 36.7,
        respiratoryRate: 22,
        oxygenSaturationPct: 93,
        painScore: 9,
      },
      symptoms: ["Crushing chest pain", "Diaphoresis", "Radiation to left arm"],
      presentationNotes: "Classic ACS presentation. Appears distressed.",
      status: TriageStatus.IN_REVIEW,
      triageMinutesAgo: 5,
    },
  },
  // 8 — Minor trauma
  {
    mrn: "MRN-10008",
    firstName: "Aisha",
    lastName: "Patel",
    ageYears: 19,
    sex: Sex.FEMALE,
    ageGroup: AgeGroup.ADULT,
    medicalHistory: [],
    allergies: [],
    medications: [],
    isFirstVisit: true,
    arrivalMinutesAgo: 60,
    triage: {
      aiSuggestedLevel: TriageLevel.LEVEL_4,
      aiConfidenceScore: 0.88,
      suggestedActions: ["ORDER_X_RAY", "CLINICIAN_REVIEW", "PREPARE_BED_3"],
      vitalSigns: {
        heartRateBpm: 88,
        bloodPressure: "112/70",
        temperatureCelsius: 36.9,
        respiratoryRate: 16,
        oxygenSaturationPct: 99,
        painScore: 5,
      },
      symptoms: ["Ankle pain", "Swelling after fall"],
      presentationNotes: "Twisted ankle playing soccer. Weight-bearing with difficulty.",
      status: TriageStatus.WAITING,
      triageMinutesAgo: 55,
    },
  },
  // 9 — Respiratory distress
  {
    mrn: "MRN-10009",
    firstName: "Thomas",
    lastName: "Nguyen",
    ageYears: 67,
    sex: Sex.MALE,
    ageGroup: AgeGroup.GERIATRIC,
    medicalHistory: [
      { condition: "COPD", diagnosedYear: 2008 },
      { condition: "CHF", diagnosedYear: 2016 },
    ],
    allergies: [],
    medications: [
      { name: "Tiotropium", dosage: "18mcg", frequency: "Daily" },
      { name: "Furosemide", dosage: "40mg", frequency: "Daily" },
    ],
    isFirstVisit: false,
    arrivalMinutesAgo: 15,
    triage: {
      aiSuggestedLevel: TriageLevel.LEVEL_2,
      aiConfidenceScore: 0.91,
      suggestedActions: [
        "OXYGEN_THERAPY",
        "ORDER_X_RAY",
        "IV_ACCESS",
        "PREPARE_BED_1",
        "NOTIFY_ATTENDING",
      ],
      vitalSigns: {
        heartRateBpm: 110,
        bloodPressure: "140/88",
        temperatureCelsius: 37.6,
        respiratoryRate: 32,
        oxygenSaturationPct: 88,
        painScore: 2,
      },
      symptoms: ["Shortness of breath", "Productive cough", "Wheezing"],
      presentationNotes: "Known COPD exacerbation pattern. Using accessory muscles.",
      status: TriageStatus.IN_REVIEW,
      triageMinutesAgo: 12,
    },
    reassessment: {
      aiSuggestedLevel: TriageLevel.LEVEL_2,
      aiConfidenceScore: 0.87,
      suggestedActions: [
        "OXYGEN_THERAPY",
        "REPEAT_VITALS_15MIN",
        "NOTIFY_ATTENDING",
        "PREPARE_BED_1",
      ],
      vitalSigns: {
        heartRateBpm: 118,
        bloodPressure: "148/90",
        temperatureCelsius: 37.8,
        respiratoryRate: 34,
        oxygenSaturationPct: 86,
        painScore: 3,
      },
      symptoms: ["Worsening dyspnea", "Increased work of breathing"],
      presentationNotes:
        "Re-assessment after 45 min wait. SpO2 declining despite supplemental O2.",
      status: TriageStatus.REASSESSMENT,
      triageMinutesAgo: 2,
    },
  },
  // 10 — Stable laceration
  {
    mrn: "MRN-10010",
    firstName: "Olivia",
    lastName: "Martinez",
    ageYears: 42,
    sex: Sex.FEMALE,
    ageGroup: AgeGroup.ADULT,
    medicalHistory: [{ condition: "Hypothyroidism", diagnosedYear: 2017 }],
    allergies: [{ allergen: "Latex", reaction: "Contact dermatitis" }],
    medications: [{ name: "Levothyroxine", dosage: "75mcg", frequency: "Daily" }],
    isFirstVisit: false,
    arrivalMinutesAgo: 70,
    triage: {
      aiSuggestedLevel: TriageLevel.LEVEL_5,
      aiConfidenceScore: 0.92,
      suggestedActions: ["CLINICIAN_REVIEW", "PREPARE_BED_3"],
      vitalSigns: {
        heartRateBpm: 76,
        bloodPressure: "120/78",
        temperatureCelsius: 36.8,
        respiratoryRate: 14,
        oxygenSaturationPct: 99,
        painScore: 4,
      },
      symptoms: ["Hand laceration", "Controlled bleeding"],
      presentationNotes: "3cm superficial laceration from kitchen knife. Bleeding controlled.",
      status: TriageStatus.WAITING,
      triageMinutesAgo: 65,
    },
  },
  // 11 — Pediatric URI
  {
    mrn: "MRN-10011",
    firstName: "Liam",
    lastName: "O'Brien",
    ageYears: 7,
    sex: Sex.MALE,
    ageGroup: AgeGroup.PEDIATRIC,
    medicalHistory: [],
    allergies: [],
    medications: [],
    isFirstVisit: true,
    arrivalMinutesAgo: 50,
    triage: {
      aiSuggestedLevel: TriageLevel.LEVEL_4,
      aiConfidenceScore: 0.84,
      suggestedActions: [
        "PEDIATRIC_CONSULT",
        "CLINICIAN_REVIEW",
        "PREPARE_BED_3",
      ],
      vitalSigns: {
        heartRateBpm: 108,
        bloodPressure: "102/64",
        temperatureCelsius: 37.8,
        respiratoryRate: 22,
        oxygenSaturationPct: 98,
        painScore: 2,
      },
      symptoms: ["Cough", "Runny nose", "Low-grade fever"],
      presentationNotes: "School-age child, alert and playful. No respiratory distress.",
      status: TriageStatus.WAITING,
      triageMinutesAgo: 45,
    },
  },
  // 12 — Geriatric fall
  {
    mrn: "MRN-10012",
    firstName: "Dorothy",
    lastName: "Fletcher",
    ageYears: 82,
    sex: Sex.FEMALE,
    ageGroup: AgeGroup.GERIATRIC,
    medicalHistory: [
      { condition: "Osteoporosis", diagnosedYear: 2014 },
      { condition: "Hypertension", diagnosedYear: 2005 },
    ],
    allergies: [{ allergen: "Codeine", reaction: "Nausea and vomiting" }],
    medications: [
      { name: "Amlodipine", dosage: "5mg", frequency: "Daily" },
      { name: "Calcium + Vitamin D", dosage: "600mg", frequency: "Daily" },
    ],
    isFirstVisit: false,
    arrivalMinutesAgo: 30,
    triage: {
      aiSuggestedLevel: TriageLevel.LEVEL_3,
      aiConfidenceScore: 0.79,
      suggestedActions: [
        "ORDER_X_RAY",
        "ORDER_CT",
        "GERIATRIC_CONSULT",
        "PREPARE_BED_2",
        "DRAW_CBC",
      ],
      vitalSigns: {
        heartRateBpm: 92,
        bloodPressure: "148/86",
        temperatureCelsius: 36.6,
        respiratoryRate: 18,
        oxygenSaturationPct: 96,
        painScore: 6,
      },
      symptoms: ["Hip pain after fall", "Unable to bear weight"],
      presentationNotes:
        "Mechanical fall at home. On anticoagulation? — chart shows none currently.",
      status: TriageStatus.WAITING,
      triageMinutesAgo: 25,
    },
  },
  // 13 — UTI symptoms
  {
    mrn: "MRN-10013",
    firstName: "Karen",
    lastName: "Williams",
    ageYears: 55,
    sex: Sex.FEMALE,
    ageGroup: AgeGroup.ADULT,
    medicalHistory: [{ condition: "Recurrent UTIs", diagnosedYear: 2021 }],
    allergies: [],
    medications: [],
    isFirstVisit: false,
    arrivalMinutesAgo: 90,
    triage: {
      aiSuggestedLevel: TriageLevel.LEVEL_4,
      aiConfidenceScore: 0.86,
      suggestedActions: [
        "DRAW_CBC",
        "CLINICIAN_REVIEW",
        "PREPARE_BED_3",
      ],
      vitalSigns: {
        heartRateBpm: 84,
        bloodPressure: "124/80",
        temperatureCelsius: 37.9,
        respiratoryRate: 16,
        oxygenSaturationPct: 99,
        painScore: 5,
      },
      symptoms: ["Dysuria", "Frequency", "Suprapubic discomfort"],
      presentationNotes: "Similar to prior UTIs. No flank pain or vomiting.",
      status: TriageStatus.WAITING,
      triageMinutesAgo: 85,
    },
  },
  // 14 — Psychiatric crisis
  {
    mrn: "MRN-10014",
    firstName: "David",
    lastName: "Brooks",
    ageYears: 38,
    sex: Sex.MALE,
    ageGroup: AgeGroup.ADULT,
    medicalHistory: [
      { condition: "Major depressive disorder", diagnosedYear: 2016 },
      { condition: "Substance use disorder (alcohol)", diagnosedYear: 2020, notes: "In remission 2 years" },
    ],
    allergies: [],
    medications: [{ name: "Escitalopram", dosage: "20mg", frequency: "Daily" }],
    isFirstVisit: false,
    arrivalMinutesAgo: 22,
    triage: {
      aiSuggestedLevel: TriageLevel.LEVEL_3,
      aiConfidenceScore: 0.68,
      suggestedActions: [
        "NOTIFY_CHARGE_NURSE",
        "CLINICIAN_REVIEW",
        "PREPARE_BED_2",
        "REPEAT_VITALS_30MIN",
      ],
      vitalSigns: {
        heartRateBpm: 98,
        bloodPressure: "132/84",
        temperatureCelsius: 36.9,
        respiratoryRate: 18,
        oxygenSaturationPct: 99,
        painScore: 0,
      },
      symptoms: ["Suicidal ideation", "Agitation", "Insomnia"],
      presentationNotes:
        "Brought by family. Denies plan but expresses hopelessness. Contract for safety pending eval.",
      uncertaintyReason:
        "Risk stratification depends on psychiatric evaluation; medical clearance needed.",
      status: TriageStatus.IN_REVIEW,
      triageMinutesAgo: 18,
    },
  },
  // 15 — Allergic reaction
  {
    mrn: "MRN-10015",
    firstName: "Sophia",
    lastName: "Anderson",
    ageYears: 16,
    sex: Sex.FEMALE,
    ageGroup: AgeGroup.PEDIATRIC,
    medicalHistory: [{ condition: "Food allergies", diagnosedYear: 2010 }],
    allergies: [{ allergen: "Tree nuts", reaction: "Anaphylaxis" }],
    medications: [{ name: "Epinephrine auto-injector", dosage: "0.3mg", frequency: "PRN" }],
    isFirstVisit: false,
    arrivalMinutesAgo: 12,
    triage: {
      aiSuggestedLevel: TriageLevel.LEVEL_2,
      aiConfidenceScore: 0.89,
      suggestedActions: [
        "IV_ACCESS",
        "OXYGEN_THERAPY",
        "NOTIFY_ATTENDING",
        "PREPARE_BED_1",
        "REPEAT_VITALS_15MIN",
      ],
      vitalSigns: {
        heartRateBpm: 118,
        bloodPressure: "102/68",
        temperatureCelsius: 37.0,
        respiratoryRate: 24,
        oxygenSaturationPct: 94,
        painScore: 2,
      },
      symptoms: ["Urticaria", "Throat tightness", "Wheezing"],
      presentationNotes:
        "Accidental nut exposure at restaurant. Used EpiPen 20 min ago with partial improvement.",
      status: TriageStatus.IN_REVIEW,
      triageMinutesAgo: 10,
    },
  },
  // 16 — First visit adult with chest pain (low risk)
  {
    mrn: "MRN-10016",
    firstName: "Carlos",
    lastName: "Rivera",
    ageYears: 31,
    sex: Sex.MALE,
    ageGroup: AgeGroup.ADULT,
    medicalHistory: [],
    allergies: [],
    medications: [],
    isFirstVisit: true,
    arrivalMinutesAgo: 48,
    triage: {
      aiSuggestedLevel: TriageLevel.LEVEL_4,
      aiConfidenceScore: 0.82,
      suggestedActions: [
        "ORDER_ECG",
        "CLINICIAN_REVIEW",
        "PREPARE_BED_3",
      ],
      vitalSigns: {
        heartRateBpm: 76,
        bloodPressure: "118/72",
        temperatureCelsius: 36.8,
        respiratoryRate: 14,
        oxygenSaturationPct: 99,
        painScore: 3,
      },
      symptoms: ["Pleuritic chest pain", "Recent URI"],
      presentationNotes:
        "No cardiac history on file. Pain worse with deep breath. Likely musculoskeletal.",
      status: TriageStatus.WAITING,
      triageMinutesAgo: 42,
    },
  },
  // 17 — Seizure
  {
    mrn: "MRN-10017",
    firstName: "Grace",
    lastName: "Thompson",
    ageYears: 45,
    sex: Sex.FEMALE,
    ageGroup: AgeGroup.ADULT,
    medicalHistory: [{ condition: "Epilepsy", diagnosedYear: 2005 }],
    allergies: [],
    medications: [{ name: "Levetiracetam", dosage: "750mg", frequency: "BID" }],
    isFirstVisit: false,
    arrivalMinutesAgo: 18,
    triage: {
      aiSuggestedLevel: TriageLevel.LEVEL_2,
      aiConfidenceScore: 0.9,
      suggestedActions: [
        "DRAW_BMP",
        "DRAW_CBC",
        "NOTIFY_ATTENDING",
        "PREPARE_BED_1",
        "REPEAT_VITALS_15MIN",
      ],
      vitalSigns: {
        heartRateBpm: 102,
        bloodPressure: "138/88",
        temperatureCelsius: 37.2,
        respiratoryRate: 20,
        oxygenSaturationPct: 96,
        painScore: 4,
      },
      symptoms: ["Post-ictal state", "Tongue laceration", "Headache"],
      presentationNotes:
        "Witnessed generalized tonic-clonic seizure ~30 min ago. Now alert but confused.",
      status: TriageStatus.IN_REVIEW,
      triageMinutesAgo: 14,
    },
  },
  // 18 — Geriatric UTI with confusion
  {
    mrn: "MRN-10018",
    firstName: "Arthur",
    lastName: "Bennett",
    ageYears: 71,
    sex: Sex.MALE,
    ageGroup: AgeGroup.GERIATRIC,
    medicalHistory: [
      { condition: "Benign prostatic hyperplasia", diagnosedYear: 2015 },
      { condition: "Dementia", diagnosedYear: 2022, notes: "Moderate" },
    ],
    allergies: [],
    medications: [{ name: "Tamsulosin", dosage: "0.4mg", frequency: "Daily" }],
    isFirstVisit: false,
    arrivalMinutesAgo: 38,
    triage: {
      aiSuggestedLevel: TriageLevel.LEVEL_3,
      aiConfidenceScore: 0.74,
      suggestedActions: [
        "DRAW_CBC",
        "DRAW_BMP",
        "GERIATRIC_CONSULT",
        "PREPARE_BED_2",
        "CLINICIAN_REVIEW",
      ],
      vitalSigns: {
        heartRateBpm: 94,
        bloodPressure: "130/78",
        temperatureCelsius: 38.1,
        respiratoryRate: 18,
        oxygenSaturationPct: 97,
        painScore: 0,
      },
      symptoms: ["Acute confusion", "Urinary frequency", "Fever"],
      presentationNotes:
        "Caregiver reports acute mental status change. Unable to obtain reliable symptom history from patient.",
      uncertaintyReason:
        "Delirium has broad differential; infection vs metabolic vs intracranial.",
      status: TriageStatus.WAITING,
      triageMinutesAgo: 32,
    },
    reassessment: {
      aiSuggestedLevel: TriageLevel.LEVEL_2,
      aiConfidenceScore: 0.81,
      suggestedActions: [
        "DRAW_CBC",
        "NOTIFY_ATTENDING",
        "PREPARE_BED_1",
        "REPEAT_VITALS_15MIN",
      ],
      vitalSigns: {
        heartRateBpm: 108,
        bloodPressure: "124/76",
        temperatureCelsius: 38.6,
        respiratoryRate: 22,
        oxygenSaturationPct: 95,
        painScore: 0,
      },
      symptoms: ["Worsening confusion", "Tachycardia", "Fever spike"],
      presentationNotes:
        "Re-assessment after 60 min wait. Temp rising, HR increasing. Escalating concern for sepsis.",
      status: TriageStatus.REASSESSMENT,
      triageMinutesAgo: 3,
    },
  },
  // 19 — Overdose
  {
    mrn: "MRN-10019",
    firstName: "Tyler",
    lastName: "Jackson",
    ageYears: 27,
    sex: Sex.MALE,
    ageGroup: AgeGroup.ADULT,
    medicalHistory: [],
    allergies: [],
    medications: [],
    isFirstVisit: true,
    arrivalMinutesAgo: 10,
    triage: {
      aiSuggestedLevel: TriageLevel.LEVEL_2,
      aiConfidenceScore: 0.87,
      suggestedActions: [
        "IV_ACCESS",
        "DRAW_BMP",
        "NOTIFY_ATTENDING",
        "PREPARE_BED_1",
        "REPEAT_VITALS_15MIN",
      ],
      vitalSigns: {
        heartRateBpm: 52,
        bloodPressure: "98/58",
        temperatureCelsius: 35.8,
        respiratoryRate: 10,
        oxygenSaturationPct: 92,
        painScore: 0,
      },
      symptoms: ["Altered mental status", "Pinpoint pupils", "Suspected opioid ingestion"],
      presentationNotes:
        "Found unresponsive by roommate. Naloxone administered by EMS en route.",
      status: TriageStatus.IN_REVIEW,
      triageMinutesAgo: 7,
    },
  },
  // 20 — Routine follow-up wound check
  {
    mrn: "MRN-10020",
    firstName: "Nina",
    lastName: "Kowalski",
    ageYears: 58,
    sex: Sex.FEMALE,
    ageGroup: AgeGroup.ADULT,
    medicalHistory: [
      { condition: "Type 2 diabetes", diagnosedYear: 2010 },
      { condition: "Post-op wound (appendectomy)", diagnosedYear: 2026, notes: "Day 5 post-op" },
    ],
    allergies: [{ allergen: "Iodine", reaction: "Rash" }],
    medications: [
      { name: "Insulin glargine", dosage: "20 units", frequency: "Nightly" },
      { name: "Amoxicillin-clavulanate", dosage: "875mg", frequency: "BID" },
    ],
    isFirstVisit: false,
    arrivalMinutesAgo: 75,
    triage: {
      aiSuggestedLevel: TriageLevel.LEVEL_4,
      aiConfidenceScore: 0.83,
      suggestedActions: [
        "CLINICIAN_REVIEW",
        "PREPARE_BED_3",
        "REPEAT_VITALS_30MIN",
      ],
      vitalSigns: {
        heartRateBpm: 80,
        bloodPressure: "126/82",
        temperatureCelsius: 37.3,
        respiratoryRate: 16,
        oxygenSaturationPct: 98,
        painScore: 4,
      },
      symptoms: ["Incision site redness", "Mild drainage"],
      presentationNotes:
        "Post-op follow-up for surgical site. No systemic symptoms. Wound appears superficially infected.",
      status: TriageStatus.WAITING,
      triageMinutesAgo: 70,
    },
  },
];

async function main() {
  console.log("Clearing existing data...");
  await prisma.auditLog.deleteMany();
  await prisma.triageEvent.deleteMany();
  await prisma.patient.deleteMany();

  console.log("Seeding 20 patients...");
  let auditCount = 0;

  for (const seed of SEED_PATIENTS) {
    const patient = await prisma.patient.create({
      data: {
        mrn: seed.mrn,
        firstName: seed.firstName,
        lastName: seed.lastName,
        dateOfBirth: dobFromAge(seed.ageYears, NOW),
        sex: seed.sex,
        ageGroup: seed.ageGroup,
        medicalHistory: seed.medicalHistory,
        allergies: seed.allergies,
        medications: seed.medications,
        isFirstVisit: seed.isFirstVisit,
        arrivalTime: minutesAgo(seed.arrivalMinutesAgo, NOW),
      },
    });

    const triageEvent = await prisma.triageEvent.create({
      data: {
        patientId: patient.id,
        aiSuggestedLevel: seed.triage.aiSuggestedLevel,
        aiConfidenceScore: seed.triage.aiConfidenceScore,
        suggestedActions: seed.triage.suggestedActions,
        vitalSigns: seed.triage.vitalSigns,
        symptoms: seed.triage.symptoms,
        presentationNotes: seed.triage.presentationNotes,
        uncertaintyReason: seed.triage.uncertaintyReason ?? null,
        status: seed.triage.status,
        triageTime: minutesAgo(seed.triage.triageMinutesAgo, NOW),
      },
    });

    if (seed.reassessment) {
      await prisma.triageEvent.create({
        data: {
          patientId: patient.id,
          aiSuggestedLevel: seed.reassessment.aiSuggestedLevel,
          aiConfidenceScore: seed.reassessment.aiConfidenceScore,
          suggestedActions: seed.reassessment.suggestedActions,
          vitalSigns: seed.reassessment.vitalSigns,
          symptoms: seed.reassessment.symptoms,
          presentationNotes: seed.reassessment.presentationNotes,
          uncertaintyReason: seed.reassessment.uncertaintyReason ?? null,
          status: seed.reassessment.status,
          triageTime: minutesAgo(seed.reassessment.triageMinutesAgo, NOW),
        },
      });
    }

    if (seed.auditOverride) {
      await prisma.auditLog.create({
        data: {
          triageEventId: triageEvent.id,
          clinicianId: seed.auditOverride.clinicianId,
          clinicianName: seed.auditOverride.clinicianName,
          clinicianRole: seed.auditOverride.clinicianRole,
          originalAiLevel: seed.triage.aiSuggestedLevel,
          overrideLevel: seed.auditOverride.overrideLevel,
          action: AuditAction.ESCALATE,
          overrideReason: seed.auditOverride.overrideReason,
          metadata: seed.auditOverride.metadata,
        },
      });
      auditCount += 1;
    }
  }

  const [patientCount, triageCount, auditLogCount] = await Promise.all([
    prisma.patient.count(),
    prisma.triageEvent.count(),
    prisma.auditLog.count(),
  ]);

  console.log("\nSeed complete:");
  console.log(`  Patients:     ${patientCount}`);
  console.log(`  TriageEvents: ${triageCount}`);
  console.log(`  AuditLogs:    ${auditLogCount}`);

  if (patientCount !== 20) {
    throw new Error(`Expected 20 patients, got ${patientCount}`);
  }
  if (auditCount !== 1) {
    throw new Error(`Expected 1 audit override, got ${auditCount}`);
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
