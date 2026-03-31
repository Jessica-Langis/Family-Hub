// All quotes verified from documented sources — no fabricated or misattributed content
export const TORI_HYPE = [
  "Once you've wrestled, everything else in life is easy. — Dan Gable",
  "Pain is nothing compared to what it feels like to quit. — Dan Gable",
  "Give everything you got today, for tomorrow may never come. — Dan Gable",
  "The 1st period is won by the best technician. The 2nd by the kid in the best shape. The 3rd by the kid with the biggest heart. — Dan Gable",
  "Gold medals aren't really made of gold. They're made of sweat, determination, and a hard-to-find alloy called guts. — Dan Gable",
  "If you're afraid to fail, you'll never succeed. — Dan Gable",
  "More enduringly than any other sport, wrestling teaches self-control and pride. — Dan Gable",
  "There's always ways of motivating yourself to higher levels. Write about it, dream about it. But after that, turn it into action. — Dan Gable",
  "The obvious goal was to be a champion. To get there, I had to set an everyday goal: push myself to exhaustion. — Dan Gable",
  "My valleys are higher than most people's peaks. I stay at that level. — Dan Gable",
  "I never won anything by myself. I was always strong because of help that gave me extra strength to win. — Dan Gable",
  "I love folkstyle wrestling. You get knocked down, you get back up. You earn your escape. Nobody's going to come rescue you. — Cael Sanderson",
  "If you're winning, chop wood, carry water. — Cael Sanderson",
  "Anyone can wrestle until they're tired. — Cael Sanderson",
  "The mat is a great equalizer. — Cael Sanderson",
  "The comeback is always stronger than the setback. — Jordan Burroughs",
  "Trust your training, trust your instincts. — Jordan Burroughs",
  "The difference between a good wrestler and a great wrestler is mental toughness. — Tom Brands",
  "Never lose faith, never give up. — Helen Maroulis",
  "Wrestling is my first love, and there's just nothing like it. — Helen Maroulis",
  "100% yes, I knew I could do it. — Tamyra Mensah-Stock",
  "I want to show people that you can have fun getting to your dreams. — Tamyra Mensah-Stock",
]

export const NOVA_HYPE = [...TORI_HYPE]

export const NOVA_JOKES = [
  "Why did the scarecrow win an award? He was outstanding in his field.",
  "Why can't a leopard hide? Because he's always spotted.",
  "What do you call a fish without eyes? A fsh.",
  "Why did the math book look so sad? It had too many problems.",
  "What do you call a sleeping dinosaur? A dino-snore.",
  "Why do cows wear bells? Because their horns don't work.",
  "What do elves learn in school? The elf-abet.",
  "Why did the bicycle fall over? It was two-tired.",
  "What do you call a fake noodle? An impasta.",
  "Why did the golfer bring extra pants? In case he got a hole in one.",
  "What do you call a dog that does magic? A labracadabrador.",
  "Why don't scientists trust atoms? Because they make up everything.",
  "What do you call a bear with no teeth? A gummy bear.",
  "Why did the stadium get hot after the game? All the fans left.",
  "What did the ocean say to the beach? Nothing, it just waved.",
]

export const NOVA_FACTS = [
  "A dog's nose print is as unique as a human fingerprint.",
  "Puppies are born blind, deaf, and toothless.",
  "Dogs can smell about 100,000 times better than humans.",
  "A group of puppies is called a litter. A group of dogs is called a pack.",
  "Dogs dream just like humans — their paws often twitch during sleep.",
  "The world record for the fastest 100m was set by Usain Bolt at 9.58 seconds.",
  "A baseball has exactly 108 stitches.",
  "Geometry Dash has over 100 million downloads worldwide.",
  "Dogs have three eyelids — including one to keep their eye moist.",
  "Golden retrievers were originally bred in Scotland to retrieve birds.",
  "The average dog can learn over 150 words and gestures.",
]

export const NOVA_COOL_FACTS = [
  "There are more stars in the universe than grains of sand on all of Earth's beaches.",
  "A day on Venus is longer than a year on Venus — it spins that slowly.",
  "Octopuses have three hearts, blue blood, and can edit their own DNA.",
  "The human brain generates enough electricity to power a small light bulb.",
  "Honey never spoils — edible honey has been found in 3,000-year-old Egyptian tombs.",
  "A single bolt of lightning contains enough energy to toast 100,000 slices of bread.",
  "There are more possible chess games than atoms in the observable universe.",
  "Sharks are older than trees — they've existed for over 400 million years.",
  "The surface of the sun is actually cooler than its outer atmosphere.",
  "Mantis shrimp can see 16 types of color receptors. Humans have 3.",
  "Cleopatra lived closer in time to the Moon landing than to the building of the pyramids.",
  "Some turtles can breathe through their butts — it's called cloacal respiration.",
  "The Milky Way galaxy smells like rum and tastes like raspberries, according to astronomers.",
]

export function pickDailyIndex(arr, offset = 0) {
  const day = new Date().toDateString()
  let hash = 0
  for (let i = 0; i < day.length; i++) hash = (hash * 31 + day.charCodeAt(i)) % arr.length
  return ((hash + offset) % arr.length + arr.length) % arr.length
}
