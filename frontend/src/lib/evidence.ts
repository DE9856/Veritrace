const STOP = new Set("the a an and or of in on at to for from by with was were is are that this its".split(" "));

const contentWords = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((w) => w.length > 2 && !STOP.has(w)) ?? [],
  );

/** Split a passage into sentences and find the one that shares most words with the claim.
 *  `best` is -1 when no sentence shares enough words to be worth pointing at. */
export function bestSentence(text: string, claim: string | undefined): { sentences: string[]; best: number } {
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/);
  if (!claim) return { sentences, best: -1 };
  const words = contentWords(claim.replace(/\[S\d+(?:\s*[,;]\s*S\d+)*\]/g, ""));
  let best = -1;
  let bestShare = 0.25; // below this, nothing is worth pointing at
  sentences.forEach((sentence, i) => {
    const shared = [...contentWords(sentence)].filter((w) => words.has(w)).length;
    const share = shared / Math.max(words.size, 1);
    if (share > bestShare) [best, bestShare] = [i, share];
  });
  return { sentences, best };
}
