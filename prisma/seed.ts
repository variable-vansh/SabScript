import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const stories = [
  {
    title: "The Last Signal",
    premise:
      "The message arrived at 3:47 AM on a Tuesday, which seemed like an odd time for humanity's first contact with extraterrestrial intelligence. Dr. Mara Chen almost deleted it — the observatory's filters had been glitching all week, filling her inbox with noise artifacts that looked just like this. But something about the pattern made her pause. It wasn't random. It was structured. Repeating. And it was coming from a region of space that, according to every telescope pointed at it for the past sixty years, contained absolutely nothing. She ran the analysis twice, then three times, then called her colleague in Geneva. He picked up on the first ring, which meant he'd seen it too. 'Don't tell anyone yet,' he said, his voice strange and thin. 'I think it's been here before.'",
  },
  {
    title: "The Honest Thief",
    premise:
      "The painting had been missing for eleven years when it showed up on Eleanor Voss's doorstep, wrapped in brown paper and twine, with a handwritten note that said: 'I'm sorry. I shouldn't have taken it. It belongs to you.' This would have been strange enough on its own. But Eleanor Voss had never owned a painting in her life. She'd never even been to a museum, unless you counted the time she wandered into one in Barcelona to escape the rain. She was a retired mail carrier from a small town in Oregon, and the painting — once she unwrapped it — turned out to be worth forty-seven million dollars. The police were equally confused. So was Interpol. So was the man who had stolen it.",
  },
  {
    title: "Thursdays with the Door Open",
    premise:
      "Every Thursday, the woman in apartment 4B left her door wide open from exactly 6 PM to exactly 9 PM. She never explained why. She never invited anyone in. She simply cooked dinner with the door open, read with the door open, sometimes sat on her couch staring at nothing in particular with the door open. The other residents of the building had gone through every stage of reaction — curiosity, concern, annoyance, theories, indifference, and finally, a strange kind of comfort. It became part of the rhythm of the building. You took out the trash, you checked your mail, you glanced into 4B. One Thursday in November, the door stayed closed. That was when everything changed.",
  },
];

const premises = [
  {
    title: "The Year Without Shadows",
    content:
      "On the first morning of spring, people stepped outside and noticed something impossible: nobody had a shadow. Not under streetlights, not beneath noon sun, not even in front of projector screens. At first it felt like a trick of weather, a peculiar atmospheric event that scientists would explain by lunch. But by nightfall, cats were hissing at empty corners, children were crying in rooms that looked normal, and old painters were standing in their studios with hands trembling over unfinished portraits. A woman in Kyoto claimed she saw her own shadow waiting for her at the train station, but when she ran toward it, it dissolved like ink in water. By the end of the week, governments had stopped using the word anomaly and started using the word departure.",
  },
  {
    title: "The Orchard at Mile 17",
    content:
      "There was no orchard on any map, and yet everyone in town could give directions to it. Drive seventeen miles west, turn where the road forgets to be paved, and keep going until the radio loses its voice. The first time Leena went, she found trees heavy with fruit that had no names and colors that looked wrong in daylight. The second time, she found a handwritten sign nailed to the gate: PICK ONLY WHAT YOU ARE READY TO REMEMBER. She laughed and filled a basket anyway. That night she dreamed of a boy she had never met, then woke with his birthday in her mouth. By Sunday, five people had gone to the orchard and come back carrying memories that belonged to someone else.",
  },
  {
    title: "A Choir for Empty Rooms",
    content:
      "When the city cut arts funding, the old conservatory was supposed to close quietly. Instead, every Wednesday at dusk, music began spilling from its locked windows. No one ever saw musicians enter. No one found footprints in the dust-coated foyer. But if you stood outside long enough, you could pick out voices: alto, tenor, a child who missed one note in exactly the same place each week. Nora, a former piano teacher, started bringing a folding chair and listening from the curb. On the seventh Wednesday, the harmony shifted and she heard her late mother's voice woven into the chorus, unmistakable and warm. The next morning, half the neighborhood had left fresh flowers on the conservatory steps, and the mayor canceled the demolition permit without explanation.",
  },
];

async function main() {
  const now = new Date();
  const roundEndsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.commentVote.deleteMany(),
    prisma.vote.deleteMany(),
    prisma.premiseVote.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.submission.deleteMany(),
    prisma.round.deleteMany(),
    prisma.segment.deleteMany(),
    prisma.premise.deleteMany(),
    prisma.moderationLog.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.story.deleteMany(),
    prisma.user.deleteMany(),
    prisma.verificationToken.deleteMany(),
  ]);

  const seedAuthor = await prisma.user.create({
    data: {
      email: "seed@sabscript.ink",
      username: "sabscript_seed",
      name: "Sabscript Seed",
      image: "https://api.dicebear.com/8.x/shapes/svg?seed=sabscript",
    },
  });

  for (const story of stories) {
    await prisma.story.create({
      data: {
        title: story.title,
        premise: story.premise,
        rounds: {
          create: {
            roundNumber: 1,
            startsAt: now,
            endsAt: roundEndsAt,
            status: "open",
          },
        },
      },
    });
  }

  for (const premise of premises) {
    const wordCount = countWords(premise.content);
    if (wordCount < 100 || wordCount > 150) {
      throw new Error(
        `Premise "${premise.title}" has ${wordCount} words. Expected 100-150.`,
      );
    }

    await prisma.premise.create({
      data: {
        userId: seedAuthor.id,
        title: premise.title,
        content: premise.content,
        wordCount,
        status: "voting",
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
