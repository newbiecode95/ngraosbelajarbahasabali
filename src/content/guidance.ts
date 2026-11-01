import type { Lesson, Localized } from "../lib/types";

export interface MissionGuide {
  instruction: Localized;
  phraseId?: string;
  tip?: Localized;
}
export const missionGuides: Record<string, MissionGuide> = {
  "warung:greet": {
    instruction: {
      id: "Men Sari menyapamu. Balas dengan sapaan pagi dalam Basa Bali.",
      en: "Men Sari greets you. Reply with a morning greeting in Balinese.",
    },
    phraseId: "phrase:warung-01",
  },
  "warung:thank": {
    instruction: {
      id: "Ucapkan terima kasih kepada Men Sari. Kamu boleh menambahkan namanya.",
      en: "Thank Men Sari. You can include her name.",
    },
    phraseId: "phrase:warung-07",
  },
  "warung:farewell": {
    instruction: {
      id: "Kamu akan meninggalkan warung. Katakan bahwa kamu pamit.",
      en: "You are leaving the warung. Say that you are taking your leave.",
    },
    phraseId: "phrase:warung-13",
  },
  "kos:name": {
    instruction: {
      id: "Bu Komang ingin mengenalmu. Sebutkan nama panggilanmu.",
      en: "Bu Komang would like to know you. Introduce your name.",
    },
    phraseId: "phrase:kos-01",
    tip: {
      id: "Ganti Ayu dengan namamu sendiri.",
      en: "Replace Ayu with your own name.",
    },
  },
  "kos:origin": {
    instruction: {
      id: "Ceritakan dari daerah mana kamu berasal.",
      en: "Say which town or region you come from.",
    },
    phraseId: "phrase:kos-07",
    tip: {
      id: "Ganti Denpasar dengan daerah asalmu.",
      en: "Replace Denpasar with your hometown.",
    },
  },
  "kos:work": {
    instruction: {
      id: "Sekarang ceritakan tempat kamu bekerja.",
      en: "Now say where you work.",
    },
    phraseId: "phrase:kos-13",
    tip: {
      id: "Ganti Denpasar dengan tempat kerjamu.",
      en: "Replace Denpasar with where you work.",
    },
  },
  "pasar:price": {
    instruction: {
      id: "Pilih buah yang kamu inginkan, lalu tanyakan harganya.",
      en: "Choose a fruit you would like and ask its price.",
    },
    phraseId: "phrase:pasar-01",
  },
  "pasar:quantity": {
    instruction: {
      id: "Sebutkan buah dan jumlah yang ingin kamu beli, misalnya satu pisang.",
      en: "Say which fruit and how many you want, such as one banana.",
    },
    phraseId: "phrase:pasar-07",
  },
  "pasar:bargain": {
    instruction: {
      id: "Coba tanyakan apakah harganya boleh lebih murah.",
      en: "Ask whether the seller can lower the price.",
    },
    phraseId: "phrase:pasar-13",
  },
  "boss:greet": {
    instruction: {
      id: "Mulai percakapan dengan menyapa Pak Wayan dalam Basa Bali.",
      en: "Start by greeting Pak Wayan in Balinese.",
    },
  },
  "boss:introduce": {
    instruction: {
      id: "Perkenalkan nama atau ceritakan daerah asalmu kepada Pak Wayan.",
      en: "Introduce your name or hometown to Pak Wayan.",
    },
  },
  "boss:shop": {
    instruction: {
      id: "Lanjutkan dengan menanyakan harga atau menyebutkan jumlah buah.",
      en: "Continue by asking a price or saying how much fruit you want.",
    },
  },
};

export function currentMission(lesson: Lesson, completed: string[]) {
  return lesson.objectives.find(
    (objective) => !completed.includes(objective.id),
  );
}
