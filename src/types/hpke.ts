// HPKE algorithm identifiers per draft-ietf-cose-hpke-20

// Algorithm IDs (TBD values from draft-20)
export const ALG_HPKE_7_INTEGRATED = 45;    // HPKE-7 integrated encryption
export const ALG_HPKE_7_KEY_ENCRYPTION = 53; // HPKE-7 key encryption

// Header parameter labels
export const HEADER_ALG = 1;    // Algorithm identifier
export const HEADER_EK = -4;    // Encapsulated key
export const HEADER_KID = 4;    // Key identifier
