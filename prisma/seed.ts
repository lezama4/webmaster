import { PrismaClient } from "@prisma/client";
import { createAccount } from "../src/domain/account/Account";
import { completeEvent } from "../src/domain/event/Event";
import { approveProfile, createProfile } from "../src/domain/profile/Profile";
import { createProposal } from "../src/domain/proposal/Proposal";
import { acceptProposal } from "../src/domain/slot/acceptProposal";
import { closeSlot } from "../src/domain/slot/closeSlot";
import { createSlot } from "../src/domain/slot/Slot";
import { Argon2PasswordHasher } from "../src/infrastructure/auth/passwordHasher";
import { PrismaAccountRepository } from "../src/infrastructure/persistence/prisma/AccountRepository";
import { PrismaEventRepository } from "../src/infrastructure/persistence/prisma/EventRepository";
import { PrismaProfileRepository } from "../src/infrastructure/persistence/prisma/ProfileRepository";
import { PrismaProposalRepository } from "../src/infrastructure/persistence/prisma/ProposalRepository";
import { PrismaSlotRepository } from "../src/infrastructure/persistence/prisma/SlotRepository";

const SEED_PASSWORD = "VivetuTiempo2026!";
const DAY_MS = 24 * 60 * 60 * 1_000;

const IDS = {
  accounts: {
    admin: "seed-account-admin",
    sanJuan: "seed-account-hospital-san-juan",
    esperanza: "seed-account-hospital-esperanza",
    clara: "seed-account-artist-clara",
    mateo: "seed-account-artist-mateo",
    lucia: "seed-account-artist-lucia",
    ana: "seed-account-patient-ana",
  },
  profiles: {
    sanJuan: "seed-profile-hospital-san-juan",
    esperanza: "seed-profile-hospital-esperanza",
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
      role: "hospital",
    }),
    createAccount({
      id: IDS.accounts.esperanza,
      email: "hospital.esperanza@vtt.test",
      role: "hospital",
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
      type: "hospital",
      name: "Hospital San Juan",
    }),
  );
  const esperanza = createProfile({
    id: IDS.profiles.esperanza,
    accountId: IDS.accounts.esperanza,
    type: "hospital",
    name: "Hospital Esperanza",
  });
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

    for (const account of accounts) {
      await accountRepository.save({
        account,
        passwordHash: passwordHashes.get(account.id)!,
      });
    }

    for (const profile of [sanJuan, esperanza, clara, mateo, lucia]) {
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
