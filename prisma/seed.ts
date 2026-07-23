import { PrismaClient } from "@prisma/client";
import { createAccount } from "../src/domain/account/Account";
import { completeEvent } from "../src/domain/event/Event";
import { approveProfile, createProfile } from "../src/domain/profile/Profile";
import { createProposal } from "../src/domain/proposal/Proposal";
import { createRating } from "../src/domain/rating/Rating";
import { acceptProposal } from "../src/domain/slot/acceptProposal";
import { closeSlot } from "../src/domain/slot/closeSlot";
import { createSlot } from "../src/domain/slot/Slot";
import { Argon2PasswordHasher } from "../src/infrastructure/auth/passwordHasher";
import { PrismaAccountRepository } from "../src/infrastructure/persistence/prisma/AccountRepository";
import { PrismaEventRepository } from "../src/infrastructure/persistence/prisma/EventRepository";
import { PrismaProfileRepository } from "../src/infrastructure/persistence/prisma/ProfileRepository";
import { PrismaProposalRepository } from "../src/infrastructure/persistence/prisma/ProposalRepository";
import { PrismaRatingRepository } from "../src/infrastructure/persistence/prisma/RatingRepository";
import { PrismaSlotRepository } from "../src/infrastructure/persistence/prisma/SlotRepository";

const SEED_PASSWORD = "VivetuTiempo2026!";
const DAY_MS = 24 * 60 * 60 * 1_000;

const IDS = {
  accounts: {
    admin: "seed-account-admin",
    sanJuan: "seed-account-hospital-san-juan",
    esperanza: "seed-account-hospital-esperanza",
    // Phase 4 (hospital-finder-and-home-clarity): 3 NEW ACTIVE hospitals for
    // the public directory demo. San Juan/Esperanza above are untouched.
    delMar: "seed-account-hospital-del-mar",
    santaClara: "seed-account-hospital-santa-clara",
    sanRafael: "seed-account-hospital-san-rafael",
    // 10-hospital roster expansion (hospital-finder-and-home-clarity apply
    // follow-up): 6 more NEW ACTIVE hospitals, one per remaining region.
    // Esperanza stays PENDING — never promoted, never duplicated.
    urumea: "seed-account-hospital-urumea",
    monteverde: "seed-account-hospital-monteverde",
    besos: "seed-account-hospital-besos",
    orzan: "seed-account-hospital-orzan",
    bernesga: "seed-account-hospital-bernesga",
    guadiana: "seed-account-hospital-guadiana",
    clara: "seed-account-artist-clara",
    mateo: "seed-account-artist-mateo",
    lucia: "seed-account-artist-lucia",
    ana: "seed-account-patient-ana",
  },
  profiles: {
    sanJuan: "seed-profile-hospital-san-juan",
    esperanza: "seed-profile-hospital-esperanza",
    delMar: "seed-profile-hospital-del-mar",
    santaClara: "seed-profile-hospital-santa-clara",
    sanRafael: "seed-profile-hospital-san-rafael",
    urumea: "seed-profile-hospital-urumea",
    monteverde: "seed-profile-hospital-monteverde",
    besos: "seed-profile-hospital-besos",
    orzan: "seed-profile-hospital-orzan",
    bernesga: "seed-profile-hospital-bernesga",
    guadiana: "seed-profile-hospital-guadiana",
    clara: "seed-profile-artist-clara",
    mateo: "seed-profile-artist-mateo",
    lucia: "seed-profile-artist-lucia",
  },
  slots: {
    s1: "seed-slot-s1-open-competing-proposals",
    s2: "seed-slot-s2-filled-published-event",
    s3: "seed-slot-s3-open-empty",
    s4: "seed-slot-s4-closed-cascade",
    s5: "seed-slot-s5-filled-completed-event",
  },
  proposals: {
    s1Clara: "seed-proposal-s1-clara-submitted",
    s1Mateo: "seed-proposal-s1-mateo-submitted",
    s2Mateo: "seed-proposal-s2-mateo-accepted",
    s4Mateo: "seed-proposal-s4-mateo-cascade-rejected",
    s5Clara: "seed-proposal-s5-clara-accepted",
  },
  events: {
    s2: "seed-event-s2-published",
    s5: "seed-event-s5-completed",
  },
  ratings: {
    s2Ana: "seed-rating-s2-ana",
    s2Clara: "seed-rating-s2-clara",
    s2Lucia: "seed-rating-s2-lucia",
  },
} as const;

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const seedNow = new Date();
  const clock = {
    now: () => new Date(seedNow.getTime()),
  };
  const scheduledAt = (daysFromNow: number): Date =>
    new Date(seedNow.getTime() + daysFromNow * DAY_MS);

  const accounts = [
    createAccount({
      id: IDS.accounts.admin,
      email: "admin@vtt.test",
      role: "admin",
    }),
    createAccount({
      id: IDS.accounts.sanJuan,
      email: "hospital.sanjuan@vtt.test",
      role: "centre",
    }),
    createAccount({
      id: IDS.accounts.esperanza,
      email: "hospital.esperanza@vtt.test",
      role: "centre",
    }),
    createAccount({
      id: IDS.accounts.delMar,
      email: "hospital.delmar@vtt.test",
      role: "centre",
    }),
    createAccount({
      id: IDS.accounts.santaClara,
      email: "hospital.santaclara@vtt.test",
      role: "centre",
    }),
    createAccount({
      id: IDS.accounts.sanRafael,
      email: "hospital.sanrafael@vtt.test",
      role: "centre",
    }),
    createAccount({
      id: IDS.accounts.urumea,
      email: "hospital.urumea@vtt.test",
      role: "centre",
    }),
    createAccount({
      id: IDS.accounts.monteverde,
      email: "hospital.monteverde@vtt.test",
      role: "centre",
    }),
    createAccount({
      id: IDS.accounts.besos,
      email: "hospital.besos@vtt.test",
      role: "centre",
    }),
    createAccount({
      id: IDS.accounts.orzan,
      email: "hospital.orzan@vtt.test",
      role: "centre",
    }),
    createAccount({
      id: IDS.accounts.bernesga,
      email: "hospital.bernesga@vtt.test",
      role: "centre",
    }),
    createAccount({
      id: IDS.accounts.guadiana,
      email: "hospital.guadiana@vtt.test",
      role: "centre",
    }),
    createAccount({
      id: IDS.accounts.clara,
      email: "artist.clara@vtt.test",
      role: "artist",
    }),
    createAccount({
      id: IDS.accounts.mateo,
      email: "artist.mateo@vtt.test",
      role: "artist",
    }),
    createAccount({
      id: IDS.accounts.lucia,
      email: "artist.lucia@vtt.test",
      role: "artist",
    }),
    createAccount({
      id: IDS.accounts.ana,
      email: "patient.ana@vtt.test",
      role: "patient",
    }),
  ] as const;

  const sanJuan = approveProfile(
    createProfile({
      id: IDS.profiles.sanJuan,
      accountId: IDS.accounts.sanJuan,
      type: "centre",
      centreType: "hospital",
      name: "Hospital San Juan",
      // PUBLIC hospital location (Phase 2, demo data) — Bilbao.
      city: "Bilbao",
      postalCode: "48013",
      addressLine: "Plaza de Cruces, 12",
      latitude: 43.263,
      longitude: -2.935,
    }),
  );
  const esperanza = createProfile({
    id: IDS.profiles.esperanza,
    accountId: IDS.accounts.esperanza,
    type: "centre",
    centreType: "hospital",
    name: "Hospital Esperanza",
    // PUBLIC hospital location (Phase 2, demo data) — Madrid.
    city: "Madrid",
    postalCode: "28046",
    addressLine: "Paseo de la Castellana, 261",
    latitude: 40.417,
    longitude: -3.703,
  });
  // Phase 4 (hospital-finder-and-home-clarity): 3 NEW ACTIVE hospitals in
  // distinct cities with distinct postal-code prefixes, so postal-prefix
  // search is demonstrable. `addressLine` is POPULATED with a distinctive
  // string on every one of them (D14) — a null `addressLine` here would
  // make the exclusion tests pass vacuously, asserting nothing.
  const delMar = approveProfile(
    createProfile({
      id: IDS.profiles.delMar,
      accountId: IDS.accounts.delMar,
      type: "centre",
      centreType: "hospital",
      name: "Hospital Universitario del Mar",
      city: "Valencia",
      postalCode: "46011",
      addressLine: "Avenida del Mar, 45",
      latitude: 39.4699,
      longitude: -0.3763,
    }),
  );
  const santaClara = approveProfile(
    createProfile({
      id: IDS.profiles.santaClara,
      accountId: IDS.accounts.santaClara,
      type: "centre",
      centreType: "hospital",
      name: "Hospital Santa Clara",
      city: "Sevilla",
      postalCode: "41003",
      addressLine: "Calle Santa Clara, 8",
      latitude: 37.3891,
      longitude: -5.9845,
    }),
  );
  const sanRafael = approveProfile(
    createProfile({
      id: IDS.profiles.sanRafael,
      accountId: IDS.accounts.sanRafael,
      type: "centre",
      centreType: "hospital",
      name: "Hospital San Rafael",
      city: "Zaragoza",
      postalCode: "50009",
      addressLine: "Paseo San Rafael, 33",
      latitude: 41.6488,
      longitude: -0.8891,
    }),
  );
  // 10-hospital roster expansion: 6 more NEW ACTIVE hospitals, one per
  // remaining region (Gipuzkoa, Madrid, Barcelona, A Coruña, León,
  // Extremadura), same fictional-name register as the entries above (rivers/
  // districts, not real institution names). `addressLine` is populated on
  // every one EXCEPT Guadiana (below), consistent with the same D14
  // non-vacuous-exclusion rule.
  const urumea = approveProfile(
    createProfile({
      id: IDS.profiles.urumea,
      accountId: IDS.accounts.urumea,
      type: "centre",
      centreType: "hospital",
      name: "Hospital Urumea",
      city: "Donostia-San Sebastián",
      postalCode: "20003",
      addressLine: "Paseo del Urumea, 5",
      latitude: 43.318,
      longitude: -1.981,
    }),
  );
  const monteverde = approveProfile(
    createProfile({
      id: IDS.profiles.monteverde,
      accountId: IDS.accounts.monteverde,
      type: "centre",
      centreType: "hospital",
      name: "Hospital Monteverde",
      // Separate ACTIVE Madrid hospital, distinct from the PENDING
      // Hospital Esperanza (also Madrid) — different postal code/location.
      city: "Madrid",
      postalCode: "28003",
      addressLine: "Calle de Monteverde, 19",
      latitude: 40.4378,
      longitude: -3.7003,
    }),
  );
  const besos = approveProfile(
    createProfile({
      id: IDS.profiles.besos,
      accountId: IDS.accounts.besos,
      type: "centre",
      centreType: "hospital",
      name: "Hospital del Besòs",
      city: "Barcelona",
      postalCode: "08019",
      addressLine: "Rambla del Besòs, 7",
      latitude: 41.4145,
      longitude: 2.2153,
    }),
  );
  const orzan = approveProfile(
    createProfile({
      id: IDS.profiles.orzan,
      accountId: IDS.accounts.orzan,
      type: "centre",
      centreType: "hospital",
      name: "Hospital do Orzán",
      city: "A Coruña",
      postalCode: "15003",
      addressLine: "Paseo do Orzán, 22",
      latitude: 43.3713,
      longitude: -8.3936,
    }),
  );
  const bernesga = approveProfile(
    createProfile({
      id: IDS.profiles.bernesga,
      accountId: IDS.accounts.bernesga,
      type: "centre",
      centreType: "hospital",
      name: "Hospital del Bernesga",
      city: "León",
      postalCode: "24001",
      addressLine: "Avenida del Bernesga, 14",
      latitude: 42.5987,
      longitude: -5.5671,
    }),
  );
  // Deliberate exception (spec gap closed): a hospital that registered
  // before setting its map position — `city`/`postalCode` are populated,
  // `latitude`/`longitude`/`addressLine` stay null. Demonstrates "listed in
  // results but renders no pin, never defaulted to 0,0".
  const guadiana = approveProfile(
    createProfile({
      id: IDS.profiles.guadiana,
      accountId: IDS.accounts.guadiana,
      type: "centre",
      centreType: "hospital",
      name: "Hospital del Guadiana",
      city: "Badajoz",
      postalCode: "06001",
    }),
  );
  const clara = approveProfile(
    createProfile({
      id: IDS.profiles.clara,
      accountId: IDS.accounts.clara,
      type: "artist",
      name: "Clara Romero",
    }),
  );
  const mateo = approveProfile(
    createProfile({
      id: IDS.profiles.mateo,
      accountId: IDS.accounts.mateo,
      type: "artist",
      name: "Mateo Díaz",
    }),
  );
  const lucia = createProfile({
    id: IDS.profiles.lucia,
    accountId: IDS.accounts.lucia,
    type: "artist",
    name: "Lucía Navarro",
  });

  const s1 = createSlot(
    {
      id: IDS.slots.s1,
      hospitalProfileId: sanJuan.id,
      title: "Música en la habitación",
      description: "Concierto acústico breve para pacientes y familiares.",
      scheduledAt: scheduledAt(7),
      durationMinutes: 45,
      location: "Planta 2, sala de convivencia",
      audience: "all_ages",
    },
    clock,
  );
  const s2 = createSlot(
    {
      id: IDS.slots.s2,
      hospitalProfileId: sanJuan.id,
      title: "Taller de acuarela",
      description: "Taller guiado de pintura con materiales proporcionados.",
      scheduledAt: scheduledAt(14),
      durationMinutes: 60,
      location: "Planta 1, aula cultural",
      audience: "adults",
    },
    clock,
  );
  const s3 = createSlot(
    {
      id: IDS.slots.s3,
      hospitalProfileId: sanJuan.id,
      title: "Lectura compartida",
      description: "Espacio abierto de lectura y conversación tranquila.",
      scheduledAt: scheduledAt(21),
      durationMinutes: 45,
      location: "Biblioteca hospitalaria",
      audience: "children",
    },
    clock,
  );
  const s4 = createSlot(
    {
      id: IDS.slots.s4,
      hospitalProfileId: sanJuan.id,
      title: "Cuentos ilustrados",
      description: "Narración participativa para familias en la planta pediátrica.",
      scheduledAt: scheduledAt(28),
      durationMinutes: 45,
      location: "Pediatría, sala de familias",
      audience: "early_childhood",
    },
    clock,
  );
  const s5 = createSlot(
    {
      id: IDS.slots.s5,
      hospitalProfileId: sanJuan.id,
      title: "Concierto de cámara",
      description: "Pequeño recital de música clásica para pacientes y acompañantes.",
      scheduledAt: scheduledAt(35),
      durationMinutes: 50,
      location: "Salón de actos",
      audience: "all_ages",
    },
    clock,
  );

  const s1Clara = createProposal({
    id: IDS.proposals.s1Clara,
    slotId: s1.id,
    artistProfileId: clara.id,
    message: "Puedo ofrecer un repertorio acústico adaptable a la audiencia.",
  });
  const s1Mateo = createProposal({
    id: IDS.proposals.s1Mateo,
    slotId: s1.id,
    artistProfileId: mateo.id,
    message: "Propongo canciones participativas con guitarra y voz.",
  });
  const s2Mateo = createProposal({
    id: IDS.proposals.s2Mateo,
    slotId: s2.id,
    artistProfileId: mateo.id,
    message: "Tengo experiencia facilitando talleres de acuarela en grupo.",
  });
  const s4Mateo = createProposal({
    id: IDS.proposals.s4Mateo,
    slotId: s4.id,
    artistProfileId: mateo.id,
    message: "Puedo dinamizar una sesión de cuentos con ilustraciones en directo.",
  });
  const s5Clara = createProposal({
    id: IDS.proposals.s5Clara,
    slotId: s5.id,
    artistProfileId: clara.id,
    message: "Ofrezco un programa de cámara adaptado a espacios reducidos.",
  });

  const s2Accepted = acceptProposal({
    slot: s2,
    proposals: [s2Mateo],
    proposalId: s2Mateo.id,
    eventId: IDS.events.s2,
    clock,
    actingHospitalProfileId: sanJuan.id,
  });
  const s4Closed = closeSlot({
    slot: s4,
    proposals: [s4Mateo],
    clock,
    actingHospitalProfileId: sanJuan.id,
  });
  const s5Accepted = acceptProposal({
    slot: s5,
    proposals: [s5Clara],
    proposalId: s5Clara.id,
    eventId: IDS.events.s5,
    clock,
    actingHospitalProfileId: sanJuan.id,
  });
  const s5CompletedEvent = completeEvent(s5Accepted.event);

  // Real event ratings (Phase 3, Block 2, demo data) — only against S2's
  // PUBLISHED event, per spec (`rateEvent` denies rating a non-published
  // Event with ConflictError; S5 is `completed`, deliberately left unrated
  // here). Raters are patient Ana and two artists NOT performing at S2
  // (Mateo is S2's accepted performer) — any registered Account may rate,
  // this choice is just more realistic demo data. Average: (5+4+5)/3 = 4.7.
  const s2AnaRating = createRating({
    id: IDS.ratings.s2Ana,
    eventId: IDS.events.s2,
    raterAccountId: IDS.accounts.ana,
    stars: 5,
    createdAt: seedNow,
  });
  const s2ClaraRating = createRating({
    id: IDS.ratings.s2Clara,
    eventId: IDS.events.s2,
    raterAccountId: IDS.accounts.clara,
    stars: 4,
    createdAt: seedNow,
  });
  const s2LuciaRating = createRating({
    id: IDS.ratings.s2Lucia,
    eventId: IDS.events.s2,
    raterAccountId: IDS.accounts.lucia,
    stars: 5,
    createdAt: seedNow,
  });

  const passwordHasher = new Argon2PasswordHasher();
  const passwordHashes = new Map<string, string>(
    await Promise.all(
      accounts.map(
        async (account): Promise<readonly [string, string]> => [
          account.id,
          await passwordHasher.hash(SEED_PASSWORD),
        ],
      ),
    ),
  );

  await prisma.$transaction(async (tx) => {
    const accountRepository = new PrismaAccountRepository(tx);
    const profileRepository = new PrismaProfileRepository(tx);
    const slotRepository = new PrismaSlotRepository(tx);
    const proposalRepository = new PrismaProposalRepository(tx);
    const eventRepository = new PrismaEventRepository(tx);
    const ratingRepository = new PrismaRatingRepository(tx);

    for (const account of accounts) {
      await accountRepository.save({
        account,
        passwordHash: passwordHashes.get(account.id)!,
      });
    }

    for (const profile of [
      sanJuan,
      esperanza,
      delMar,
      santaClara,
      sanRafael,
      urumea,
      monteverde,
      besos,
      orzan,
      bernesga,
      guadiana,
      clara,
      mateo,
      lucia,
    ]) {
      await profileRepository.save(profile);
    }

    for (const slot of [s1, s2Accepted.slot, s3, s4Closed.slot, s5Accepted.slot]) {
      await slotRepository.save(slot);
    }

    for (const proposal of [
      s1Clara,
      s1Mateo,
      s2Accepted.acceptedProposal,
      ...s4Closed.rejectedProposals,
      s5Accepted.acceptedProposal,
    ]) {
      await proposalRepository.save(proposal);
    }

    await eventRepository.save(s2Accepted.event);
    await eventRepository.save(s5CompletedEvent);

    for (const rating of [s2AnaRating, s2ClaraRating, s2LuciaRating]) {
      await ratingRepository.upsert(rating);
    }
  });
}

main()
  .then(() => {
    console.log("Seeded Vivetutiempo demo data.");
  })
  .catch((error: unknown) => {
    console.error("Failed to seed Vivetutiempo demo data.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
